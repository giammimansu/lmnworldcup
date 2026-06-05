import sys
import os

# Aggiunge backend/ al path così l'app FastAPI è importabile dalla funzione serverless.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402

# Vercel Python rileva la variabile ASGI `app`.
