from fastapi import APIRouter, Depends

from app.auth import require_admin
from app.database import supabase_admin
from app.services.scoring import score_match

router = APIRouter(prefix="/scoring", tags=["scoring"])


@router.post("/recalculate")
def recalculate_all(_admin: dict = Depends(require_admin)):
    """Ricalcola i punti di tutti i pronostici sulle partite finite (solo admin)."""
    finished = (
        supabase_admin.table("matches").select("id").eq("status", "FINISHED").execute()
    )
    matches_scored = 0
    predictions_updated = 0
    for match in finished.data:
        updated = score_match(match["id"])
        matches_scored += 1
        predictions_updated += updated

    return {
        "matches_scored": matches_scored,
        "predictions_updated": predictions_updated,
    }
