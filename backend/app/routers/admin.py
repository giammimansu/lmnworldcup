from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import require_admin
from app.database import supabase_admin
from app.services.scoring import score_match
from app.services.special_scoring import score_special

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def list_users(_admin: dict = Depends(require_admin)):
    """Lista utenti con numero pronostici."""
    profiles = (
        supabase_admin.table("profiles")
        .select("id, email, display_name, is_admin, created_at")
        .order("created_at")
        .execute()
        .data
    )
    predictions = (
        supabase_admin.table("predictions").select("user_id").execute().data
    )
    counts: dict[str, int] = {}
    for p in predictions:
        counts[p["user_id"]] = counts.get(p["user_id"], 0) + 1

    return [
        {**prof, "predictions_count": counts.get(prof["id"], 0)} for prof in profiles
    ]


class MatchOverride(BaseModel):
    home_score: int | None = Field(default=None, ge=0)
    away_score: int | None = Field(default=None, ge=0)
    status: str | None = None  # TIMED | IN_PLAY | PAUSED | FINISHED


@router.patch("/matches/{match_id}")
def override_match(
    match_id: int, body: MatchOverride, _admin: dict = Depends(require_admin)
):
    """Override manuale di score/status (errori API esterna). Ricalcola i punti."""
    existing = (
        supabase_admin.table("matches").select("id").eq("id", match_id).limit(1).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    supabase_admin.table("matches").update(updates).eq("id", match_id).execute()

    # Ricalcola i punti (no-op se non FINISHED)
    rescored = score_match(match_id)

    supabase_admin.table("sync_log").insert(
        {
            "matches_updated": 1,
            "status": "ok",
            "detail": f"Override admin partita {match_id}: {updates}; {rescored} pronostici ricalcolati",
        }
    ).execute()

    return {"match_id": match_id, "updated": updates, "predictions_rescored": rescored}


class GoalIn(BaseModel):
    match_id: int
    player_id: int
    player_name: str
    team_tla: str | None = None
    minute: int | None = None


@router.post("/goals")
def add_goal(g: GoalIn, _admin: dict = Depends(require_admin)):
    """Registra un marcatore reale e ricalcola subito i punti marcatore."""
    supabase_admin.table("match_goals").insert(g.model_dump()).execute()
    score_match(g.match_id)
    return {"ok": True}


@router.delete("/goals/{goal_id}")
def del_goal(goal_id: int, match_id: int, _admin: dict = Depends(require_admin)):
    """Rimuove un marcatore e ricalcola i punti (idempotente)."""
    supabase_admin.table("match_goals").delete().eq("id", goal_id).execute()
    score_match(match_id)
    return {"ok": True}


@router.get("/goals/{match_id}")
def list_goals(match_id: int, _admin: dict = Depends(require_admin)):
    """Marcatori registrati per la partita."""
    return (
        supabase_admin.table("match_goals")
        .select("*")
        .eq("match_id", match_id)
        .order("minute")
        .execute()
        .data
    )


@router.get("/sync-log")
def sync_log(_admin: dict = Depends(require_admin)):
    """Ultime 50 righe di sync_log."""
    return (
        supabase_admin.table("sync_log")
        .select("*")
        .order("id", desc=True)
        .limit(50)
        .execute()
        .data
    )


# --------------------------------------------------------------------------- #
# Sprint 9 — Pronostici di torneo: risoluzione + suggerimenti automatici.
# --------------------------------------------------------------------------- #
class ResolveSpecial(BaseModel):
    correct_answer: dict


@router.put("/special/{code}/resolve")
def resolve_special(code: str, body: ResolveSpecial, _admin: dict = Depends(require_admin)):
    """Risolve una domanda di torneo e assegna i punti (idempotente)."""
    existing = (
        supabase_admin.table("special_questions").select("code").eq("code", code).limit(1).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Domanda non trovata")
    supabase_admin.table("special_questions").update(
        {"resolved": True, "correct_answer": body.correct_answer}
    ).eq("code", code).execute()
    return score_special(code)


@router.get("/special/{code}/suggest")
def suggest_special(code: str, _admin: dict = Depends(require_admin)):
    """Calcola dai dati la risposta probabile, da confermare a mano.

    Dove non calcolabile (dati mancanti / domanda non derivabile) ritorna suggested=None.
    """
    matches = supabase_admin.table("matches").select("*").execute().data

    if code == "most_goals_team":
        scored: dict[str, int] = {}
        for m in matches:
            if m.get("home_score") is not None and m.get("away_score") is not None:
                scored[m["home_team_tla"]] = scored.get(m["home_team_tla"], 0) + m["home_score"]
                scored[m["away_team_tla"]] = scored.get(m["away_team_tla"], 0) + m["away_score"]
        if scored:
            top = max(scored, key=scored.get)
            return {"suggested": {"team_tla": top}, "detail": scored}

    if code == "most_conceded_team":
        conceded: dict[str, int] = {}
        for m in matches:
            if m.get("home_score") is not None and m.get("away_score") is not None:
                conceded[m["home_team_tla"]] = conceded.get(m["home_team_tla"], 0) + m["away_score"]
                conceded[m["away_team_tla"]] = conceded.get(m["away_team_tla"], 0) + m["home_score"]
        if conceded:
            top = max(conceded, key=conceded.get)
            return {"suggested": {"team_tla": top}, "detail": conceded}

    if code == "top_scorer":
        goals = supabase_admin.table("match_goals").select("player_id").execute().data
        cnt: dict[int, int] = {}
        for g in goals:
            if g.get("player_id"):
                cnt[g["player_id"]] = cnt.get(g["player_id"], 0) + 1
        if cnt:
            top = max(cnt, key=cnt.get)
            return {"suggested": {"player_id": top}, "detail": cnt}

    if code == "podium":
        final = next(
            (m for m in matches if m["stage"] == "FINAL" and m["status"] == "FINISHED"), None
        )
        third = next(
            (m for m in matches if m["stage"] == "THIRD_PLACE" and m["status"] == "FINISHED"), None
        )
        podium: list[str] = []
        if final and final.get("home_score") is not None:
            win = (
                final["home_team_tla"]
                if final["home_score"] >= final["away_score"]
                else final["away_team_tla"]
            )
            sec = final["away_team_tla"] if win == final["home_team_tla"] else final["home_team_tla"]
            podium = [win, sec]
            if third and third.get("home_score") is not None:
                trd = (
                    third["home_team_tla"]
                    if third["home_score"] >= third["away_score"]
                    else third["away_team_tla"]
                )
                podium.append(trd)
        if len(podium) == 3:
            return {"suggested": {"podium": podium}}

    return {"suggested": None, "detail": "Da inserire manualmente"}
