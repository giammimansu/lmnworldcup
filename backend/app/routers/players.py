"""Sprint 8 — Rosa giocatori per il dropdown marcatore."""
from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/teams")
def list_teams(_user: dict = Depends(get_current_user)):
    """Nazionali distinte (tla + nome), ordinate per nome. Per i dropdown dei
    pronostici di torneo (squadra / podio)."""
    rows = (
        supabase_admin.table("players")
        .select("team_tla, team_name")
        .order("team_name")
        .limit(5000)
        .execute()
        .data
    )
    seen: dict[str, str] = {}
    for r in rows:
        tla = r.get("team_tla")
        if tla and tla not in seen:
            seen[tla] = r.get("team_name") or tla
    return [{"team_tla": tla, "team_name": name} for tla, name in seen.items()]


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
    return q.order("shirt_number").limit(5000).execute().data
