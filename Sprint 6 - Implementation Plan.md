# LMN WORLD CUP — Implementation Plan: Sprint 6 (Leghe private)

> Aggiunge le leghe private sopra l'app esistente: ogni utente può creare la propria
> lega, invitare gli amici con un codice, e vedere una classifica ristretta ai membri.
> I pronostici e il calcolo punti **non cambiano**: un pronostico vale in tutte le leghe
> a cui partecipi. Cambia solo come si aggregano le classifiche.
>
> **Prerequisito**: Sprint 1-5 completi e funzionanti.

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 6 deve essere vero **tutto** questo:

1. Un utente può **registrarsi liberamente** (magic link self-service, senza invito admin).
2. Un utente può **creare una lega**; il sistema genera un **codice invito** univoco.
3. Un utente può **unirsi a una lega** inserendo il codice (o aprendo un link).
4. Un utente può stare in **più leghe** contemporaneamente e switchare tra esse.
5. La classifica è **ristretta ai membri della lega selezionata** (con trend coerente).
6. Il **proprietario** della lega può rinominarla, rigenerare il codice e rimuovere membri;
   un membro può uscire dalla lega.
7. **Privacy**: un utente vede solo le leghe di cui è membro e i relativi membri; le leghe
   altrui non sono visibili (garantito da RLS).

Cosa NON cambia: pronostici, deadline, scoring, marcatori, tabellone. Restano identici.

---

## 1. Modello concettuale (da tenere a mente)

- **Pronostico globale**: l'utente pronostica una partita una volta sola. Quel pronostico
  genera i suoi punti, indipendenti dalle leghe.
- **Classifica per lega**: ogni lega ordina i propri membri in base agli **stessi** punti
  totali, filtrati sui soli membri.
- **Tre ruoli**:
  - *app-admin* (tu): sync partite, override risultati, marcatori. Funzioni globali (Sprint 5).
  - *proprietario di lega*: gestisce la sua lega. Nessun potere sui dati del torneo.
  - *membro*: partecipa, pronostica, vede la classifica della lega.

---

## 2. Cambio di modello accesso (self-service)

Nello Sprint 2 l'accesso era "solo admin invita". Con le leghe diventa self-service:

- Il magic link (`signInWithOtp`) **già** crea l'utente se non esiste; il trigger
  `handle_new_user` (Sprint 2) crea il profilo. Quindi a livello di codice basta **non gateare**
  la registrazione.
- In Supabase *Authentication → Providers → Email*: assicurati che le **signup pubbliche siano
  abilitate** (non solo invito).
- L'endpoint `POST /auth/invite` dello Sprint 2 resta utile solo per nominare app-admin; non è
  più la porta d'ingresso obbligatoria.

> Nota: l'app-admin resta una proprietà del profilo (`is_admin`). Le leghe sono indipendenti
> dal flag admin globale.

---

## 3. Nuove migration SQL

### `backend/migrations/008_leagues.sql`

```sql
create table if not exists leagues (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    owner_id    uuid not null references profiles(id) on delete cascade,
    invite_code text not null unique,
    created_at  timestamptz not null default now()
);

create table if not exists league_members (
    league_id uuid not null references leagues(id) on delete cascade,
    user_id   uuid not null references profiles(id) on delete cascade,
    joined_at timestamptz not null default now(),
    primary key (league_id, user_id)
);

create index if not exists idx_league_members_user on league_members(user_id);

-- Helper SECURITY DEFINER per verificare l'appartenenza senza ricorsione nelle policy.
create or replace function public.is_league_member(lid uuid, uid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from league_members
    where league_id = lid and user_id = uid
  );
$$;

alter table leagues        enable row level security;
alter table league_members enable row level security;

-- LEAGUES: vedi una lega solo se ne sei membro (o proprietario).
create policy "leagues visible to members" on leagues
    for select to authenticated
    using (owner_id = auth.uid() or public.is_league_member(id, auth.uid()));

-- Creazione: chiunque, ma deve essere owner di se stesso.
create policy "leagues insert own" on leagues
    for insert to authenticated
    with check (owner_id = auth.uid());

-- Modifica/eliminazione: solo il proprietario.
create policy "leagues update owner" on leagues
    for update to authenticated using (owner_id = auth.uid());
create policy "leagues delete owner" on leagues
    for delete to authenticated using (owner_id = auth.uid());

-- LEAGUE_MEMBERS: vedi i membri delle leghe di cui fai parte.
create policy "members visible to co-members" on league_members
    for select to authenticated
    using (public.is_league_member(league_id, auth.uid()));

-- Un utente può aggiungere SOLO se stesso (join). La rimozione altrui la fa il backend
-- con service role (controllo owner lato API).
create policy "members insert self" on league_members
    for insert to authenticated
    with check (user_id = auth.uid());

create policy "members delete self" on league_members
    for delete to authenticated
    using (user_id = auth.uid());
```

> La gestione "owner rimuove un membro" passa dal backend con service role (bypassa RLS) dopo
> aver verificato che il chiamante sia il proprietario. La policy `members delete self` copre
> invece il caso "esco dalla lega da solo".

---

## 4. Backend — leghe

### `backend/app/services/invite_code.py`

```python
import secrets
import string
from app.database import supabase_admin

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # niente 0/O/1/I ambigui


def generate_unique_code() -> str:
    """Codice tipo 'WC26-X7K2P'. Riprova in caso di collisione (rarissima)."""
    for _ in range(10):
        code = "WC26-" + "".join(secrets.choice(_ALPHABET) for _ in range(5))
        exists = supabase_admin.table("leagues").select("id").eq(
            "invite_code", code
        ).execute().data
        if not exists:
            return code
    raise RuntimeError("Impossibile generare un codice univoco")
```

### `backend/app/routers/leagues.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import date, timedelta
from app.deps import get_current_user
from app.database import supabase_admin
from app.services.invite_code import generate_unique_code

router = APIRouter(prefix="/leagues", tags=["leagues"])


class LeagueCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)


class JoinRequest(BaseModel):
    invite_code: str


class RenameRequest(BaseModel):
    name: str = Field(min_length=2, max_length=40)


@router.post("")
def create_league(body: LeagueCreate, user: dict = Depends(get_current_user)):
    code = generate_unique_code()
    league = supabase_admin.table("leagues").insert({
        "name": body.name, "owner_id": user["id"], "invite_code": code,
    }).execute().data[0]
    # Il proprietario è automaticamente membro.
    supabase_admin.table("league_members").insert({
        "league_id": league["id"], "user_id": user["id"],
    }).execute()
    return league


@router.post("/join")
def join_league(body: JoinRequest, user: dict = Depends(get_current_user)):
    league = supabase_admin.table("leagues").select("*").eq(
        "invite_code", body.invite_code.strip().upper()
    ).execute().data
    if not league:
        raise HTTPException(404, "Codice non valido")
    lid = league[0]["id"]
    supabase_admin.table("league_members").upsert(
        {"league_id": lid, "user_id": user["id"]},
        on_conflict="league_id,user_id",
    ).execute()
    return league[0]


@router.get("/me")
def my_leagues(user: dict = Depends(get_current_user)):
    """Le leghe a cui partecipo, con conteggio membri."""
    memberships = supabase_admin.table("league_members").select(
        "league_id, leagues(*)"
    ).eq("user_id", user["id"]).execute().data
    out = []
    for m in memberships:
        lg = m["leagues"]
        count = supabase_admin.table("league_members").select(
            "user_id", count="exact"
        ).eq("league_id", lg["id"]).execute()
        out.append({**lg, "member_count": count.count, "is_owner": lg["owner_id"] == user["id"]})
    return out


def _assert_owner(league_id: str, user_id: str) -> dict:
    lg = supabase_admin.table("leagues").select("*").eq("id", league_id).execute().data
    if not lg:
        raise HTTPException(404, "Lega non trovata")
    if lg[0]["owner_id"] != user_id:
        raise HTTPException(403, "Solo il proprietario può farlo")
    return lg[0]


@router.patch("/{league_id}")
def rename_league(league_id: str, body: RenameRequest, user: dict = Depends(get_current_user)):
    _assert_owner(league_id, user["id"])
    supabase_admin.table("leagues").update({"name": body.name}).eq("id", league_id).execute()
    return {"ok": True}


@router.post("/{league_id}/regenerate-code")
def regenerate_code(league_id: str, user: dict = Depends(get_current_user)):
    _assert_owner(league_id, user["id"])
    code = generate_unique_code()
    supabase_admin.table("leagues").update({"invite_code": code}).eq("id", league_id).execute()
    return {"invite_code": code}


@router.delete("/{league_id}/members/{member_id}")
def remove_member(league_id: str, member_id: str, user: dict = Depends(get_current_user)):
    owner = _assert_owner(league_id, user["id"])
    if member_id == owner["owner_id"]:
        raise HTTPException(400, "Il proprietario non può rimuovere se stesso")
    supabase_admin.table("league_members").delete().eq(
        "league_id", league_id
    ).eq("user_id", member_id).execute()
    return {"ok": True}


@router.post("/{league_id}/leave")
def leave_league(league_id: str, user: dict = Depends(get_current_user)):
    lg = supabase_admin.table("leagues").select("owner_id").eq("id", league_id).execute().data
    if lg and lg[0]["owner_id"] == user["id"]:
        raise HTTPException(400, "Il proprietario non può uscire: elimina la lega o trasferiscila")
    supabase_admin.table("league_members").delete().eq(
        "league_id", league_id
    ).eq("user_id", user["id"]).execute()
    return {"ok": True}


@router.get("/{league_id}/leaderboard")
def league_leaderboard(league_id: str, user: dict = Depends(get_current_user)):
    """Classifica ristretta ai membri della lega. Solo i membri possono vederla."""
    member = supabase_admin.table("league_members").select("user_id").eq(
        "league_id", league_id
    ).eq("user_id", user["id"]).execute().data
    if not member:
        raise HTTPException(403, "Non sei membro di questa lega")

    member_ids = [m["user_id"] for m in supabase_admin.table("league_members").select(
        "user_id"
    ).eq("league_id", league_id).execute().data]

    rows = supabase_admin.table("leaderboard_totals").select("*").in_(
        "user_id", member_ids
    ).execute().data
    rows.sort(key=lambda r: -r["total_points"])

    # Trend: posizione di ieri DENTRO la lega, ricavata dallo snapshot globale dei punti.
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    snaps = supabase_admin.table("leaderboard_snapshots").select(
        "user_id, points"
    ).eq("snap_date", yesterday).in_("user_id", member_ids).execute().data
    snaps.sort(key=lambda s: -s["points"])
    prev_pos = {s["user_id"]: i + 1 for i, s in enumerate(snaps)}

    out = []
    for i, r in enumerate(rows):
        pos = i + 1
        prev = prev_pos.get(r["user_id"])
        finished = r.get("finished_count") or 0
        accuracy = round((r.get("exact_count") or 0) / finished * 100, 1) if finished else 0.0
        out.append({
            "position": pos,
            "user_id": r["user_id"],
            "display_name": r["display_name"],
            "total_points": r["total_points"],
            "accuracy": accuracy,
            "trend": (prev - pos) if prev is not None else 0,
            "is_me": r["user_id"] == user["id"],
        })
    return out
```

Registra il router in `main.py`.

> **Trend per lega senza tabelle nuove**: lo snapshot globale dello Sprint 4 salva i punti per
> utente per giorno. Per il trend interno alla lega basta ordinare i punti di *ieri* tra i soli
> membri e confrontare la posizione. Nessuna struttura aggiuntiva.

---

## 5. Frontend — leghe

### `frontend/src/api/leagues.ts`

```typescript
import { apiFetch } from './client'

export type League = {
  id: string; name: string; owner_id: string; invite_code: string
  member_count: number; is_owner: boolean
}

export const getMyLeagues = () => apiFetch<League[]>('/leagues/me')
export const createLeague = (name: string) =>
  apiFetch<League>('/leagues', { method: 'POST', body: JSON.stringify({ name }) })
export const joinLeague = (invite_code: string) =>
  apiFetch<League>('/leagues/join', { method: 'POST', body: JSON.stringify({ invite_code }) })
export const getLeagueLeaderboard = (id: string) =>
  apiFetch<any[]>(`/leagues/${id}/leaderboard`)
export const renameLeague = (id: string, name: string) =>
  apiFetch(`/leagues/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const regenerateCode = (id: string) =>
  apiFetch<{ invite_code: string }>(`/leagues/${id}/regenerate-code`, { method: 'POST' })
export const removeMember = (id: string, memberId: string) =>
  apiFetch(`/leagues/${id}/members/${memberId}`, { method: 'DELETE' })
export const leaveLeague = (id: string) =>
  apiFetch(`/leagues/${id}/leave`, { method: 'POST' })
```

### `frontend/src/leagues/LeagueContext.tsx`

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getMyLeagues, League } from '../api/leagues'

type Ctx = {
  leagues: League[]
  current: League | null
  setCurrent: (l: League) => void
  refresh: () => Promise<void>
}
const LeagueCtx = createContext<Ctx>({} as Ctx)

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>([])
  const [current, setCurrent] = useState<League | null>(null)

  const refresh = async () => {
    const ls = await getMyLeagues()
    setLeagues(ls)
    setCurrent((c) => c ? ls.find((x) => x.id === c.id) ?? ls[0] ?? null : ls[0] ?? null)
  }
  useEffect(() => { refresh() }, [])

  return (
    <LeagueCtx.Provider value={{ leagues, current, setCurrent, refresh }}>
      {children}
    </LeagueCtx.Provider>
  )
}
export const useLeagues = () => useContext(LeagueCtx)
```

### Schermate (specifica funzionale, design system LMN)

**`screens/Leagues.tsx` — onboarding / gestione**
- Se l'utente non è in nessuna lega: schermata d'ingresso con due grandi azioni,
  "Crea una lega" e "Unisciti con un codice".
- *Crea*: input nome → `createLeague` → mostra il codice invito generato con bottone "Copia"
  e "Condividi" (link tipo `app/join?code=WC26-XXXXX`).
- *Unisciti*: input codice → `joinLeague` → entra e seleziona la lega.
- Lista delle proprie leghe con member_count; tap per selezionarla come corrente.

**Gestione lega (solo `is_owner`)**
- Rinomina, rigenera codice (con conferma: invalida il vecchio), lista membri con bottone
  rimuovi accanto a ciascuno (tranne se stesso).
- Per i non-owner: bottone "Esci dalla lega".

**`screens/Home.tsx` — classifica (modifica)**
- In cima, un **selettore di lega** (dropdown/segmented) che usa `useLeagues()`; se l'utente è
  in una sola lega, mostra il nome senza selettore.
- La classifica chiama `getLeagueLeaderboard(current.id)` invece dell'endpoint globale.
- Resto invariato (podio, riga utente evidenziata, trend, polling 60s).

### Deep link di join

- Gestisci `app/join?code=WC26-XXXXX`: se l'utente è loggato, precompila il join con quel codice;
  se non lo è, dopo il login completa il join automaticamente. Comodo per condividere su WhatsApp.

### Aggancio in `App.tsx`

Avvolgi `AppShell` con `LeagueProvider` (dentro `AuthProvider` → `ProtectedRoute`). Aggiungi
una tab o una voce nel Profilo per "Le mie leghe" che apre `screens/Leagues.tsx`.

---

## 6. Ordine di esecuzione (Claude Code)

1. Applica la migration `008` (tabelle, helper `is_league_member`, RLS).
2. In Supabase, verifica che le signup pubbliche siano abilitate.
3. Backend: crea `services/invite_code.py`, `routers/leagues.py`, registra in `main.py`.
4. Frontend: `api/leagues.ts`, `leagues/LeagueContext.tsx`, `screens/Leagues.tsx`,
   modifica `screens/Home.tsx` per la classifica per lega, gestisci il deep link di join.
5. Avvolgi l'app con `LeagueProvider` e aggiungi l'accesso a "Le mie leghe".
6. Aggiorna README: come creare/unirsi a una lega, ruoli, codici invito.
7. Verifica (sezione 7).

---

## 7. Verifica finale

- [ ] Migration `008` applicata; tabelle `leagues`, `league_members` e funzione
      `is_league_member` presenti.
- [ ] Un nuovo utente si registra via magic link senza bisogno di invito admin.
- [ ] `POST /leagues` crea una lega, restituisce un `invite_code`, e aggiunge l'owner come membro.
- [ ] Un secondo utente con `POST /leagues/join` entra usando il codice.
- [ ] `GET /leagues/me` elenca le leghe corrette con `member_count` e `is_owner`.
- [ ] `GET /leagues/{id}/leaderboard` mostra solo i membri di quella lega, ordinati per punti.
- [ ] Provo ad aprire la leaderboard di una lega di cui NON sono membro → 403.
- [ ] Owner: rinomina, rigenera codice (il vecchio non funziona più), rimuove un membro.
- [ ] Membro non-owner: esce dalla lega; l'owner non può uscire (riceve errore guida).
- [ ] Frontend: selettore lega in Home cambia la classifica; deep link `?code=` precompila il join.
- [ ] RLS: interrogando direttamente Supabase come utente A non vedo le leghe di cui non sono membro.

Con tutti i check verdi, le leghe private sono attive.

---

## Note importanti

- **Pronostici invariati.** Questa feature non tocca `predictions`, `scorer_predictions`, lo
  scoring né il tabellone. Un pronostico resta unico per utente e alimenta tutte le sue leghe.
  È il motivo per cui lo Sprint 6 è additivo e a basso rischio.
- **RLS anti-ricorsione.** Le policy su `league_members` userebbero la tabella stessa per
  verificare l'appartenenza, causando ricorsione. La funzione `is_league_member`
  (SECURITY DEFINER) rompe il ciclo. Non rimuoverla.
- **Trend per lega "gratis".** Riusa lo snapshot globale dello Sprint 4: la posizione di ieri
  nella lega si calcola ordinando i punti di ieri tra i soli membri. Nessuna tabella nuova.
- **Owner che se ne va.** Volutamente bloccato: un proprietario non può abbandonare lasciando
  la lega orfana. Se serve, aggiungi in un secondo momento un endpoint di *trasferimento
  proprietà* a un altro membro — è un'estensione piccola e isolata.
- **Classifica globale (opzionale).** L'endpoint `/leaderboard` globale dello Sprint 4 può
  restare come "classifica generale di tutti", oppure essere rimosso se vuoi solo leghe private.
  Decidi in base a come vuoi presentare il gioco ai colleghi.