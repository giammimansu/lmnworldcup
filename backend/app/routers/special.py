"""Sprint 9 — Pronostici di torneo (endpoint utente)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/special", tags=["special"])


def _deadline(q: dict) -> datetime:
    return datetime.fromisoformat(q["deadline"].replace("Z", "+00:00"))


class SpecialAnswer(BaseModel):
    question_code: str
    answer: dict  # {"team_tla":...} | {"player_id":...} | {"podium":[...]}


@router.get("/questions")
def list_questions(user: dict = Depends(get_current_user)):
    """Domande di torneo arricchite con la risposta dell'utente e lo stato.

    Per ogni domanda: my_answer, my_points, open (bool), e — se resolved —
    correct_answer (le altrui risposte restano protette dalla RLS).
    """
    qs = (
        supabase_admin.table("special_questions")
        .select("*")
        .order("sort_order")
        .execute()
        .data
    )
    mine = (
        supabase_admin.table("special_predictions")
        .select("question_code, answer, points")
        .eq("user_id", user["id"])
        .execute()
        .data
    )
    my_map = {m["question_code"]: m for m in mine}
    now = datetime.now(timezone.utc)
    for q in qs:
        m = my_map.get(q["code"])
        q["my_answer"] = m["answer"] if m else None
        q["my_points"] = m["points"] if m else None
        q["open"] = now < _deadline(q)
        # Nascondi la risposta corretta finché non è risolta.
        if not q["resolved"]:
            q["correct_answer"] = None
    return qs


@router.post("/answer")
def answer(body: SpecialAnswer, user: dict = Depends(get_current_user)):
    """Salva (upsert) la risposta dell'utente. 403 dopo la scadenza."""
    q = (
        supabase_admin.table("special_questions")
        .select("*")
        .eq("code", body.question_code)
        .limit(1)
        .execute()
        .data
    )
    q = q[0] if q else None
    if not q:
        raise HTTPException(404, "Domanda non trovata")
    if datetime.now(timezone.utc) >= _deadline(q):
        raise HTTPException(403, "Pronostici di torneo chiusi")

    # Validazione minima per tipo
    a = body.answer
    if q["qtype"] == "team" and not a.get("team_tla"):
        raise HTTPException(400, "Manca team_tla")
    if q["qtype"] == "player" and not a.get("player_id"):
        raise HTTPException(400, "Manca player_id")
    if q["qtype"] == "podium":
        podium = a.get("podium", [])
        if len(podium) != 3:
            raise HTTPException(400, "Il podio richiede esattamente 3 squadre")
        if len(set(podium)) != 3:
            raise HTTPException(400, "Le tre squadre del podio devono essere diverse")

    supabase_admin.table("special_predictions").upsert(
        {
            "user_id": user["id"],
            "question_code": body.question_code,
            "answer": a,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,question_code",
    ).execute()
    return {"ok": True}
