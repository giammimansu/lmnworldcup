"""Sprint 8 — Rosa giocatori per il dropdown marcatore."""
from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/players", tags=["players"])


@router.get("")
def list_players(
    _user: dict = Depends(get_current_user),
    team_tla: str | None = Query(default=None),
):
    """Lista giocatori, opzionalmente filtrata per nazionale (team_tla)."""
    q = supabase_admin.table("players").select(
        "id, name, position, shirt_number, team_tla, team_name"
    )
    if team_tla:
        q = q.eq("team_tla", team_tla)
    return q.order("shirt_number").execute().data
