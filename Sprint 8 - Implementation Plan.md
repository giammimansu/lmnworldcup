# LMN WORLD CUP — Implementation Plan: Sprint 8 (Marcatori end-to-end)

> Rende funzionante il pronostico marcatore dall'inizio alla fine: scegliere un marcatore,
> registrare i gol reali (admin), assegnare i punti, mostrarne l'esito. Consolida in un unico
> sprint i pezzi prima sparsi tra Sprint 3, 5 e 7, ora che la tabella `players` è popolata.
>
> **Prerequisito**: Sprint 1-3 base completi (auth, sync, pronostici risultato, scoring) e
> tabella `players` popolata con le rose (script FIFA già eseguito).

---

## 0. Obiettivo e definition of done

Al termine deve essere vero **tutto** questo:

1. L'utente, sulla schermata di pronostico, può scegliere un marcatore previsto da una tendina
   che contiene i giocatori delle due squadre della partita.
2. Il pronostico marcatore si può inserire/modificare solo finché la partita non è iniziata
   (stessa deadline lato server del pronostico risultato → 403 se chiusa).
3. L'admin può registrare i marcatori reali di una partita finita e cancellarli.
4. Quando i marcatori sono registrati, i punti marcatore vengono assegnati automaticamente
   a chi ha indovinato (regola: +2 punti se il giocatore previsto ha segnato).
5. L'esito del pronostico marcatore è visibile nel recap e nello storico dei propri pronostici.

Regola di punteggio (già definita allo Sprint 3, qui ribadita): **+2 punti** se il giocatore
previsto segna almeno un gol nella partita, **0** altrimenti. Il moltiplicatore di fase NON si
applica al bonus marcatore.

---

## 1. Migration SQL (se non già applicata)

Se hai già applicato la `005` dello Sprint 3 puoi saltare questo punto. Altrimenti:

### `backend/migrations/005_goals_and_scorer_predictions.sql`

```sql
-- Marcatori reali (inseriti dall'admin a fine gara)
create table if not exists match_goals (
    id          bigserial primary key,
    match_id    bigint not null references matches(id) on delete cascade,
    player_id   bigint references players(id) on delete set null,
    player_name text not null,
    team_tla    text,
    minute      int,
    created_at  timestamptz not null default now()
);
create index if not exists idx_match_goals_match on match_goals(match_id);

-- Pronostico marcatore: un giocatore scelto dall'utente per una partita
create table if not exists scorer_predictions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references profiles(id) on delete cascade,
    match_id   bigint not null references matches(id) on delete cascade,
    player_id  bigint not null references players(id) on delete cascade,
    points     int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, match_id)
);
create index if not exists idx_scorer_pred_user on scorer_predictions(user_id);
create index if not exists idx_scorer_pred_match on scorer_predictions(match_id);

alter table match_goals        enable row level security;
alter table scorer_predictions enable row level security;

create policy "match_goals readable" on match_goals
    for select to authenticated using (true);

-- Propri sempre; altrui solo dopo il kickoff (come i pronostici risultato)
create policy "scorer_pred select own or after kickoff" on scorer_predictions
    for select to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from matches m
            where m.id = scorer_predictions.match_id and m.utc_date <= now()
        )
    );
create policy "scorer_pred insert own" on scorer_predictions
    for insert to authenticated with check (user_id = auth.uid());
create policy "scorer_pred update own" on scorer_predictions
    for update to authenticated using (user_id = auth.uid());
create policy "scorer_pred delete own" on scorer_predictions
    for delete to authenticated using (user_id = auth.uid());
```

---

## 2. Backend — endpoint giocatori (dropdown)

### `backend/app/routers/players.py`

```python
from fastapi import APIRouter, Depends, Query
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/players", tags=["players"])


@router.get("")
def list_players(
    user: dict = Depends(get_current_user),
    team_tla: str | None = Query(default=None),
):
    q = supabase_admin.table("players").select(
        "id, name, position, shirt_number, team_tla, team_name"
    )
    if team_tla:
        q = q.eq("team_tla", team_tla)
    return q.order("shirt_number").execute().data
```

Registra in `main.py`.

---

## 3. Backend — pronostico marcatore

### Modello (in `backend/app/models/prediction.py`)

```python
class ScorerPredictionCreate(BaseModel):
    match_id: int
    player_id: int
```

### Endpoint (in `backend/app/routers/predictions.py`)

```python
from app.models.prediction import ScorerPredictionCreate
from app.services.deadline import assert_open_for_predictions
from datetime import datetime, timezone
from fastapi import HTTPException


@router.post("/scorer")
def upsert_scorer(body: ScorerPredictionCreate, user: dict = Depends(get_current_user)):
    assert_open_for_predictions(body.match_id)  # 403 se partita iniziata

    # il giocatore deve appartenere a una delle due squadre della partita
    match = supabase_admin.table("matches").select(
        "home_team_tla, away_team_tla"
    ).eq("id", body.match_id).single().execute().data
    player = supabase_admin.table("players").select("team_tla").eq(
        "id", body.player_id
    ).single().execute().data
    if not player or player["team_tla"] not in (match["home_team_tla"], match["away_team_tla"]):
        raise HTTPException(400, "Il giocatore non appartiene a questa partita")

    supabase_admin.table("scorer_predictions").upsert(
        {
            "user_id": user["id"], "match_id": body.match_id, "player_id": body.player_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,match_id",
    ).execute()
    return {"ok": True}
```

> Se non hai ancora `services/deadline.py` (Sprint 3), creane uno con
> `assert_open_for_predictions(match_id)` che confronta `matches.utc_date` con
> `datetime.now(timezone.utc)` e solleva 403 se la partita è già iniziata.

---

## 4. Backend — scoring marcatore

### In `backend/app/services/scoring.py`

```python
PTS_SCORER = 2


def calculate_scorer_points(predicted_player_id: int, scorer_ids: set[int]) -> int:
    """Funzione pura. +2 se il giocatore previsto ha segnato, altrimenti 0."""
    return PTS_SCORER if predicted_player_id in scorer_ids else 0
```

### Aggancio dentro `score_match` (stessa funzione che già scoria i risultati)

```python
# dentro score_match(match_id), dopo aver scoreato le predictions risultato:
goals = supabase_admin.table("match_goals").select("player_id").eq(
    "match_id", match_id
).execute().data
scorer_ids = {g["player_id"] for g in goals if g["player_id"] is not None}

sp = supabase_admin.table("scorer_predictions").select("*").eq(
    "match_id", match_id
).execute().data
for s in sp:
    pts = calculate_scorer_points(s["player_id"], scorer_ids)
    supabase_admin.table("scorer_predictions").update({"points": pts}).eq(
        "id", s["id"]
    ).execute()
```

> `score_match` resta **idempotente**: riscrive i punti marcatore da zero a ogni esecuzione,
> quindi aggiungere o togliere un gol e rilanciare aggiorna tutto senza doppi conteggi.

### Test (in `backend/tests/test_scoring.py`)

```python
from app.services.scoring import calculate_scorer_points

def test_scorer_hit():
    assert calculate_scorer_points(101, {101, 202}) == 2

def test_scorer_miss():
    assert calculate_scorer_points(999, {101, 202}) == 0

def test_scorer_no_goals():
    assert calculate_scorer_points(101, set()) == 0
```

---

## 5. Backend — admin: inserimento marcatori reali

### In `backend/app/routers/admin.py`

```python
from pydantic import BaseModel
from app.services.scoring import score_match


class GoalIn(BaseModel):
    match_id: int
    player_id: int
    player_name: str
    team_tla: str | None = None
    minute: int | None = None


@router.post("/goals")
def add_goal(g: GoalIn, admin: dict = Depends(require_admin)):
    supabase_admin.table("match_goals").insert(g.model_dump()).execute()
    score_match(g.match_id)   # ricalcola subito i punti marcatore
    return {"ok": True}


@router.delete("/goals/{goal_id}")
def del_goal(goal_id: int, match_id: int, admin: dict = Depends(require_admin)):
    supabase_admin.table("match_goals").delete().eq("id", goal_id).execute()
    score_match(match_id)
    return {"ok": True}


@router.get("/goals/{match_id}")
def list_goals(match_id: int, admin: dict = Depends(require_admin)):
    return supabase_admin.table("match_goals").select("*").eq(
        "match_id", match_id
    ).order("minute").execute().data
```

---

## 6. Frontend — pronostico marcatore (dropdown)

### `frontend/src/api/predictions.ts` (aggiunte)

```typescript
export function createScorerPrediction(match_id: number, player_id: number) {
  return apiFetch('/predictions/scorer', {
    method: 'POST', body: JSON.stringify({ match_id, player_id }),
  })
}
export function getPlayers(teamTla: string) {
  return apiFetch<any[]>(`/players?team_tla=${teamTla}`)
}
```

### Nella schermata `screens/Predict.tsx`

Sotto i due score input, una sezione "Marcatore previsto" (opzionale):
- Al mount, carica i giocatori di **entrambe** le squadre: `getPlayers(home_tla)` e
  `getPlayers(away_tla)`, uniscili in un'unica lista raggruppata per squadra.
- Mostra una `<select>` (o lista cercabile) raggruppata: optgroup squadra casa / squadra ospite,
  ogni opzione "n. maglia · Nome · ruolo".
- Alla conferma del pronostico, se è stato scelto un marcatore, chiama `createScorerPrediction`.
- Disabilita la tendina quando il countdown al kickoff è scaduto (come gli score input).
- Mostra che il bonus vale +2 punti.

---

## 7. Frontend — admin: inserimento gol

### `frontend/src/api/admin.ts` (aggiunte)

```typescript
export const addGoal = (body: any) =>
  apiFetch('/admin/goals', { method: 'POST', body: JSON.stringify(body) })
export const delGoal = (goalId: number, matchId: number) =>
  apiFetch(`/admin/goals/${goalId}?match_id=${matchId}`, { method: 'DELETE' })
export const listGoals = (matchId: number) =>
  apiFetch<any[]>(`/admin/goals/${matchId}`)
```

### Nella schermata `screens/Admin.tsx`

Per una partita finita, una sezione "Marcatori":
- Selezione giocatore dalla rosa delle due squadre (riusa `getPlayers` per entrambe le tla) +
  campo minuto (opzionale) + bottone "Aggiungi gol" → `addGoal`. Passa anche `player_name` e
  `team_tla` (li hai dall'oggetto giocatore selezionato).
- Lista dei gol già inseriti (`listGoals`) con bottone rimuovi accanto a ciascuno → `delGoal`.
- Dopo ogni aggiunta/rimozione, i punti marcatore si ricalcolano lato server in automatico
  (lo fa `score_match` dentro gli endpoint admin).

---

## 8. Frontend — mostrare l'esito

- **Recap (Sprint 7)**: nella card partita, accanto al pronostico di ogni membro, mostra il
  marcatore scelto (`scorer_name`) e se ha segnato, col badge punti (+2 o 0). L'endpoint recap
  già include questi campi se implementato secondo lo Sprint 7.
- **Storico personale**: in `GET /predictions/me`, affianca al pronostico risultato anche
  l'eventuale pronostico marcatore e il suo esito (recupera da `scorer_predictions` per match).

---

## 9. Ordine di esecuzione (Claude Code)

1. Applica la migration `005` (se non già fatta).
2. Backend: `routers/players.py`; aggiungi `POST /predictions/scorer`; aggiungi
   `calculate_scorer_points` + aggancio in `score_match`; endpoint admin `goals`.
3. Test: aggiungi e fai passare i test di `calculate_scorer_points`.
4. Registra i nuovi router in `main.py`.
5. Frontend: dropdown marcatore in `Predict`, UI gol in `Admin`, esito in recap/storico.
6. Aggiorna README con la regola marcatore e il flusso admin.
7. Verifica (sezione 10).

---

## 10. Verifica finale

- [ ] `GET /players?team_tla=BRA` ritorna la rosa del Brasile ordinata per numero di maglia.
- [ ] `POST /predictions/scorer` salva la scelta; rifiuta (400) un giocatore che non gioca
      quella partita; rifiuta (403) se la partita è già iniziata.
- [ ] `uv run pytest` → i test di `calculate_scorer_points` passano.
- [ ] Flusso completo di test: inserisco un marcatore previsto su una partita di test, la porto
      a FINISHED, registro via `POST /admin/goals` un gol di quel giocatore → il pronostico
      marcatore riceve +2 punti.
- [ ] Se il gol registrato è di un altro giocatore, il pronostico marcatore resta a 0 punti.
- [ ] Rimuovendo il gol dall'admin, i punti tornano a 0 (idempotenza di `score_match`).
- [ ] Frontend: la tendina mostra i giocatori di entrambe le squadre, raggruppati; dopo il
      kickoff è disabilitata.
- [ ] L'esito del marcatore compare nel recap e nello storico personale.

Con tutti i check verdi, il pronostico marcatore è completo e funzionante.

---

## Note importanti

- **I punti marcatore dipendono dall'inserimento manuale.** Sul tier free i marcatori non
  arrivano dall'API: finché l'admin non registra i gol in `match_goals`, i pronostici marcatore
  restano a 0 anche a partita finita. È il passo da non dimenticare a fine gara.
- **Idempotenza.** `score_match` riscrive sempre i punti da zero: correzioni (gol aggiunto in
  ritardo, gol sbagliato rimosso) si propagano semplicemente rieseguendolo, senza doppi conteggi.
- **Coerenza con la classifica.** I punti marcatore confluiscono negli stessi totali che
  alimentano classifica e recap (la view `leaderboard_totals` somma `predictions.points` +
  `scorer_predictions.points`): tutto resta allineato senza interventi aggiuntivi.
- **Il pronostico risultato resta indipendente.** Tutta questa feature è opzionale: il gioco
  funziona perfettamente anche se nessuno sceglie un marcatore e l'admin non registra i gol.