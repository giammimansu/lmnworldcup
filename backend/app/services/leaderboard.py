"""Calcolo classifica e snapshot giornalieri."""
from datetime import date, datetime, timezone

from app.database import supabase_admin


def compute_leaderboard() -> list[dict]:
    """Classifica completa ordinata per punti totali.

    Per ogni utente: position, user_id, display_name, points, exact_count,
    accuracy (esatti / pronostici su partite finite, %), trend
    (posizione ultimo snapshot - posizione attuale; positivo = salito).
    """
    profiles = (
        supabase_admin.table("profiles").select("id, display_name").execute().data
    )
    predictions = (
        supabase_admin.table("predictions")
        .select("user_id, match_id, points")
        .execute()
        .data
    )
    finished_ids = {
        m["id"]
        for m in supabase_admin.table("matches")
        .select("id")
        .eq("status", "FINISHED")
        .execute()
        .data
    }

    # Aggregati per utente
    stats: dict[str, dict] = {
        p["id"]: {
            "user_id": p["id"],
            "display_name": p["display_name"],
            "points": 0,
            "exact_count": 0,
            "scored_count": 0,  # pronostici su partite finite
        }
        for p in profiles
    }
    for pred in predictions:
        s = stats.get(pred["user_id"])
        if s is None:
            continue
        if pred["match_id"] in finished_ids:
            s["scored_count"] += 1
            pts = pred["points"] or 0
            s["points"] += pts
            # esatto = 3 * moltiplicatore -> qualsiasi multiplo di 3 non nullo
            if pts > 0 and pts % 3 == 0:
                s["exact_count"] += 1

    # Bonus marcatore: confluisce negli stessi totali (allineato con recap).
    scorer_preds = (
        supabase_admin.table("scorer_predictions")
        .select("user_id, match_id, points")
        .execute()
        .data
    )
    for sp in scorer_preds:
        s = stats.get(sp["user_id"])
        if s is None:
            continue
        if sp["match_id"] in finished_ids:
            s["points"] += sp["points"] or 0

    rows = sorted(
        stats.values(), key=lambda s: (-s["points"], s["display_name"].lower())
    )

    # Ultimo snapshot per il trend
    snapshots = (
        supabase_admin.table("leaderboard_snapshots")
        .select("user_id, date, position")
        .order("date", desc=True)
        .execute()
        .data
    )
    last_position: dict[str, int] = {}
    if snapshots:
        last_date = snapshots[0]["date"]
        last_position = {
            s["user_id"]: s["position"] for s in snapshots if s["date"] == last_date
        }

    out = []
    for i, s in enumerate(rows, start=1):
        prev = last_position.get(s["user_id"])
        trend = (prev - i) if prev is not None else 0
        accuracy = (
            round(s["exact_count"] / s["scored_count"] * 100, 1)
            if s["scored_count"]
            else 0.0
        )
        out.append(
            {
                "position": i,
                "user_id": s["user_id"],
                "display_name": s["display_name"],
                "points": s["points"],
                "exact_count": s["exact_count"],
                "accuracy": accuracy,
                "trend": trend,
            }
        )
    return out


def save_snapshot() -> int:
    """Salva lo snapshot odierno della classifica (idempotente per data)."""
    board = compute_leaderboard()
    today = date.today().isoformat()
    rows = [
        {
            "user_id": r["user_id"],
            "date": today,
            "position": r["position"],
            "points": r["points"],
        }
        for r in board
    ]
    if rows:
        supabase_admin.table("leaderboard_snapshots").upsert(
            rows, on_conflict="user_id,date"
        ).execute()

    supabase_admin.table("sync_log").insert(
        {
            "matches_updated": 0,
            "status": "ok",
            "detail": f"Snapshot classifica {today}: {len(rows)} utenti",
        }
    ).execute()
    return len(rows)
