from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import supabase_admin
from app.services.achievements import get_user_achievements
from app.services.stats import compute_user_stats

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/stats")
def my_stats(user: dict = Depends(get_current_user)):
    """Statistiche dettagliate dell'utente corrente."""
    stats = compute_user_stats(user["id"], public=False)
    stats["display_name"] = user["display_name"]
    return stats


@router.get("/me/achievements")
def my_achievements(user: dict = Depends(get_current_user)):
    """Badge sbloccati + da sbloccare."""
    return get_user_achievements(user["id"])


@router.get("/{user_id}/stats")
def public_stats(user_id: str, _user: dict = Depends(get_current_user)):
    """Profilo pubblico di un collega: stesse statistiche ma senza pronostici pending."""
    profile = (
        supabase_admin.table("profiles")
        .select("id, display_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    stats = compute_user_stats(user_id, public=True)
    stats["display_name"] = profile.data[0]["display_name"]
    return stats
