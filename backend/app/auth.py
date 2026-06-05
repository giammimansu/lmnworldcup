"""Dipendenze FastAPI per autenticazione via JWT Supabase."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import supabase, supabase_admin

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    """Valida il JWT Supabase dall'header Authorization e ritorna il profilo utente."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token mancante",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        auth_response = supabase.auth.get_user(token)
        user = auth_response.user
    except Exception:
        user = None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Carica il profilo (service role: il profilo serve sempre, anche se RLS cambia)
    result = (
        supabase_admin.table("profiles").select("*").eq("id", user.id).limit(1).execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Profilo non trovato",
        )

    return result.data[0]


def require_admin(profile: dict = Depends(get_current_user)) -> dict:
    """Estende get_current_user verificando is_admin."""
    if not profile.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operazione riservata agli admin",
        )
    return profile
