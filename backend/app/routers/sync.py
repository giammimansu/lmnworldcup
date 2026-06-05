from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth import require_admin
from app.config import settings
from app.services.sync import sync_matches

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/matches")
async def sync_matches_manual(_admin: dict = Depends(require_admin)):
    """Trigger manuale della sincronizzazione (solo admin)."""
    return await sync_matches()


@router.get("/cron")
async def sync_matches_cron(authorization: str | None = Header(default=None)):
    """Endpoint per il cron Vercel. Protetto da CRON_SECRET (header Authorization: Bearer <secret>).

    Idempotente: l'upsert per id non duplica mai le partite.
    """
    if not settings.cron_secret:
        raise HTTPException(status_code=503, detail="CRON_SECRET non configurato")
    if authorization != f"Bearer {settings.cron_secret}":
        raise HTTPException(status_code=401, detail="Secret non valido")
    return await sync_matches()
