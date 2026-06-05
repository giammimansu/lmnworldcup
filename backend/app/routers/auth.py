from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_admin
from app.config import settings
from app.database import supabase_admin
from app.models.auth import InviteRequest, InviteResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/invite", response_model=InviteResponse)
def invite_user(body: InviteRequest, _admin: dict = Depends(require_admin)):
    """Invita un collega: invia il magic link via Supabase Auth admin API.

    Il profilo in `profiles` viene creato automaticamente dal trigger
    on_auth_user_created (003_auth_trigger.sql) quando l'utente compare
    in auth.users.
    """
    redirect_to = settings.origins_list[0] if settings.origins_list else None
    try:
        supabase_admin.auth.admin.invite_user_by_email(
            body.email,
            options={
                "data": {"display_name": body.display_name or body.email.split("@")[0]},
                **({"redirect_to": redirect_to} if redirect_to else {}),
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invito fallito: {exc}")

    return InviteResponse(email=body.email, invited=True, detail="Magic link inviato")
