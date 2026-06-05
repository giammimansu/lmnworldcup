# LMN WORLD CUP — Implementation Plan: Sprint 1

> Setup completo dell'infrastruttura. Backend FastAPI, database Supabase con schema
> e RLS, frontend React+Vite, deploy su Vercel. Nessuna logica di business: solo
> un'impalcatura solida e verificabile su cui costruiranno gli sprint successivi.

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 1 deve essere vero **tutto** questo:

1. `uv run uvicorn app.main:app --reload` avvia il backend in locale; `GET /ping`
   risponde `200` con `{"status":"ok","db":true}`.
2. `npm run dev` avvia il frontend; la home mostra lo stato di connessione letto da `/ping`.
3. Le due migration SQL sono pronte e applicate sul progetto Supabase; le tabelle
   `profiles`, `matches`, `predictions`, `sync_log` esistono con RLS attiva.
4. Backend e frontend sono deployati su Vercel e raggiungibili via URL pubblico.
5. Nessun segreto è hardcoded: tutto in `.env` (locale) e Environment Variables (Vercel),
   con `.env.example` versionato.

Niente di più: **niente auth, niente sync partite, niente pronostici**. Quelli sono Sprint 2+.

---

## 1. Prerequisiti (da fare a mano prima di lanciare Claude Code)

- [ ] Progetto creato su [supabase.com](https://supabase.com). Annota da
      *Project Settings → API*: `Project URL`, `anon public key`, `service_role key`.
- [ ] Chiave API gratuita ottenuta su [football-data.org](https://www.football-data.org/client/register)
      (serve dallo Sprint 2, ma mettila già in `.env`).
- [ ] Account [Vercel](https://vercel.com) collegato al tuo GitHub.
- [ ] In locale: Python 3.11+, Node 18+, e [uv](https://docs.astral.sh/uv/) installato
      (`pip install uv` o lo script ufficiale).

---

## 2. Struttura della repo (monorepo)

```
lmn-worldcup/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # entrypoint FastAPI + CORS + router /ping
│   │   ├── config.py            # settings da env (pydantic-settings)
│   │   ├── database.py          # client Supabase anon + service role
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── health.py        # GET /ping
│   │   ├── models/
│   │   │   └── __init__.py      # (vuoto per ora, schemi Pydantic negli sprint dopo)
│   │   └── services/
│   │       └── __init__.py      # (vuoto per ora)
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_rls_policies.sql
│   ├── tests/
│   │   └── test_health.py
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   └── supabase.ts      # client Supabase JS
│   │   └── api/
│   │       └── client.ts        # wrapper fetch verso il backend
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── api/
│   └── index.py                 # entrypoint serverless Vercel → importa app FastAPI
├── vercel.json
├── .gitignore
└── README.md
```

> **Nota sul deploy Vercel**: la cartella `api/` con `index.py` è il pattern con cui Vercel
> espone una funzione serverless Python. `api/index.py` importa l'app da `backend/app/main.py`.
> Il frontend Vite viene buildato come sito statico. Vedi `vercel.json` alla sezione 7.

---

## 3. Backend — contenuti dei file

### `backend/pyproject.toml`

```toml
[project]
name = "lmn-worldcup-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "supabase>=2.4",
    "pydantic-settings>=2.2",
    "httpx>=0.27",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23"]

[tool.pytest.ini_options]
pythonpath = ["."]
```

### `backend/.env.example`

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FOOTBALL_DATA_API_KEY=your_football_data_key
CRON_SECRET=genera_una_stringa_random_lunga 
ALLOWED_ORIGINS=http://localhost:5173
```

### `backend/app/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    football_data_api_key: str = ""
    cron_secret: str = ""
    allowed_origins: str = "http://localhost:5173"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
```

### `backend/app/database.py`

```python
from supabase import create_client, Client
from app.config import settings

# Client con anon key: rispetta le RLS, usato per operazioni "come utente".
supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

# Client service role: bypassa le RLS, usato SOLO per sync e operazioni admin.
supabase_admin: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)


def check_connection() -> bool:
    """Verifica leggera che il DB risponda. Legge una riga da una tabella di sistema."""
    try:
        supabase_admin.table("matches").select("id").limit(1).execute()
        return True
    except Exception:
        return False
```

### `backend/app/routers/health.py`

```python
from fastapi import APIRouter
from app.database import check_connection

router = APIRouter(tags=["health"])


@router.get("/ping")
def ping():
    return {"status": "ok", "db": check_connection()}
```

### `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import health

app = FastAPI(title="LMN World Cup API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)


@app.get("/")
def root():
    return {"name": "LMN World Cup API", "docs": "/docs"}
```

### `backend/tests/test_health.py`

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert "name" in r.json()


def test_ping_shape():
    r = client.get("/ping")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "db" in body
```

---

## 4. Database — migration SQL

> Applicale **in ordine** nel dashboard Supabase: *SQL Editor → New query → incolla → Run*.

### `backend/migrations/001_initial_schema.sql`

```sql
-- Profili utente (estende auth.users di Supabase)
create table if not exists profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    display_name text not null,
    is_admin     boolean not null default false,
    created_at   timestamptz not null default now()
);

-- Partite (id = id di football-data.org)
create table if not exists matches (
    id              bigint primary key,
    utc_date        timestamptz not null,
    status          text not null,            -- TIMED | IN_PLAY | FINISHED ...
    stage           text not null,            -- GROUP_STAGE | LAST_16 | FINAL ...
    matchday        int,
    group_name      text,                     -- GROUP_A ... (null nei knockout)
    home_team_id    bigint,
    home_team_name  text,
    home_team_tla   text,
    home_team_crest text,
    away_team_id    bigint,
    away_team_name  text,
    away_team_tla   text,
    away_team_crest text,
    home_score      int,
    away_score      int,
    last_synced     timestamptz
);

create index if not exists idx_matches_utc_date on matches(utc_date);
create index if not exists idx_matches_stage on matches(stage);

-- Pronostici
create table if not exists predictions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references profiles(id) on delete cascade,
    match_id   bigint not null references matches(id) on delete cascade,
    home_score int not null check (home_score >= 0),
    away_score int not null check (away_score >= 0),
    points     int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, match_id)
);

create index if not exists idx_predictions_user on predictions(user_id);
create index if not exists idx_predictions_match on predictions(match_id);

-- Log delle sincronizzazioni
create table if not exists sync_log (
    id              bigserial primary key,
    run_at          timestamptz not null default now(),
    matches_updated int,
    status          text,
    detail          text
);
```

### `backend/migrations/002_rls_policies.sql`

```sql
-- Abilita RLS su tutte le tabelle con dati utente
alter table profiles    enable row level security;
alter table matches     enable row level security;
alter table predictions enable row level security;

-- PROFILES: ogni utente legge tutti i profili (servono display_name per la classifica),
-- ma può modificare solo il proprio.
create policy "profiles readable by authenticated"
    on profiles for select
    to authenticated
    using (true);

create policy "profiles update own"
    on profiles for update
    to authenticated
    using (id = auth.uid());

-- MATCHES: lettura per tutti gli autenticati. La scrittura avviene solo via service role
-- (che bypassa le RLS), quindi non serve policy di insert/update per gli utenti.
create policy "matches readable by authenticated"
    on matches for select
    to authenticated
    using (true);

-- PREDICTIONS: regola chiave del gioco.
-- Un utente vede i PROPRI pronostici sempre; vede quelli ALTRUI solo dopo che la
-- partita è iniziata (utc_date <= now()). Così nessuno può sbirciare prima del kickoff.
create policy "predictions select own or after kickoff"
    on predictions for select
    to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from matches m
            where m.id = predictions.match_id
              and m.utc_date <= now()
        )
    );

-- Un utente può inserire/modificare/cancellare solo i propri pronostici.
-- (La deadline pre-kickoff verrà imposta lato backend nello Sprint 3.)
create policy "predictions insert own"
    on predictions for insert
    to authenticated
    with check (user_id = auth.uid());

create policy "predictions update own"
    on predictions for update
    to authenticated
    using (user_id = auth.uid());

create policy "predictions delete own"
    on predictions for delete
    to authenticated
    using (user_id = auth.uid());
```

---

## 5. Frontend — contenuti dei file

### `frontend/.env.example`

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000
```

### `frontend/package.json` (dipendenze chiave)

```json
{
  "name": "lmn-worldcup-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

### `frontend/src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey)
```

### `frontend/src/api/client.ts`

```typescript
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL

// Wrapper fetch che inietta automaticamente il JWT Supabase (quando presente).
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}
```

### `frontend/src/App.tsx`

```tsx
import { useEffect, useState } from 'react'
import { apiFetch } from './api/client'

type Ping = { status: string; db: boolean }

export default function App() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [db, setDb] = useState(false)

  useEffect(() => {
    apiFetch<Ping>('/ping')
      .then((r) => {
        setDb(r.db)
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 40 }}>
      <h1>LMN World Cup</h1>
      {state === 'loading' && <p>Connessione al backend…</p>}
      {state === 'ok' && (
        <p>
          Backend connesso. Database: {db ? 'OK' : 'non raggiungibile'}.
        </p>
      )}
      {state === 'error' && <p>Backend non raggiungibile. Controlla VITE_API_URL.</p>}
    </div>
  )
}
```

`frontend/src/main.tsx` è il bootstrap React standard di Vite (renderizza `<App/>`).

---

## 6. File di root

### `.gitignore`

```
# Python
__pycache__/
*.pyc
.venv/
# Node
node_modules/
dist/
# Env & segreti
.env
.env.local
.vercel/
```

### `api/index.py` (entrypoint serverless Vercel)

```python
import sys
import os

# Aggiunge backend/ al path così l'app FastAPI è importabile dalla funzione serverless.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402

# Vercel Python rileva la variabile ASGI `app`.
```

---

## 7. Deploy — `vercel.json`

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/index.py": { "runtime": "@vercel/python@4.3.0" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.py" }
  ]
}
```

> Con questa configurazione: il frontend buildato è servito alla root, e ogni richiesta a
> `/api/...` viene instradata alla funzione FastAPI. In produzione il frontend deve quindi
> chiamare `VITE_API_URL=/api`. Crea un `backend/requirements.txt` (derivato da `pyproject.toml`)
> perché il runtime Python di Vercel installa da lì:
>
> ```
> fastapi>=0.110
> supabase>=2.4
> pydantic-settings>=2.2
> httpx>=0.27
> ```

**Variabili d'ambiente su Vercel** (Project Settings → Environment Variables): inserisci
tutte quelle di `backend/.env.example` e `frontend/.env.example`. In produzione imposta
`VITE_API_URL=/api` e `ALLOWED_ORIGINS` con il dominio Vercel del progetto.

> **Alternativa più semplice se il deploy combinato dà problemi**: crea due progetti Vercel
> separati — uno per `frontend/` (preset Vite) e uno per il backend. È più lineare da debuggare.
> In quel caso `VITE_API_URL` punta all'URL pubblico del backend e `ALLOWED_ORIGINS` include
> il dominio del frontend.

---

## 8. Ordine di esecuzione (cosa deve fare Claude Code, in sequenza)

1. Inizializza la repo e crea l'intera struttura di cartelle della sezione 2.
2. Crea tutti i file backend (sezione 3) e `uv sync` per installare le dipendenze.
3. Crea le due migration SQL (sezione 4) in `backend/migrations/`.
4. Scaffolda il frontend con Vite + React + TS e crea i file della sezione 5.
5. Crea i file di root: `.gitignore`, `api/index.py`, `vercel.json`, `backend/requirements.txt`,
   `README.md`.
6. Scrivi il `README.md` con: setup `.env`, comandi di run locali, applicazione migration,
   deploy su Vercel.
7. Verifica locale (sezione 9) e segnala l'esito di ogni check.

---

## 9. Verifica finale (Claude Code deve confermare ognuno di questi)

- [ ] `cd backend && uv sync` completa senza errori.
- [ ] Con `backend/.env` compilato, `uv run uvicorn app.main:app --reload` parte e
      `curl localhost:8000/ping` ritorna `{"status":"ok","db":true}`
      (db:true richiede che le migration siano state applicate su Supabase).
- [ ] `uv run pytest` passa i test in `tests/test_health.py`.
- [ ] `cd frontend && npm install && npm run dev` parte; aprendo `localhost:5173` la pagina
      mostra "Backend connesso. Database: OK".
- [ ] `npm run build` produce `frontend/dist` senza errori TypeScript.
- [ ] Il `README.md` contiene istruzioni complete e riproducibili.

Quando tutti i check sono verdi, lo Sprint 1 è chiuso e si può passare allo Sprint 2
(autenticazione magic link + sync delle 104 partite).

---

## Note importanti per chi esegue

- **`db:true` dipende da Supabase**: l'endpoint `/ping` legge dalla tabella `matches`, quindi
  deve esistere. Applica le migration su Supabase *prima* di aspettarti `db:true`.
- **Service role key = potere assoluto**: bypassa le RLS. Non esporla mai al frontend, non
  committarla, usala solo nel backend.
- **Versioni**: i numeri di versione qui sono indicativi e aggiornati a inizio 2026; se Claude
  Code trova versioni più recenti compatibili, può usarle. L'importante è che il runtime Python
  di Vercel e `requirements.txt` restino allineati a `pyproject.toml`.