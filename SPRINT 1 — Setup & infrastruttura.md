Stai costruendo "LMN World Cup", una webapp privata di pronostici per i Mondiali 2026
tra colleghi. Questo è lo Sprint 1: setup completo dell'infrastruttura.

NOTA DESIGN SYSTEM: va utilizzato come design system il design che trovi in "LMN World Cup Design System".
NOTA FRONTEND: il frontend deve essere visualizzabile da mobile come PWA e anche da PC.

STACK:
- Backend: Python 3.11+ con FastAPI, gestito con uv (usa uv per dipendenze e venv)
- Database: Supabase (PostgreSQL), client supabase-py
- Frontend: React + Vite + TypeScript
- Deploy target: Vercel serverless per il backend, Vercel static per il frontend

CREA QUESTA STRUTTURA DI REPO (monorepo):
/
├── backend/
│   ├── app/
│   │   ├── main.py            (entrypoint FastAPI)
│   │   ├── config.py          (settings da env con pydantic-settings)
│   │   ├── database.py        (client Supabase)
│   │   ├── routers/
│   │   ├── models/            (schemi Pydantic)
│   │   └── services/
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/supabase.ts
│   │   ├── api/client.ts      (wrapper fetch verso il backend)
│   │   └── components/
│   ├── package.json
│   └── .env.example
├── vercel.json
└── README.md

TASK BACKEND:
1. Inizializza FastAPI con CORS abilitato (per ora permetti localhost:5173 e il dominio Vercel).
2. config.py legge da env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
   FOOTBALL_DATA_API_KEY. Usa pydantic-settings.
3. database.py espone due client Supabase: uno con anon key (operazioni utente) e uno con
   service role key (operazioni admin/sync, bypassa RLS).
4. Endpoint GET /ping che ritorna {"status": "ok", "db": true/false} verificando la
   connessione a Supabase.

TASK DATABASE — genera un file backend/migrations/001_initial_schema.sql con queste tabelle:
- profiles (id uuid PK ref auth.users, email text, display_name text, is_admin bool default false, created_at timestamptz)
- matches (id bigint PK = id football-data, utc_date timestamptz, status text, stage text,
  matchday int, group_name text, home_team_id bigint, home_team_name text, home_team_tla text,
  home_team_crest text, away_team_id bigint, away_team_name text, away_team_tla text,
  away_team_crest text, home_score int null, away_score int null, last_synced timestamptz)
- predictions (id uuid PK default gen_random_uuid(), user_id uuid ref profiles, match_id bigint
  ref matches, home_score int, away_score int, points int null, created_at timestamptz,
  updated_at timestamptz, UNIQUE(user_id, match_id))
- sync_log (id bigserial PK, run_at timestamptz, matches_updated int, status text, detail text)

Poi genera 002_rls_policies.sql con Row Level Security:
- profiles: ogni utente legge il proprio profilo e quello pubblico degli altri (solo display_name)
- predictions: un utente vede SOLO i propri pronostici. Eccezione importante: i pronostici
  altrui su una partita diventano visibili a tutti SOLO dopo che la partita è iniziata
  (utc_date < now()). Implementa questa logica nella policy SELECT.
- matches: lettura pubblica per utenti autenticati, scrittura solo service role.

TASK FRONTEND:
1. Inizializza Vite + React + TypeScript.
2. lib/supabase.ts: client Supabase JS configurato da env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
3. api/client.ts: wrapper fetch con base URL del backend (VITE_API_URL) che inietta
   automaticamente il JWT token Supabase nell'header Authorization.
4. App.tsx minimale che chiama GET /ping e mostra lo stato di connessione.

TASK DEPLOY:
1. vercel.json configurato per servire il backend FastAPI come serverless function Python
   (usa @vercel/python) sotto /api e il frontend buildato sotto /.
2. README.md con istruzioni passo-passo: setup env, run locale (backend e frontend),
   deploy su Vercel.

CRITERI DI COMPLETAMENTO:
- `uv run uvicorn app.main:app --reload` avvia il backend, GET /ping risponde 200 con db:true
- `npm run dev` avvia il frontend e mostra "Connesso" leggendo /ping
- Le migration SQL sono pronte da incollare nell'SQL editor di Supabase
- Tutti i segreti sono in .env.example (mai valori reali nel codice)

NON fare ancora: autenticazione, sync partite, logica pronostici. Solo l'impalcatura.