"""Calcolo punti pronostici.

Regole:
- Risultato esatto (entrambi i gol giusti): 3 punti
- Segno giusto (1/X/2 corretto ma risultato sbagliato): 1 punto
- Sbagliato: 0 punti

Moltiplicatori per fase:
- GROUP_STAGE: x1
- LAST_32, LAST_16, QUARTER_FINALS: x2
- SEMI_FINALS, THIRD_PLACE, FINAL: x3

Nota knockout: il fullTime di football-data include gli eventuali supplementari,
quindi il confronto è su 90' + extra time, MAI sui rigori.
"""
from app.database import supabase_admin

STAGE_MULTIPLIERS = {
    "GROUP_STAGE": 1,
    "LAST_32": 2,
    "LAST_16": 2,
    "QUARTER_FINALS": 2,
    "SEMI_FINALS": 3,
    "THIRD_PLACE": 3,
    "FINAL": 3,
}

EXACT_POINTS = 3
SIGN_POINTS = 1
PTS_SCORER = 2  # bonus marcatore (NON moltiplicato per fase)
MAX_SCORERS_PER_TEAM = 3  # marcatori pronosticabili per squadra (anche se i gol > 3)


def _sign(home: int, away: int) -> str:
    if home > away:
        return "1"
    if home < away:
        return "2"
    return "X"


def calculate_points(
    pred_home: int,
    pred_away: int,
    actual_home: int,
    actual_away: int,
    stage: str,
) -> int:
    """Funzione pura: punti di un pronostico dato il risultato reale e la fase."""
    multiplier = STAGE_MULTIPLIERS.get(stage, 1)

    if pred_home == actual_home and pred_away == actual_away:
        return EXACT_POINTS * multiplier
    if _sign(pred_home, pred_away) == _sign(actual_home, actual_away):
        return SIGN_POINTS * multiplier
    return 0


def calculate_scorer_points(
    predicted_ids: list[int], actual_ids: list[int]
) -> int:
    """Funzione pura. +2 per ogni marcatore previsto azzeccato (multiset).

    Es: previsti [X, X] e gol reali [X, X] -> +4 (doppietta indovinata);
    previsti [X, X] e gol reali [X]        -> +2 (un solo match).
    """
    from collections import Counter

    pred = Counter(predicted_ids)
    actual = Counter(actual_ids)
    matched = sum((pred & actual).values())  # intersezione multiset
    return PTS_SCORER * matched


def _score_scorer_predictions(match_id: int) -> None:
    """Ricalcola i punti marcatore di TUTTI i pronostici marcatore sulla partita.

    Idempotente: riscrive i punti da zero ad ogni esecuzione.
    """
    goals = (
        supabase_admin.table("match_goals")
        .select("player_id")
        .eq("match_id", match_id)
        .execute()
        .data
    )
    actual_ids = [g["player_id"] for g in goals if g["player_id"] is not None]

    sp = (
        supabase_admin.table("scorer_predictions")
        .select("id, player_ids")
        .eq("match_id", match_id)
        .execute()
        .data
    )
    for s in sp:
        pts = calculate_scorer_points(s.get("player_ids") or [], actual_ids)
        supabase_admin.table("scorer_predictions").update({"points": pts}).eq(
            "id", s["id"]
        ).execute()


def score_match(match_id: int) -> int:
    """Ricalcola e aggiorna i punti di TUTTI i pronostici su una partita FINISHED.

    Ritorna il numero di pronostici aggiornati. No-op se la partita non è
    finita o non ha punteggio.
    """
    match_result = (
        supabase_admin.table("matches").select("*").eq("id", match_id).limit(1).execute()
    )
    if not match_result.data:
        return 0
    match = match_result.data[0]

    if (
        match["status"] != "FINISHED"
        or match["home_score"] is None
        or match["away_score"] is None
    ):
        return 0

    predictions = (
        supabase_admin.table("predictions")
        .select("id, home_score, away_score")
        .eq("match_id", match_id)
        .execute()
    )

    updated = 0
    for pred in predictions.data:
        points = calculate_points(
            pred["home_score"],
            pred["away_score"],
            match["home_score"],
            match["away_score"],
            match["stage"],
        )
        supabase_admin.table("predictions").update({"points": points}).eq(
            "id", pred["id"]
        ).execute()
        updated += 1

    # Punti marcatore (idempotente, indipendente dal moltiplicatore di fase)
    _score_scorer_predictions(match_id)

    return updated
