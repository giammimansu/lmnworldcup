# LMN WORLD CUP — Implementation Plan: Sprint 5

> Lo sprint finale: tabellone a eliminazione, pannello admin completo, navigazione a
> 5 tab che unisce tutte le schermate, rifinitura della qualità e go-live con i colleghi.
>
> **Prerequisito**: Sprint 1-4 completi (infra, auth, sync, pronostici+scoring, classifica+profilo).

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 5 deve essere vero **tutto** questo:

1. `GET /bracket` ritorna la struttura del tabellone organizzata per fase; il frontend la
   mostra come bracket scrollabile dal Round of 32 alla Finale.
2. I pronostici sulle fasi knockout funzionano (riuso della schermata Predict) con il
   moltiplicatore di fase ben visibile (×2 / ×3).
3. Pannello admin completo: lista utenti, override manuale dei risultati (con ricalcolo punti),
   inserimento marcatori, e visualizzazione del sync log.
4. Navigation bar a 5 tab (Home, Partite, Pronostica, Tabellone, Profilo) che naviga tra tutte
   le schermate; design system LMN applicato ovunque.
5. Qualità: stati di loading/empty/error gestiti, orari sempre in fuso locale, deadline sempre
   in UTC lato server, app responsive mobile + desktop.
6. README aggiornato con regole di gioco e procedure admin; checklist go-live verde.

---

## 1. Nuove migration SQL

> Non servono nuove tabelle: il tabellone si deriva dalle partite già in `matches`
> (quelle con `stage != 'GROUP_STAGE'`). Eventuale solo questo indice di comodo:

### `backend/migrations/007_bracket_index.sql`

```sql
create index if not exists idx_matches_stage_date on matches(stage, utc_date);
```

---

## 2. Backend — tabellone

### `backend/app/routers/bracket.py`

```python
from fastapi import APIRouter, Depends
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/bracket", tags=["bracket"])

KNOCKOUT_ORDER = [
    "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL",
]


@router.get("")
def bracket(user: dict = Depends(get_current_user)):
    """Struttura del tabellone, raggruppata per fase in ordine. Gli slot non ancora
    definiti hanno squadre null (TBD)."""
    rows = supabase_admin.table("matches").select("*").neq(
        "stage", "GROUP_STAGE"
    ).order("utc_date").execute().data

    def winner(m):
        if m["status"] != "FINISHED" or m["home_score"] is None:
            return None
        if m["home_score"] > m["away_score"]:
            return m["home_team_tla"]
        if m["home_score"] < m["away_score"]:
            return m["away_team_tla"]
        return None  # pareggio (knockout deciso ai rigori: fonte API può variare)

    by_stage = {s: [] for s in KNOCKOUT_ORDER}
    for m in rows:
        if m["stage"] in by_stage:
            by_stage[m["stage"]].append({
                "id": m["id"],
                "utc_date": m["utc_date"],
                "status": m["status"],
                "home": {"name": m["home_team_name"], "tla": m["home_team_tla"],
                         "crest": m["home_team_crest"], "score": m["home_score"]},
                "away": {"name": m["away_team_name"], "tla": m["away_team_tla"],
                         "crest": m["away_team_crest"], "score": m["away_score"]},
                "winner": winner(m),
            })

    return [{"stage": s, "matches": by_stage[s]} for s in KNOCKOUT_ORDER if by_stage[s]]
```

Registra il router in `main.py`.

---

## 3. Backend — pannello admin completo

> Estende `routers/admin.py` dello Sprint 3 (che aveva già `/admin/goals` e
> `/admin/scoring/recalculate`).

### Aggiungi a `backend/app/routers/admin.py`

```python
from pydantic import BaseModel
from fastapi import HTTPException
from app.services.scoring import score_match
from app.services.achievements import evaluate_for_user


@router.get("/users")
def list_users(admin: dict = Depends(require_admin)):
    users = supabase_admin.table("profiles").select(
        "id, email, display_name, is_admin, created_at"
    ).execute().data
    # conteggio pronostici per utente
    preds = supabase_admin.table("predictions").select("user_id").execute().data
    counts: dict[str, int] = {}
    for p in preds:
        counts[p["user_id"]] = counts.get(p["user_id"], 0) + 1
    return [{**u, "predictions": counts.get(u["id"], 0)} for u in users]


class MatchOverride(BaseModel):
    home_score: int | None = None
    away_score: int | None = None
    status: str | None = None


@router.patch("/matches/{match_id}")
def override_match(match_id: int, body: MatchOverride, admin: dict = Depends(require_admin)):
    """Correzione manuale di un risultato in caso di errore dell'API esterna.
    Dopo l'override, ricalcola i punti di tutti i pronostici della partita."""
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    supabase_admin.table("matches").update(update).eq("id", match_id).execute()

    res = score_match(match_id)
    # rivaluta achievement per gli utenti coinvolti
    pred_users = supabase_admin.table("predictions").select("user_id").eq(
        "match_id", match_id
    ).execute().data
    for u in {p["user_id"] for p in pred_users}:
        evaluate_for_user(u)
    return {"updated": update, "scoring": res}


@router.get("/sync-log")
def sync_log(admin: dict = Depends(require_admin)):
    return supabase_admin.table("sync_log").select("*").order(
        "run_at", desc=True
    ).limit(50).execute().data
```

> **Override + sync**: se correggi un risultato a mano e poi il sync automatico riscrive il
> valore dall'API, vince l'ultimo che scrive. Per le partite corrette manualmente conviene
> non far più girare il sync su quella partita, oppure fidarsi dell'API una volta che pubblica
> il dato definitivo. Documenta il comportamento nel README.

---

## 4. Frontend — navigazione a 5 tab

> Le schermate esistono già dagli sprint precedenti (Home, Matches, Predict, Profile);
> qui le unifichiamo sotto una shell con bottom navigation, e aggiungiamo Bracket e Admin.
> Navigazione basata su stato (nessuna dipendenza router aggiuntiva).

### `frontend/src/AppShell.tsx`

```tsx
import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import Home from './screens/Home'
import Matches from './screens/Matches'
import Predict from './screens/Predict'      // ricerca/seleziona la partita da pronosticare
import Bracket from './screens/Bracket'
import Profile from './screens/Profile'
import Admin from './screens/Admin'

type Tab = 'home' | 'matches' | 'predict' | 'bracket' | 'profile' | 'admin'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Classifica', icon: 'ti-trophy' },
  { id: 'matches', label: 'Partite', icon: 'ti-calendar' },
  { id: 'predict', label: 'Pronostica', icon: 'ti-ballpen' },
  { id: 'bracket', label: 'Tabellone', icon: 'ti-tournament' },
  { id: 'profile', label: 'Profilo', icon: 'ti-user' },
]

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('home')
  const { isAdmin } = useAuth()

  return (
    <div className="app-shell">
      <main className="app-content">
        {tab === 'home' && <Home />}
        {tab === 'matches' && <Matches />}
        {tab === 'predict' && <Predict />}
        {tab === 'bracket' && <Bracket />}
        {tab === 'profile' && <Profile onOpenAdmin={isAdmin ? () => setTab('admin') : undefined} />}
        {tab === 'admin' && isAdmin && <Admin />}
      </main>

      <nav className="bottom-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`ti ${t.icon}`} aria-hidden="true" />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
```

Aggiorna `App.tsx` per usare `AppShell` dentro `ProtectedRoute`. La tab attiva si evidenzia
in oro (design system); l'accesso ad Admin è raggiungibile dal Profilo solo se `isAdmin`.

### `frontend/src/screens/Bracket.tsx`

Specifica funzionale (Claude Code implementa col design system LMN):
- Chiama `GET /bracket`.
- Layout **orizzontale scrollabile**: una colonna per fase nell'ordine LAST_32 → LAST_16 →
  QUARTER_FINALS → SEMI_FINALS → THIRD_PLACE → FINAL.
- Ogni match = una card con due slot squadra (crest + tla, o "?" se la squadra è null/TBD).
- Il **vincitore** (campo `winner`) evidenziato in oro.
- **Linee connettori** tra le card di fasi consecutive (SVG o bordi CSS).
- La Finale ben visibile a destra con icona trofeo.
- Tap su una card knockout futura → apre Predict per quella partita, con badge ×2/×3 prominente.

### `frontend/src/screens/Admin.tsx`

Specifica funzionale (solo `isAdmin`):
- **Lista utenti** da `GET /admin/users`: nome, email, n. pronostici, flag admin.
- **Override risultati**: tabella/lista delle partite; per ognuna, form inline per impostare
  `home_score`, `away_score`, `status` e bottone Salva → `PATCH /admin/matches/{id}`.
- **Inserimento marcatori**: per una partita finita, selezione giocatore (dropdown rosa) +
  minuto → `POST /admin/goals`; lista dei gol già inseriti con possibilità di cancellarli.
- **Sync log**: ultime 50 righe da `GET /admin/sync-log` (data, n. partite, esito, dettaglio).
- Bottone "Ricalcola tutti i punti" → `POST /admin/scoring/recalculate`.

### `frontend/src/api/bracket.ts` e `admin.ts`

```typescript
import { apiFetch } from './client'

export const getBracket = () => apiFetch<any[]>('/bracket')

export const getAdminUsers = () => apiFetch<any[]>('/admin/users')
export const overrideMatch = (id: number, body: any) =>
  apiFetch(`/admin/matches/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const addGoal = (body: any) =>
  apiFetch('/admin/goals', { method: 'POST', body: JSON.stringify(body) })
export const getSyncLog = () => apiFetch<any[]>('/admin/sync-log')
export const recalcAll = () =>
  apiFetch('/admin/scoring/recalculate', { method: 'POST' })
```

---

## 5. Qualità e rifinitura

### Error boundary e stati globali

- `frontend/src/components/ErrorBoundary.tsx`: class component che cattura gli errori di
  render e mostra un fallback ("Qualcosa è andato storto, ricarica") invece di schermo bianco.
  Avvolge `AppShell`.
- Pattern uniforme per ogni schermata che fa fetch: stato `loading` (skeleton/spinner),
  stato `empty` (messaggio "Nessun dato"), stato `error` (messaggio + retry). Evita schermate
  vuote senza spiegazione.

### Timezone (verifica esplicita)

- **Display**: ogni orario mostrato all'utente passa per `toLocaleString` → fuso del browser.
  Test: cambia il fuso del sistema operativo e verifica che gli orari delle partite slittino
  di conseguenza.
- **Deadline**: lato server, sempre `datetime.now(timezone.utc)` vs `utc_date`. Test: prova a
  pronosticare via API una partita il cui kickoff è appena passato → deve dare 403
  indipendentemente dal fuso del client.

### README finale

Deve contenere: regole di gioco complete (punteggio, moltiplicatori, marcatori), come invitare
i colleghi, come inserire i marcatori a fine partita, come fare un override, come funzionano i
cron, e la checklist di go-live qui sotto.

---

## 6. Ordine di esecuzione (Claude Code)

1. Applica la migration `007`.
2. Backend: crea `routers/bracket.py`, estendi `routers/admin.py`, registra in `main.py`.
3. Frontend: crea `AppShell.tsx` con la bottom nav, integra le schermate esistenti, crea
   `screens/Bracket.tsx`, `screens/Admin.tsx`, `api/bracket.ts`, `api/admin.ts`.
4. Crea `components/ErrorBoundary.tsx` e applica gli stati loading/empty/error a tutte le
   schermate con fetch.
5. Applica il design system LMN a tutte le schermate per coerenza visiva finale.
6. Aggiorna il README (regole, procedure admin, cron, checklist go-live).
7. Esegui i test di qualità (sezione 7) e la checklist di go-live (sezione 8).

---

## 7. Verifica finale

- [ ] `GET /bracket` ritorna le fasi knockout nell'ordine corretto; gli slot non definiti sono TBD.
- [ ] Frontend Tabellone: bracket scrollabile, connettori, vincitori in oro, finale con trofeo.
- [ ] Pronostico su una partita knockout mostra il moltiplicatore ×2/×3 e assegna i punti giusti.
- [ ] Admin: `PATCH /admin/matches/{id}` corregge un risultato e i punti si ricalcolano;
      l'achievement degli utenti coinvolti viene rivalutato.
- [ ] Admin: inserimento e cancellazione marcatori funzionano; sync log visibile.
- [ ] Bottom nav: tutte e 5 le tab navigano; la tab attiva è evidenziata; Admin visibile solo
      ad `isAdmin`.
- [ ] Error boundary: un errore di render mostra il fallback, non schermo bianco.
- [ ] Timezone: orari nel fuso locale; deadline 403 lato server a prescindere dal client.
- [ ] Responsive: tutto usabile a 375px e su desktop, su Chrome/Safari/Firefox.

---

## 8. Checklist go-live

- [ ] Tutte le 104 partite presenti in `matches` (verifica con un `count`).
- [ ] Rose caricate (`players` popolata) se usi i pronostici marcatore.
- [ ] Il tuo account è admin; almeno un secondo admin di backup invitato.
- [ ] Cron di sync attivo e testato (verifica una riga recente in `sync_log`).
- [ ] Cron snapshot giornaliero attivo (per il trend in classifica).
- [ ] Variabili d'ambiente di produzione configurate su Vercel (incluso `VITE_API_URL=/api`,
      `ALLOWED_ORIGINS` col dominio prod, `CRON_SECRET`).
- [ ] SMTP di produzione configurato in Supabase (gli inviti recapitano davvero).
- [ ] Flusso end-to-end testato in prod: invito → magic link → login → pronostico → (simulazione
      risultato) → punti → classifica.
- [ ] Regole di gioco comunicate ai colleghi (messaggio/README condiviso).
- [ ] Pronostici aperti per le prime partite. Primo kickoff: **11 giugno 2026**.

Con tutti i check verdi, LMN World Cup è live. Buon Mondiale.

---

## Note importanti

- **Il tabellone si auto-popola.** Non serve logica di avanzamento manuale: man mano che il
  sync importa le partite knockout con le squadre qualificate, gli slot TBD si riempiono da soli.
  Finché football-data non pubblica gli accoppiamenti, le squadre restano null (mostrate come "?").
- **Override vs sync.** L'override admin e il sync automatico scrivono sulla stessa partita:
  vince l'ultimo. Usa l'override solo per correggere errori temporanei dell'API; una volta che
  l'API pubblica il dato corretto, i due valori coincidono.
- **Pareggi nei knockout.** Le fasi a eliminazione non possono finire in pareggio: se l'API
  riporta i 90'+supplementari pari e la qualificazione è ai rigori, il campo `winner` resta null.
  Per il punteggio si usa comunque il `fullTime` come da regole Sprint 3; se vuoi gestire i
  rigori, inseriscili come override o estendi `match_goals`. Per un gioco tra colleghi va bene
  così com'è.
- **Navigazione senza router.** La shell a stato evita la dipendenza da react-router per 5 tab.
  Se in futuro vuoi URL condivisibili per ogni schermata, introdurre react-router è un cambio
  contenuto e isolato in `AppShell`.