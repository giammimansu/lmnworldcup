"""Sprint 7 — Recap giornata (sola lettura).

Aggrega dati esistenti: per la lega, mostra le partite FINISHED dell'ultima giornata
con i pronostici di tutti i membri, i punti, e la classifica di giornata.
Nessuna migration. Privacy: solo partite FINISHED (già iniziate) vengono esposte.

Sprint 8: include anche il pronostico marcatore (scorer_name + scorer_points)
accanto a ogni pronostico risultato, e ne somma i punti nella classifica di giornata.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/leagues", tags=["recap"])


def _latest_finished_matchday() -> int | None:
    """Matchday più recente con almeno una partita FINISHED (esclude i null)."""
    finished = (
        supabase_admin.table("matches")
        .select("matchday")
        .eq("status", "FINISHED")
        .not_.is_("matchday", "null")
        .order("matchday", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return finished[0]["matchday"] if finished else None


@router.get("/{league_id}/recap")
def league_recap(
    league_id: str,
    matchday: int | None = None,
    user: dict = Depends(get_current_user),
):
    # 1) Appartenenza alla lega
    is_member = (
        supabase_admin.table("league_members")
        .select("user_id")
        .eq("league_id", league_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    if not is_member:
        raise HTTPException(403, "Non sei membro di questa lega")

    # 2) Giornata target
    md = matchday if matchday is not None else _latest_finished_matchday()
    if md is None:
        return {"matchday": None, "matches": [], "ranking": []}

    # 3) Membri (id -> nome)
    members = (
        supabase_admin.table("league_members")
        .select("user_id, profiles(display_name)")
        .eq("league_id", league_id)
        .execute()
        .data
    )
    member_ids = [m["user_id"] for m in members]
    names = {
        m["user_id"]: (m.get("profiles") or {}).get("display_name", "?")
        for m in members
    }

    # 4) Partite FINISHED della giornata (finite => già iniziate => privacy ok)
    matches = (
        supabase_admin.table("matches")
        .select("*")
        .eq("matchday", md)
        .eq("status", "FINISHED")
        .order("utc_date")
        .execute()
        .data
    )
    match_ids = [mt["id"] for mt in matches]
    if not match_ids:
        return {"matchday": md, "matches": [], "ranking": []}

    # 5) Pronostici risultato dei membri
    preds = (
        supabase_admin.table("predictions")
        .select("user_id, match_id, home_score, away_score, points")
        .in_("match_id", match_ids)
        .in_("user_id", member_ids)
        .execute()
        .data
    )

    # 5b) Pronostici marcatore dei membri (lista nomi giocatori)
    scorer_preds = (
        supabase_admin.table("scorer_predictions")
        .select("user_id, match_id, player_ids, points")
        .in_("match_id", match_ids)
        .in_("user_id", member_ids)
        .execute()
        .data
    )
    all_pids = [pid for s in scorer_preds for pid in (s.get("player_ids") or [])]
    player_names: dict[int, str] = {}
    if all_pids:
        players = (
            supabase_admin.table("players")
            .select("id, name")
            .in_("id", list(set(all_pids)))
            .execute()
            .data
        )
        player_names = {p["id"]: p["name"] for p in players}
    # (match_id, user_id) -> {names[], points}
    scorer_by_key = {
        (s["match_id"], s["user_id"]): {
            "scorer_names": [player_names.get(pid, "?") for pid in (s.get("player_ids") or [])],
            "scorer_points": s["points"] or 0,
        }
        for s in scorer_preds
    }

    preds_by_match: dict[int, list] = {mid: [] for mid in match_ids}
    points_per_member: dict[str, int] = {uid: 0 for uid in member_ids}

    for p in preds:
        pts = p["points"] or 0
        points_per_member[p["user_id"]] = points_per_member.get(p["user_id"], 0) + pts
        scorer = scorer_by_key.get((p["match_id"], p["user_id"]))
        preds_by_match[p["match_id"]].append(
            {
                "user_id": p["user_id"],
                "display_name": names.get(p["user_id"], "?"),
                "home_score": p["home_score"],
                "away_score": p["away_score"],
                "points": pts,
                "scorer_names": scorer["scorer_names"] if scorer else None,
                "scorer_points": scorer["scorer_points"] if scorer else None,
            }
        )

    # I punti marcatore confluiscono nella classifica di giornata
    for s in scorer_preds:
        points_per_member[s["user_id"]] = (
            points_per_member.get(s["user_id"], 0) + (s["points"] or 0)
        )

    # 6) Output partite (pronostici ordinati per punti decrescenti)
    out_matches = []
    for mt in matches:
        rows = sorted(
            preds_by_match.get(mt["id"], []),
            key=lambda r: (-r["points"], r["display_name"].lower()),
        )
        out_matches.append(
            {
                "id": mt["id"],
                "home_team_name": mt["home_team_name"],
                "home_team_tla": mt["home_team_tla"],
                "home_team_crest": mt["home_team_crest"],
                "away_team_name": mt["away_team_name"],
                "away_team_tla": mt["away_team_tla"],
                "away_team_crest": mt["away_team_crest"],
                "home_score": mt["home_score"],
                "away_score": mt["away_score"],
                "stage": mt["stage"],
                "predictions": rows,
            }
        )

    # 7) Classifica di giornata (solo punti di questa matchday)
    ranking = sorted(
        (
            {"user_id": uid, "display_name": names.get(uid, "?"), "points": pts}
            for uid, pts in points_per_member.items()
        ),
        key=lambda r: (-r["points"], r["display_name"].lower()),
    )

    return {"matchday": md, "matches": out_matches, "ranking": ranking}
