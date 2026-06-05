"""Sprint 9 — Scoring dei pronostici di torneo ("speciali").

Una domanda risolta (resolved=true + correct_answer) assegna i punti a chi ha
indovinato. Idempotente: riscrive i punti da zero ad ogni esecuzione, così
l'admin può correggere e ri-risolvere senza doppi conteggi.
"""
from app.database import supabase_admin


def score_special_answer(qtype: str, points: int, correct: dict, answer: dict) -> int:
    """Funzione pura: punti di una risposta data la risposta corretta.

    - team:   punti pieni se il TLA coincide.
    - player: punti pieni se il player_id coincide.
    - podium: `points` per OGNI posizione esatta (stessa squadra nello stesso posto).
    """
    if qtype == "team":
        return points if answer.get("team_tla") == correct.get("team_tla") else 0
    if qtype == "player":
        return points if answer.get("player_id") == correct.get("player_id") else 0
    if qtype == "podium":
        cp, ap = correct.get("podium", []), answer.get("podium", [])
        return sum(points for i in range(min(3, len(cp), len(ap))) if ap[i] == cp[i])
    return 0


def score_special(code: str) -> dict:
    """Assegna i punti per una domanda risolta. Idempotente."""
    q = (
        supabase_admin.table("special_questions")
        .select("*")
        .eq("code", code)
        .limit(1)
        .execute()
        .data
    )
    q = q[0] if q else None
    if not q or not q["resolved"] or q["correct_answer"] is None:
        return {"scored": 0, "reason": "non risolta"}

    preds = (
        supabase_admin.table("special_predictions")
        .select("*")
        .eq("question_code", code)
        .execute()
        .data
    )
    for p in preds:
        pts = score_special_answer(q["qtype"], q["points"], q["correct_answer"], p["answer"])
        supabase_admin.table("special_predictions").update({"points": pts}).eq(
            "id", p["id"]
        ).execute()
    return {"scored": len(preds)}
