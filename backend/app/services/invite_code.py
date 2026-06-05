"""Generazione codici invito lega."""
import secrets

from app.database import supabase_admin

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # niente 0/O/1/I ambigui


def generate_unique_code() -> str:
    """Codice tipo 'WC26-X7K2P'. Riprova in caso di collisione (rarissima)."""
    for _ in range(10):
        code = "WC26-" + "".join(secrets.choice(_ALPHABET) for _ in range(5))
        exists = (
            supabase_admin.table("leagues")
            .select("id")
            .eq("invite_code", code)
            .execute()
            .data
        )
        if not exists:
            return code
    raise RuntimeError("Impossibile generare un codice univoco")
