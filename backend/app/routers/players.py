"""Sprint 8 — Rosa giocatori per il dropdown marcatore."""
from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/teams")
def list_teams(_user: dict = Depends(get_current_user)):
    """Nazionali distinte (tla + nome), ordinate per nome. Per i dropdown dei
    pronostici di torneo (squadra / podio).

    Derivate da `matches` (non da `players`): la fase a gironi contiene tutte le
    48 squadre in ~104 righe, ben sotto il limite di 1000 righe di PostgREST —
    con `players` (>1000 righe) alcune nazionali venivano troncate."""
    rows = (
        supabase_admin.table("matches")
        .select("home_team_tla, home_team_name, away_team_tla, away_team_name")
        .execute()
        .data
    )
    seen: dict[str, str] = {}
    for r in rows:
        for tla, name in (
            (r.get("home_team_tla"), r.get("home_team_name")),
            (r.get("away_team_tla"), r.get("away_team_name")),
        ):
            if tla and tla not in seen:
                seen[tla] = name or tla
    return sorted(
        ({"team_tla": tla, "team_name": name} for tla, name in seen.items()),
        key=lambda t: t["team_name"],
    )


@router.get("")
def list_players(
    _user: dict = Depends(get_current_user),
    team_tla: str | None = Query(default=None),
):
    """Lista giocatori, opzionalmente filtrata per nazionale (team_tla).

    Pagina con range(): senza filtro i giocatori sono >1000 e PostgREST tronca
    le risposte a 1000 righe (ignora .limit), tagliando fuori alcune nazionali."""
    cols = "id, name, position, shirt_number, team_tla, team_name"
    PAGE = 1000
    out: list[dict] = []
    start = 0
    while True:
        q = supabase_admin.table("players").select(cols)
        if team_tla:
            q = q.eq("team_tla", team_tla)
        # order su id (unico): shirt_number non è unico -> paginazione instabile.
        batch = q.order("id").range(start, start + PAGE - 1).execute().data
        out.extend(batch)
        if len(batch) < PAGE:
            break
        start += PAGE
    return out
