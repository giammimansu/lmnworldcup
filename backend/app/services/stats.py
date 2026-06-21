"""Statistiche utente: aggregati, punti per matchday, storico."""
from datetime import datetime, timezone

from app.database import supabase_admin
from app.services.scoring import PTS_SCORER, _sign


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

    # Bonus marcatore: confluisce nei punti totali (come la classifica).
    scorer_preds = (
        supabase_admin.table("scorer_predictions")
        .select("match_id, player_ids, points")
        .eq("user_id", user_id)
        .execute()
        .data
    )

    # Pronostici di torneo (special): i punti delle domande risolte confluiscono
    # nei punti totali. points è NULL finché la domanda non è risolta.
    special_preds = (
        supabase_admin.table("special_predictions")
        .select("question_code, answer, points")
        .eq("user_id", user_id)
        .execute()
        .data
    )
    questions = (
        supabase_admin.table("special_questions")
        .select("*")
        .order("sort_order")
        .execute()
        .data
    )

    # --- Nomi giocatori usati da marcatori + risposte special (una sola query) ---
    need_pids: set[int] = set()
    for sp in scorer_preds:
        need_pids.update(sp.get("player_ids") or [])
    for q in questions:
        ca = q.get("correct_answer") or {}
        if ca.get("player_id"):
            need_pids.add(ca["player_id"])
    for sp in special_preds:
        a = sp.get("answer") or {}
        if a.get("player_id"):
            need_pids.add(a["player_id"])
    player_names: dict[int, str] = {}
    if need_pids:
        rows = (
            supabase_admin.table("players")
            .select("id, name")
            .in_("id", list(need_pids))
            .execute()
            .data
        )
        player_names = {r["id"]: r["name"] for r in rows}

    # Mappa tla -> nome nazionale (dalle partite).
    team_names: dict[str, str] = {}
    for m in matches_all:
        for tla, name in (
            (m.get("home_team_tla"), m.get("home_team_name")),
            (m.get("away_team_tla"), m.get("away_team_name")),
        ):
            if tla and tla not in team_names:
                team_names[tla] = name or tla

    # --- Marcatori: punti totali, statistiche e dettaglio per partita ---
    scorers_guessed = 0   # marcatori azzeccati (su partite finite)
    scorers_predicted = 0  # marcatori inseriti (su partite finite)
    scorer_by_match: dict[int, dict] = {}
    for sp in scorer_preds:
        pids = sp.get("player_ids") or []
        pts = sp.get("points") or 0
        scorer_by_match[sp["match_id"]] = {
            "scorer_names": [player_names.get(pid, "?") for pid in pids],
            "scorer_points": pts,
        }
        match = matches_by_id.get(sp["match_id"])
        if not match or match["status"] != "FINISHED":
            continue
        total_points += pts
        scorers_guessed += pts // PTS_SCORER  # +2 per marcatore azzeccato
        scorers_predicted += len(pids)

    # Attacca i marcatori allo storico (per partita).
    for h in history:
        sc = scorer_by_match.get(h["match_id"])
        h["scorer_names"] = sc["scorer_names"] if sc else None
        h["scorer_points"] = sc["scorer_points"] if sc else None

    total_points += sum((s.get("points") or 0) for s in special_preds)

    # --- Dettaglio pronostici di torneo dell'utente ---
    def _label(qtype: str, ans: dict | None) -> str | None:
        if not ans:
            return None
        if qtype == "team":
            return team_names.get(ans.get("team_tla"), ans.get("team_tla"))
        if qtype == "player":
            pid = ans.get("player_id")
            return player_names.get(pid, f"#{pid}") if pid else None
        if qtype == "podium":
            return " · ".join(team_names.get(t, t) for t in (ans.get("podium") or []))
        return None

    sp_by_code = {p["question_code"]: p for p in special_preds}
    now = datetime.now(timezone.utc)
    special = []
    for q in questions:
        deadline = datetime.fromisoformat(q["deadline"].replace("Z", "+00:00"))
        # Privacy: sul profilo pubblico le risposte si vedono solo dopo la scadenza.
        if public and now < deadline:
            continue
        sp = sp_by_code.get(q["code"])
        special.append(
            {
                "code": q["code"],
                "title": q["title"],
                "qtype": q["qtype"],
                "points": q["points"],
                "resolved": q["resolved"],
                "correct_label": _label(q["qtype"], q.get("correct_answer"))
                if q["resolved"]
                else None,
                "answer_label": _label(q["qtype"], sp.get("answer")) if sp else None,
                "my_points": sp.get("points") if sp else None,
            }
        )

    # Partite finite senza pronostico = mancate
    predicted_ids = {p["match_id"] for p in predictions}
    missed = len([m for m in finished if m["id"] not in predicted_ids])

    scored_total = exact + sign + wrong
    accuracy = round(exact / scored_total * 100, 1) if scored_total else 0.0
    scorers_accuracy = (
        round(scorers_guessed / scorers_predicted * 100, 1)
        if scorers_predicted
        else 0.0
    )

    # Storico per data partita, più recenti prima. Sul profilo pubblico solo le
    # partite concluse (mai rivelare pronostici su partite non iniziate).
    # Niente cap: con un cap (es. 50) le partite future pending occupavano i primi
    # slot e spingevano fuori quelle finite con punti, così la somma riga-per-riga
    # dello storico non coincideva più con i punti totali. Le partite sono ~104.
    history.sort(key=lambda h: h["utc_date"], reverse=True)
    if public:
        history = [h for h in history if h["outcome"] != "pending"]

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
        "scorers_guessed": scorers_guessed,
        "scorers_predicted": scorers_predicted,
        "scorers_accuracy": scorers_accuracy,
        "points_by_matchday": [
            {"matchday": md, "points": points_by_matchday[md]} for md in matchdays
        ],
        "history": history,
        "special": special,
    }
