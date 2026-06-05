# LMN WORLD CUP — Implementation Plan: Sprint 2

> Autenticazione utenti (magic link Supabase, niente password) e sincronizzazione
> automatica delle partite da football-data.org. In più: import statico delle rose
> (tabella `players`), necessario per i pronostici sui marcatori dello Sprint 3.
>
> **Prerequisito**: lo Sprint 1 è completo e tutti i suoi check sono verdi
> (infra FastAPI, schema DB + RLS, frontend Vite, deploy Vercel funzionante).

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 2 deve essere vero **tutto** questo:

1. Un admin può invitare un collega via email; il collega riceve un magic link, clicca
   ed entra nell'app autenticato (nessuna password).
2. `POST /sync/matches` (admin) popola la tabella `matches` con tutte le 104 partite
   del Mondiale 2026; rieseguirlo aggiorna i dati senza duplicare (upsert idempotente).
3. Le rose delle 48 squadre sono caricate nella tabella `players` da un `squads.json`
   statico, tramite uno script una-tantum.
4. `GET /matches` ritorna le partite con filtri (`?date=`, `?stage=`, `?group=`, `?matchday=`);
   `GET /matches/{id}` ritorna il dettaglio.
5. Un cron Vercel chiama l'endpoint di sync periodicamente (protetto da `CRON_SECRET`).
6. Il frontend ha login funzionante, sessione persistente, route protette, e una schermata
   "Partite" che lista i match del giorno con orari nel fuso locale dell'utente.

Niente ancora: pronostici, calcolo punti, classifica. Quelli sono Sprint 3+.

---

## 1. Prerequisiti di configurazione (Supabase dashboard)

- [ ] In *Authentication → Providers*: abilita **Email** e attiva **Magic Link**
      (disabilita "Confirm email" con password se non serve).
- [ ] In *Authentication → URL Configuration*: imposta `Site URL` al dominio del frontend
      (in locale `http://localhost:5173`, in prod il dominio Vercel) e aggiungi entrambi
      ai *Redirect URLs*.
- [ ] In *Authentication → Email Templates*: personalizza il template "Magic Link" col nome
      LMN World Cup (opzionale ma carino).
- [ ] Verifica di avere `FOOTBALL_DATA_API_KEY` valida in `backend/.env`.

---

## 2. Nuove migration SQL

> Applicale dopo le `001` e `002` dello Sprint 1, in ordine.

### `backend/migrations/003_auth_trigger.sql`

```sql
-- Quando un nuovo utente viene creato in auth.users, crea automaticamente il profilo.
-- display_name di default dalla parte locale dell'email; modificabile poi dall'utente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### `backend/migrations/004_players.sql`

```sql
-- Rose delle squadre (caricate da squads.json, statiche per tutto il torneo).
create table if not exists players (
    id          bigserial primary key,
    team_id     bigint,                 -- id squadra football-data (per collegare ai match)
    team_tla    text not null,          -- es. BRA, GER (chiave pratica per import)
    team_name   text not null,
    name        text not null,
    position    text,                   -- Goalkeeper | Defender | Midfielder | Forward
    shirt_number int,
    created_at  timestamptz not null default now()
);

create index if not exists idx_players_team_tla on players(team_tla);

alter table players enable row level security;

create policy "players readable by authenticated"
    on players for select
    to authenticated
    using (true);
-- Scrittura solo via service role (import script). Nessuna policy di insert per utenti.
```

---

## 3. Backend — autenticazione

### `backend/app/deps.py` (dependency di autenticazione)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import supabase, supabase_admin

bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """Valida il JWT Supabase e ritorna il profilo utente dal DB."""
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token mancante")
    token = creds.credentials
    try:
        user_resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token non valido")
    if not user_resp or not user_resp.user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token non valido")

    uid = user_resp.user.id
    profile = (
        supabase_admin.table("profiles").select("*").eq("id", uid).single().execute()
    )
    if not profile.data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Profilo non trovato")
    return profile.data


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Permessi admin richiesti")
    return user
```

### `backend/app/routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from app.deps import require_admin, get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/auth", tags=["auth"])


class InviteRequest(BaseModel):
    email: EmailStr
    display_name: str | None = None
    is_admin: bool = False


@router.post("/invite")
def invite_user(req: InviteRequest, admin: dict = Depends(require_admin)):
    """Invita un collega via magic link. Crea l'utente in auth.users (il trigger
    crea il profilo). Solo admin."""
    try:
        meta = {"display_name": req.display_name} if req.display_name else {}
        res = supabase_admin.auth.admin.invite_user_by_email(
            req.email, options={"data": meta}
        )
    except Exception as e:
        raise HTTPException(400, f"Invito fallito: {e}")

    # Se richiesto admin, aggiorna il profilo appena creato dal trigger.
    if req.is_admin and res.user:
        supabase_admin.table("profiles").update({"is_admin": True}).eq(
            "id", res.user.id
        ).execute()

    return {"invited": req.email, "is_admin": req.is_admin}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return user
```

> **Nota**: l'invito vero e proprio (l'email col magic link) è gestito da Supabase.
> In locale, se l'SMTP di default non invia, usa *Authentication → Users → Invite* dal
> dashboard per i primi test, oppure configura un SMTP custom. La logica dell'endpoint
> resta valida in produzione.

---

## 4. Backend — sincronizzazione partite

### `backend/app/services/football_api.py`

```python
import asyncio
import httpx
from app.config import settings

BASE_URL = "https://api.football-data.org/v4"
WC_PATH = "/competitions/WC/matches"


async def fetch_wc_matches(season: int = 2026) -> dict:
    """Scarica tutte le partite del Mondiale. Gestisce il rate limit (429) con retry."""
    headers = {"X-Auth-Token": settings.football_data_api_key}
    params = {"season": season}

    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(4):
            r = await client.get(BASE_URL + WC_PATH, headers=headers, params=params)
            if r.status_code == 429:
                wait = 6 * (attempt + 1)  # backoff progressivo
                await asyncio.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
    raise RuntimeError("Rate limit football-data.org: troppi 429 consecutivi")
```

### `backend/app/services/sync.py`

```python
from datetime import datetime, timezone
from app.database import supabase_admin
from app.services.football_api import fetch_wc_matches


def _map_match(m: dict) -> dict:
    score = m.get("score", {}).get("fullTime", {})
    home, away = m.get("homeTeam") or {}, m.get("awayTeam") or {}
    return {
        "id": m["id"],
        "utc_date": m["utcDate"],
        "status": m["status"],
        "stage": m.get("stage", ""),
        "matchday": m.get("matchday"),
        "group_name": m.get("group"),
        "home_team_id": home.get("id"),
        "home_team_name": home.get("name"),
        "home_team_tla": home.get("tla"),
        "home_team_crest": home.get("crest"),
        "away_team_id": away.get("id"),
        "away_team_name": away.get("name"),
        "away_team_tla": away.get("tla"),
        "away_team_crest": away.get("crest"),
        "home_score": score.get("home"),
        "away_score": score.get("away"),
        "last_synced": datetime.now(timezone.utc).isoformat(),
    }


async def sync_matches() -> dict:
    """Scarica e fa upsert di tutte le partite. Idempotente (chiave: id)."""
    try:
        data = await fetch_wc_matches()
        rows = [_map_match(m) for m in data.get("matches", [])]

        # Rileva quali partite passano a FINISHED in questo sync (utile allo Sprint 3
        # per il calcolo punti; per ora solo loggato).
        if rows:
            supabase_admin.table("matches").upsert(rows, on_conflict="id").execute()

        result = {"matches_updated": len(rows), "status": "ok", "detail": None}
    except Exception as e:
        result = {"matches_updated": 0, "status": "error", "detail": str(e)}

    supabase_admin.table("sync_log").insert(result).execute()
    return result
```

### `backend/app/routers/sync.py`

```python
from fastapi import APIRouter, Depends, Header, HTTPException
from app.deps import require_admin
from app.services.sync import sync_matches
from app.config import settings

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/matches")
async def sync_now(admin: dict = Depends(require_admin)):
    """Trigger manuale del sync. Solo admin."""
    return await sync_matches()


@router.get("/cron")
async def sync_cron(x_cron_secret: str = Header(default="")):
    """Endpoint chiamato dal cron Vercel. Protetto da secret header."""
    if not settings.cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(401, "Cron secret non valido")
    return await sync_matches()
```

### `backend/app/routers/matches.py`

```python
from fastapi import APIRouter, Depends, Query, HTTPException
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("")
def list_matches(
    user: dict = Depends(get_current_user),
    date: str | None = Query(default=None, description="YYYY-MM-DD"),
    stage: str | None = None,
    group: str | None = None,
    matchday: int | None = None,
):
    q = supabase_admin.table("matches").select("*")
    if date:
        q = q.gte("utc_date", f"{date}T00:00:00Z").lte("utc_date", f"{date}T23:59:59Z")
    if stage:
        q = q.eq("stage", stage)
    if group:
        q = q.eq("group_name", group)
    if matchday is not None:
        q = q.eq("matchday", matchday)
    res = q.order("utc_date").execute()
    return res.data


@router.get("/{match_id}")
def get_match(match_id: int, user: dict = Depends(get_current_user)):
    res = supabase_admin.table("matches").select("*").eq("id", match_id).execute()
    if not res.data:
        raise HTTPException(404, "Partita non trovata")
    return res.data[0]
```

### Registra i nuovi router in `app/main.py`

```python
from app.routers import health, auth, sync, matches

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(matches.router)
```

---

## 5. Import rose — `squads.json` e script

### `backend/data/squads.json` (formato atteso)

```json
[
  {
    "team_tla": "BRA",
    "team_name": "Brazil",
    "team_id": 764,
    "players": [
      { "name": "Alisson", "position": "Goalkeeper", "shirt_number": 1 },
      { "name": "Vinicius Junior", "position": "Forward", "shirt_number": 7 }
    ]
  }
]
```

> Le 48 rose vanno compilate da fonti pubbliche (lista convocati ufficiale FIFA / Wikipedia).
> Posso generarti io il file completo: chiedimelo a parte.

### `backend/scripts/import_squads.py`

```python
import json
from pathlib import Path
from app.database import supabase_admin

DATA = Path(__file__).parent.parent / "data" / "squads.json"


def import_squads():
    squads = json.loads(DATA.read_text(encoding="utf-8"))
    rows = []
    for team in squads:
        for p in team["players"]:
            rows.append({
                "team_id": team.get("team_id"),
                "team_tla": team["team_tla"],
                "team_name": team["team_name"],
                "name": p["name"],
                "position": p.get("position"),
                "shirt_number": p.get("shirt_number"),
            })
    # Pulisce e ricarica (le rose sono statiche, full refresh va bene).
    supabase_admin.table("players").delete().neq("id", 0).execute()
    supabase_admin.table("players").insert(rows).execute()
    print(f"Importati {len(rows)} giocatori da {len(squads)} squadre.")


if __name__ == "__main__":
    import_squads()
```

Esecuzione una-tantum: `cd backend && uv run python -m scripts.import_squads`.

---

## 6. Frontend — autenticazione e partite

### `frontend/src/auth/AuthContext.tsx`

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthCtx = createContext<AuthState>({} as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setIsAdmin(false); return }
    supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      .then(({ data }) => setIsAdmin(!!data?.is_admin))
  }, [session])

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <AuthCtx.Provider value={{ session, loading, isAdmin, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
```

### `frontend/src/auth/Login.tsx`

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setErr(error.message)
    else setSent(true)
  }

  if (sent) return <p>Controlla la tua email: ti abbiamo inviato un link per accedere.</p>

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui' }}>
      <h1>LMN World Cup</h1>
      <input
        type="email" placeholder="la-tua@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 10 }}
      />
      <button onClick={send} style={{ width: '100%', padding: 10, marginTop: 8 }}>
        Invia link di accesso
      </button>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </div>
  )
}
```

### `frontend/src/auth/ProtectedRoute.tsx`

```tsx
import { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import Login from './Login'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <p>Caricamento…</p>
  if (!session) return <Login />
  return <>{children}</>
}
```

### `frontend/src/api/matches.ts`

```typescript
import { apiFetch } from './client'

export type Match = {
  id: number
  utc_date: string
  status: string
  stage: string
  group_name: string | null
  home_team_name: string
  home_team_tla: string
  home_team_crest: string
  away_team_name: string
  away_team_tla: string
  away_team_crest: string
  home_score: number | null
  away_score: number | null
}

export function getMatches(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return apiFetch<Match[]>(`/matches${qs ? `?${qs}` : ''}`)
}
```

### `frontend/src/screens/Matches.tsx`

```tsx
import { useEffect, useState } from 'react'
import { getMatches, Match } from '../api/matches'

const today = () => new Date().toISOString().slice(0, 10)

function localTime(utc: string) {
  return new Date(utc).toLocaleString(undefined, {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
  })
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([])
  const [date, setDate] = useState(today())

  useEffect(() => { getMatches({ date }).then(setMatches) }, [date])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 20 }}>
      <h2>Partite</h2>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {matches.length === 0 && <p>Nessuna partita in questa data.</p>}
      {matches.map((m) => (
        <div key={m.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, margin: '8px 0' }}>
          <small>{m.group_name ?? m.stage} · {localTime(m.utc_date)} · {m.status}</small>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{m.home_team_name}</span>
            <strong>{m.home_score ?? '-'} : {m.away_score ?? '-'}</strong>
            <span>{m.away_team_name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Aggancia tutto in `App.tsx`

```tsx
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Matches from './screens/Matches'

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Matches />
      </ProtectedRoute>
    </AuthProvider>
  )
}
```

---

## 7. Cron Vercel — aggiornamento di `vercel.json`

Aggiungi la sezione `crons` al `vercel.json` esistente:

```json
{
  "crons": [
    { "path": "/api/sync/cron", "schedule": "*/15 * * * *" }
  ]
}
```

> Vercel chiama il path ogni 15 minuti. L'endpoint `/sync/cron` richiede l'header
> `x-cron-secret`. **Importante**: i cron Vercel non inviano header custom automaticamente;
> il pattern consigliato è proteggere con un token nell'URL o configurare il secret via
> *Vercel → Settings → Environment Variables* e leggerlo nella funzione. In alternativa,
> per il free tier Vercel (1 cron/giorno sui piani hobby), valuta **Supabase scheduled
> functions / pg_cron** per il polling più frequente. Documenta la scelta nel README.
> Per il torneo va benissimo anche un cron giornaliero + sync manuale nei giorni di partita.

---

## 8. Ordine di esecuzione (cosa fa Claude Code)

1. Applica le migration `003` e `004` (le genera in `backend/migrations/`).
2. Crea `app/deps.py` con le dependency di auth.
3. Crea i router `auth.py`, `sync.py`, `matches.py` e registrali in `main.py`.
4. Crea i service `football_api.py` e `sync.py`.
5. Crea `data/squads.json` (placeholder con 2-3 squadre se le rose complete non ci sono
   ancora) e `scripts/import_squads.py`.
6. Frontend: crea `auth/AuthContext.tsx`, `auth/Login.tsx`, `auth/ProtectedRoute.tsx`,
   `api/matches.ts`, `screens/Matches.tsx`, e aggiorna `App.tsx`.
7. Aggiorna `vercel.json` con la sezione `crons`.
8. Aggiorna il README con: come invitare utenti, come lanciare il sync, come importare le rose.
9. Esegui la verifica (sezione 9) e riporta l'esito di ogni check.

---

## 9. Verifica finale

- [ ] Migration `003` e `004` applicate; tabella `players` esiste e ha RLS attiva.
- [ ] Promuovi a mano il tuo utente ad admin in Supabase
      (`update profiles set is_admin = true where email = 'tua@email.com'`),
      poi `GET /auth/me` ritorna `is_admin: true` col tuo token.
- [ ] `POST /sync/matches` (con token admin) ritorna `matches_updated: 104` e popola
      la tabella `matches`. Una seconda chiamata non crea duplicati.
- [ ] `GET /matches?date=2026-06-11` ritorna le partite di quella data.
- [ ] `uv run python -m scripts.import_squads` popola la tabella `players`.
- [ ] Frontend: inserendo l'email ricevo il magic link, clicco, entro e vedo la schermata
      "Partite" con gli orari nel mio fuso orario.
- [ ] Senza sessione, l'app mostra il login (route protetta funzionante).
- [ ] `GET /sync/cron` senza secret corretto ritorna 401; col secret giusto esegue il sync.

Quando tutti i check sono verdi, lo Sprint 2 è chiuso. Si passa allo Sprint 3:
sistema di pronostici, deadline lato server e calcolo punti.

---

## Note importanti

- **Validazione JWT**: `get_current_user` usa `supabase.auth.get_user(token)`, che valida
  il token contro Supabase. È robusto ma fa una chiamata di rete per richiesta; per un gioco
  tra colleghi è perfettamente accettabile. Se in futuro il volume crescesse, si può passare
  alla verifica locale della firma JWT col secret del progetto.
- **Email in locale**: l'SMTP di default di Supabase ha limiti stretti e in dev può non
  recapitare. Per i primi test invita gli utenti dal dashboard Supabase. In produzione
  configura un SMTP (Resend, SendGrid) in *Authentication → Email*.
- **Idempotenza del sync**: l'upsert su chiave `id` garantisce che rieseguire il sync
  aggiorni i dati senza duplicare. È la proprietà che rende sicuro farlo girare ogni 15 minuti.
- **Rose statiche**: `import_squads.py` fa un full refresh (delete + insert). Va bene perché
  le rose non cambiano durante il torneo. Se un giocatore viene sostituito per infortunio,
  aggiorni il JSON e rilanci lo script.