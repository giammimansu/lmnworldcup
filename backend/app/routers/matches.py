from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.database import supabase_admin
from app.models.matches import Match

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[Match])
def list_matches(
    date_filter: date | None = Query(default=None, alias="date"),
    stage: str | None = None,
    group: str | None = None,
    matchday: int | None = None,
    _user: dict = Depends(get_current_user),
):
    """Lista partite con filtri opzionali, ordinate per utc_date."""
    query = supabase_admin.table("matches").select("*")

    if date_filter is not None:
        day_start = datetime.combine(date_filter, time.min, tzinfo=timezone.utc)
        day_end = datetime.combine(date_filter, time.max, tzinfo=timezone.utc)
        query = query.gte("utc_date", day_start.isoformat()).lte(
            "utc_date", day_end.isoformat()
        )
    if stage:
        query = query.eq("stage", stage)
    if group:
        query = query.eq("group_name", group)
    if matchday is not None:
        query = query.eq("matchday", matchday)

    result = query.order("utc_date").execute()
    return result.data


@router.get("/{match_id}", response_model=Match)
def get_match(match_id: int, _user: dict = Depends(get_current_user)):
    """Dettaglio singola partita."""
    result = (
        supabase_admin.table("matches").select("*").eq("id", match_id).limit(1).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    return result.data[0]
