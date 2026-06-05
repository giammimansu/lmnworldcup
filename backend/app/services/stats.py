"""Statistiche utente: aggregati, punti per matchday, storico."""
from app.database import supabase_admin
from app.services.scoring import _sign


def _outcome_of(pred: dict, match: dict) -> str:
    if (
        match["status"] != "FINISHED"
        or match["home_score"] is None
        or match["away_score"] is None
    ):
        return "pending"
    if (
        pred["home_score"] == match["home_score"]
        and pred["away_score"] == match["away_score"]
    ):
        return "exact"
    if _sign(pred["home_score"], pred["away_score"]) == _sign(
        match["home_score"], match["away_score"]
    ):
        return "sign"
    return "wrong"


def compute_user_stats(user_id: str, public: bool = False) -> dict:
    """Statistiche complete di un utente.

    public=True: esclude lo storico dei pronostici pending (mai rivelare
    pronostici su partite non iniziate).
    """
    predictions = (
        supabase_admin.table("predictions")
        .select("*")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    matches_all = supabase_admin.table("matches").select("*").execute().data
    matches_by_id = {m["id"]: m for m in matches_all}

    finished = [m for m in matches_all if m["status"] == "FINISHED"]
    finished_ids = {m["id"]: m for m in finished}

    total_points = 0
    exact = sign = wrong = 0
    points_by_matchday: dict[int, int] = {}
    history = []

    for pred in predictions:
        match = matches_by_id.get(pred["match_id"])
        if match is None:
            continue
        outcome = _outcome_of(pred, match)
        pts = pred["points"] or 0

        if outcome != "pending":
            total_points += pts
            if outcome == "exact":
                exact += 1
            elif outcome == "sign":
                sign += 1
            else:
                wrong += 1
            md = match.get("matchday")
            if md is not None:
                points_by_matchday[md] = points_by_matchday.get(md, 0) + pts

        history.append(
            {
                "match_id": match["id"],
                "utc_date": match["utc_date"],
                "home_team_name": match["home_team_name"],
                "away_team_name": match["away_team_name"],
                "home_team_crest": match["home_team_crest"],
                "away_team_crest": match["away_team_crest"],
                "pred_home": pred["home_score"],
                "pred_away": pred["away_score"],
                "actual_home": match["home_score"],
                "actual_away": match["away_score"],
                "points": pts if outcome != "pending" else None,
                "outcome": outcome,
            }
        )

    # Partite finite senza pronostico = mancate
    predicted_ids = {p["match_id"] for p in predictions}
    missed = len([m for m in finished if m["id"] not in predicted_ids])

    scored_total = exact + sign + wrong
    accuracy = round(exact / scored_total * 100, 1) if scored_total else 0.0

    # Storico: ultimi 10 per data partita, più recenti prima
    history.sort(key=lambda h: h["utc_date"], reverse=True)
    if public:
        history = [h for h in history if h["outcome"] != "pending"]
    history = history[:10]

    matchdays = sorted(points_by_matchday)
    return {
        "user_id": user_id,
        "total_points": total_points,
        "total_predictions": len(predictions),
        "exact_count": exact,
        "sign_count": sign,
        "wrong_count": wrong,
        "missed_count": missed,
        "accuracy": accuracy,
        "points_by_matchday": [
            {"matchday": md, "points": points_by_matchday[md]} for md in matchdays
        ],
        "history": history,
    }
