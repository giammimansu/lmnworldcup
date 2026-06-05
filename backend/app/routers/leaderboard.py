from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.config import settings
from app.services.leaderboard import compute_leaderboard, save_snapshot

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


class LeaderboardRow(BaseModel):
    position: int
    user_id: str
    display_name: str
    points: int
    exact_count: int
    accuracy: float
    trend: int


@router.get("", response_model=list[LeaderboardRow])
def leaderboard(_user: dict = Depends(get_current_user)):
    """Classifica completa ordinata per punti totali."""
    return compute_leaderboard()


@router.get("/snapshot/cron")
def snapshot_cron(authorization: str | None = Header(default=None)):
    """Cron Vercel a mezzanotte: salva lo snapshot giornaliero (per il trend)."""
    if not settings.cron_secret:
        raise HTTPException(status_code=503, detail="CRON_SECRET non configurato")
    if authorization != f"Bearer {settings.cron_secret}":
        raise HTTPException(status_code=401, detail="Secret non valido")
    saved = save_snapshot()
    return {"status": "ok", "users_saved": saved}
