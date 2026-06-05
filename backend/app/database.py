from supabase import create_client, Client

from app.config import settings

# Client con anon key: rispetta le RLS, usato per operazioni "come utente".
supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

# Client service role: bypassa le RLS, usato SOLO per sync e operazioni admin.
# Se la chiave non è configurata, fallback sul client anon (sviluppo locale).
supabase_admin: Client = (
    create_client(settings.supabase_url, settings.supabase_service_role_key)
    if settings.supabase_service_role_key
    else supabase
)


def check_connection() -> bool:
    """Verifica leggera che il DB risponda. Legge una riga dalla tabella matches."""
    try:
        supabase_admin.table("matches").select("id").limit(1).execute()
        return True
    except Exception:
        return False
