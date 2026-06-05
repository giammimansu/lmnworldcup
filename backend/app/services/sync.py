"""Sincronizzazione partite da football-data.org verso la tabella matches."""
from datetime import datetime, timezone

from app.database import supabase_admin
from app.services.football_api import FootballAPIError, get_world_cup_matches
from app.services.scoring import score_match


def _map_match(raw: dict) -> dict:
    """Mappa una partita raw di football-data.org sulla riga della tabella matches."""
    home = raw.get("homeTeam") or {}
    away = raw.get("awayTeam") or {}
    full_time = (raw.get("score") or {}).get("fullTime") or {}
    return {
        "id": raw["id"],
        "utc_date": raw["utcDate"],
        "status": raw.get("status", "SCHEDULED"),
        "stage": raw.get("stage", ""),
        "matchday": raw.get("matchday"),
        "group_name": raw.get("group"),
        "home_team_id": home.get("id"),
        "home_team_name": home.get("name"),
        "home_team_tla": home.get("tla"),
        "home_team_crest": home.get("crest"),
        "away_team_id": away.get("id"),
        "away_team_name": away.get("name"),
        "away_team_tla": away.get("tla"),
        "away_team_crest": away.get("crest"),
        "home_score": full_time.get("home"),
        "away_score": full_time.get("away"),
        "last_synced": datetime.now(timezone.utc).isoformat(),
    }


async def sync_matches() -> dict:
    """Scarica le partite del Mondiale 2026 e fa upsert su matches.

    Idempotente: chiave di upsert = id football-data. Scrive sempre una riga
    in sync_log con l'esito.
    """
    try:
        raw_matches = await get_world_cup_matches(season=2026)
    except FootballAPIError as exc:
        supabase_admin.table("sync_log").insert(
            {"matches_updated": 0, "status": "error", "detail": str(exc)}
        ).execute()
        return {"status": "error", "matches_updated": 0, "detail": str(exc)}

    rows = [_map_match(m) for m in raw_matches]

    # Rileva le partite che passano a FINISHED con questo sync (per il calcolo punti)
    previous = supabase_admin.table("matches").select("id, status").execute()
    previous_status = {m["id"]: m["status"] for m in previous.data}
    newly_finished = [
        r["id"]
        for r in rows
        if r["status"] == "FINISHED" and previous_status.get(r["id"]) != "FINISHED"
    ]

    if rows:
        supabase_admin.table("matches").upsert(rows, on_conflict="id").execute()

    # Calcola i punti per le partite appena concluse + valuta achievements
    from app.services.achievements import evaluate_achievements_for_match

    scored = 0
    for match_id in newly_finished:
        scored += score_match(match_id)
        evaluate_achievements_for_match(match_id)

    detail = f"Sync completata: {len(rows)} partite"
    if newly_finished:
        detail += f"; {len(newly_finished)} concluse, {scored} pronostici aggiornati"

    supabase_admin.table("sync_log").insert(
        {"matches_updated": len(rows), "status": "ok", "detail": detail}
    ).execute()

    return {"status": "ok", "matches_updated": len(rows), "detail": detail}
