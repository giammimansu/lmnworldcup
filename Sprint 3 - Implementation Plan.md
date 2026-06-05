# LMN WORLD CUP — Implementation Plan: Sprint 3

> Il sistema di pronostici: inserimento risultati, deadline imposta lato server,
> motore di calcolo punti testabile, e pronostico marcatori (con marcatori inseriti
> manualmente dall'admin, rose già caricate nello Sprint 2).
>
> **Prerequisito**: Sprint 1 e 2 completi (infra, auth magic link, sync delle 104
> partite funzionante, tabelle `matches` e `players` popolate).

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 3 deve essere vero **tutto** questo:

1. Un utente inserisce/modifica il pronostico (risultato) su una partita futura; tentare
   di pronosticare una partita già iniziata ritorna **403 dal backend** (non solo UI bloccata).
2. Quando una partita passa a `FINISHED` durante il sync, i punti di tutti i pronostici
   su quella partita vengono calcolati automaticamente.
3. Le regole di punteggio sono implementate come **funzione pura testata** (pytest verde).
4. Un utente può pronosticare il marcatore di una partita scegliendolo dalla rosa; quando
   l'admin inserisce i marcatori reali, i punti marcatore vengono assegnati.
5. La schermata "Partite" mostra lo stato del pronostico per ogni match (fatto / da fare /
   scaduto / risultato+punti se finita); orari nel fuso locale.
6. I pronostici altrui su una partita sono visibili **solo dopo il kickoff** (già garantito
   da RLS nello Sprint 1, qui esposto via endpoint summary).

---

## 1. Regole di gioco (implementarle ESATTAMENTE così)

**Pronostico risultato** (`home_score`, `away_score`, interi ≥ 0):
- Risultato esatto (entrambi i gol giusti): **3 punti**
- Segno giusto (esito 1/X/2 corretto ma risultato sbagliato): **1 punto**
- Sbagliato: **0 punti**

**Moltiplicatori per fase** (applicati al punteggio risultato):
- `GROUP_STAGE` → ×1
- `LAST_32`, `LAST_16`, `QUARTER_FINALS` → ×2
- `SEMI_FINALS`, `THIRD_PLACE`, `FINAL` → ×3

**Base di valutazione knockout**: si usa il risultato dei 90' + eventuali supplementari
(il `fullTime` di football-data include i supplementari), **non** i rigori.

**Pronostico marcatore** (opzionale, un giocatore per partita):
- Il giocatore pronosticato segna almeno un gol nella partita: **+2 punti**
- Non segna: **0 punti**
- (Il moltiplicatore di fase **non** si applica al bonus marcatore, per semplicità.)

> Questi numeri sono centralizzati in `scoring.py` come costanti, così cambiarli è banale.

---

## 2. Nuove migration SQL

> La tabella `predictions` esiste già (Sprint 1). Qui aggiungiamo marcatori reali e
> pronostici marcatore. Applica dopo le migration precedenti.

### `backend/migrations/005_goals_and_scorer_predictions.sql`

```sql
-- Marcatori reali di una partita (inseriti dall'admin a fine gara).
create table if not exists match_goals (
    id          bigserial primary key,
    match_id    bigint not null references matches(id) on delete cascade,
    player_id   bigint references players(id) on delete set null,
    player_name text not null,          -- ridondante ma comodo (storico)
    team_tla    text,
    minute      int,
    created_at  timestamptz not null default now()
);
create index if not exists idx_match_goals_match on match_goals(match_id);

-- Pronostico marcatore: un giocatore scelto dall'utente per una partita.
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

-- RLS
alter table match_goals         enable row level security;
alter table scorer_predictions  enable row level security;

-- match_goals: lettura per autenticati, scrittura solo service role (admin via backend).
create policy "match_goals readable" on match_goals
    for select to authenticated using (true);

-- scorer_predictions: stessa logica dei pronostici risultato.
-- Propri sempre; altrui solo dopo il kickoff.
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

## 3. Backend — motore di scoring (cuore testabile)

### `backend/app/services/scoring.py`

```python
"""Logica di calcolo punti. Le funzioni di calcolo sono pure e testabili."""
from app.database import supabase_admin

# Costanti regole (modificabili in un punto solo)
PTS_EXACT = 3
PTS_SIGN = 1
PTS_SCORER = 2

STAGE_MULTIPLIER = {
    "GROUP_STAGE": 1,
    "LAST_32": 2,
    "LAST_16": 2,
    "QUARTER_FINALS": 2,
    "SEMI_FINALS": 3,
    "THIRD_PLACE": 3,
    "FINAL": 3,
}


def _sign(home: int, away: int) -> str:
    if home > away:
        return "1"
    if home < away:
        return "2"
    return "X"


def calculate_points(
    pred_home: int, pred_away: int,
    actual_home: int, actual_away: int,
    stage: str,
) -> int:
    """Punti per un pronostico risultato. Funzione PURA — nessun side effect."""
    mult = STAGE_MULTIPLIER.get(stage, 1)
    if pred_home == actual_home and pred_away == actual_away:
        return PTS_EXACT * mult
    if _sign(pred_home, pred_away) == _sign(actual_home, actual_away):
        return PTS_SIGN * mult
    return 0


def calculate_scorer_points(predicted_player_id: int, scorer_ids: set[int]) -> int:
    """Punti per il pronostico marcatore. Funzione PURA."""
    return PTS_SCORER if predicted_player_id in scorer_ids else 0


# --- Funzioni con side effect (scrivono sul DB) ---

def score_match(match_id: int) -> dict:
    """Ricalcola i punti di tutti i pronostici (risultato + marcatore) di una partita
    FINISHED. Idempotente: rieseguirla riscrive gli stessi punti."""
    match = supabase_admin.table("matches").select("*").eq("id", match_id).single().execute().data
    if not match or match["status"] != "FINISHED":
        return {"scored": 0, "reason": "match non finita"}
    if match["home_score"] is None or match["away_score"] is None:
        return {"scored": 0, "reason": "risultato mancante"}

    ah, aa, stage = match["home_score"], match["away_score"], match["stage"]

    # Pronostici risultato
    preds = supabase_admin.table("predictions").select("*").eq("match_id", match_id).execute().data
    for p in preds:
        pts = calculate_points(p["home_score"], p["away_score"], ah, aa, stage)
        supabase_admin.table("predictions").update({"points": pts}).eq("id", p["id"]).execute()

    # Pronostici marcatore
    goals = supabase_admin.table("match_goals").select("player_id").eq("match_id", match_id).execute().data
    scorer_ids = {g["player_id"] for g in goals if g["player_id"] is not None}
    sp = supabase_admin.table("scorer_predictions").select("*").eq("match_id", match_id).execute().data
    for s in sp:
        pts = calculate_scorer_points(s["player_id"], scorer_ids)
        supabase_admin.table("scorer_predictions").update({"points": pts}).eq("id", s["id"]).execute()

    return {"scored": len(preds), "scorer_scored": len(sp)}


def recalculate_all() -> dict:
    finished = supabase_admin.table("matches").select("id").eq("status", "FINISHED").execute().data
    total = sum(score_match(m["id"]).get("scored", 0) for m in finished)
    return {"matches": len(finished), "predictions_scored": total}
```

### `backend/tests/test_scoring.py`

```python
from app.services.scoring import calculate_points, calculate_scorer_points


def test_exact_group():
    assert calculate_points(2, 1, 2, 1, "GROUP_STAGE") == 3

def test_sign_group():
    # pronostico 2-0, reale 3-1: segno "1" giusto, risultato sbagliato → 1 pt
    assert calculate_points(2, 0, 3, 1, "GROUP_STAGE") == 1

def test_wrong():
    assert calculate_points(2, 0, 0, 1, "GROUP_STAGE") == 0

def test_draw_exact():
    assert calculate_points(1, 1, 1, 1, "GROUP_STAGE") == 3

def test_draw_sign():
    # pronostico 0-0, reale 2-2: segno "X" giusto → 1 pt
    assert calculate_points(0, 0, 2, 2, "GROUP_STAGE") == 1

def test_knockout_exact_x2():
    assert calculate_points(1, 0, 1, 0, "QUARTER_FINALS") == 6

def test_final_exact_x3():
    assert calculate_points(2, 1, 2, 1, "FINAL") == 9

def test_final_sign_x3():
    assert calculate_points(1, 0, 3, 2, "FINAL") == 3

def test_scorer_hit():
    assert calculate_scorer_points(101, {101, 202}) == 2

def test_scorer_miss():
    assert calculate_scorer_points(999, {101, 202}) == 0
```

Esecuzione: `cd backend && uv run pytest tests/test_scoring.py -v`.

---

## 4. Backend — endpoint pronostici

### `backend/app/models/prediction.py`

```python
from pydantic import BaseModel, Field


class PredictionCreate(BaseModel):
    match_id: int
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)


class ScorerPredictionCreate(BaseModel):
    match_id: int
    player_id: int
```

### `backend/app/services/deadline.py`

```python
from datetime import datetime, timezone
from fastapi import HTTPException
from app.database import supabase_admin


def assert_open_for_predictions(match_id: int) -> dict:
    """Recupera la partita e verifica che NON sia ancora iniziata.
    La deadline è il kickoff (utc_date). Calcolo SEMPRE lato server in UTC."""
    res = supabase_admin.table("matches").select("*").eq("id", match_id).execute()
    if not res.data:
        raise HTTPException(404, "Partita non trovata")
    match = res.data[0]
    kickoff = datetime.fromisoformat(match["utc_date"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) >= kickoff:
        raise HTTPException(403, "Pronostici chiusi per questa partita")
    return match
```

### `backend/app/routers/predictions.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from app.deps import get_current_user
from app.database import supabase, supabase_admin
from app.models.prediction import PredictionCreate, ScorerPredictionCreate
from app.services.deadline import assert_open_for_predictions

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("")
def upsert_prediction(body: PredictionCreate, user: dict = Depends(get_current_user)):
    assert_open_for_predictions(body.match_id)  # 403 se partita iniziata
    row = {
        "user_id": user["id"],
        "match_id": body.match_id,
        "home_score": body.home_score,
        "away_score": body.away_score,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase_admin.table("predictions").upsert(row, on_conflict="user_id,match_id").execute()
    return {"ok": True}


@router.post("/scorer")
def upsert_scorer(body: ScorerPredictionCreate, user: dict = Depends(get_current_user)):
    assert_open_for_predictions(body.match_id)
    # valida che il giocatore appartenga a una delle due squadre della partita
    match = supabase_admin.table("matches").select(
        "home_team_tla, away_team_tla"
    ).eq("id", body.match_id).single().execute().data
    player = supabase_admin.table("players").select("team_tla").eq(
        "id", body.player_id
    ).single().execute().data
    if not player or player["team_tla"] not in (match["home_team_tla"], match["away_team_tla"]):
        raise HTTPException(400, "Il giocatore non appartiene a questa partita")

    row = {
        "user_id": user["id"], "match_id": body.match_id, "player_id": body.player_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase_admin.table("scorer_predictions").upsert(
        row, on_conflict="user_id,match_id"
    ).execute()
    return {"ok": True}


@router.get("/me")
def my_predictions(user: dict = Depends(get_current_user)):
    """Tutti i pronostici dell'utente con esito calcolato."""
    preds = supabase_admin.table("predictions").select(
        "*, matches(*)"
    ).eq("user_id", user["id"]).execute().data

    def outcome(p):
        m = p["matches"]
        if m["status"] != "FINISHED" or m["home_score"] is None:
            return "pending"
        if p["points"] is None:
            return "pending"
        if p["home_score"] == m["home_score"] and p["away_score"] == m["away_score"]:
            return "exact"
        return "sign" if p["points"] > 0 else "wrong"

    return [{**p, "outcome": outcome(p)} for p in preds]


@router.get("/match/{match_id}/summary")
def match_summary(match_id: int, user: dict = Depends(get_current_user)):
    """Statistiche aggregate dei pronostici. Disponibili SOLO dopo il kickoff."""
    match = supabase_admin.table("matches").select("utc_date").eq(
        "id", match_id
    ).single().execute().data
    if not match:
        raise HTTPException(404, "Partita non trovata")
    kickoff = datetime.fromisoformat(match["utc_date"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) < kickoff:
        raise HTTPException(403, "Riepilogo disponibile dopo il calcio d'inizio")

    preds = supabase_admin.table("predictions").select(
        "home_score, away_score"
    ).eq("match_id", match_id).execute().data

    total = len(preds)
    signs = {"1": 0, "X": 0, "2": 0}
    score_counts: dict[str, int] = {}
    for p in preds:
        h, a = p["home_score"], p["away_score"]
        s = "1" if h > a else "2" if h < a else "X"
        signs[s] += 1
        key = f"{h}-{a}"
        score_counts[key] = score_counts.get(key, 0) + 1
    top = sorted(score_counts.items(), key=lambda kv: -kv[1])[:3]
    return {"total": total, "signs": signs, "top_scores": top}
```

> **Privacy**: l'endpoint summary aggrega senza esporre *chi* ha pronosticato cosa, ed è
> bloccato fino al kickoff. La RLS dello Sprint 1 protegge comunque la lettura diretta della
> tabella, quindi la riservatezza è garantita a due livelli.

### Backend — admin: inserimento marcatori (versione minimale)

> Il pannello admin completo è Sprint 5, ma serve già un endpoint per inserire i marcatori
> e testare lo scoring marcatore.

`backend/app/routers/admin.py`

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.deps import require_admin
from app.database import supabase_admin
from app.services.scoring import score_match, recalculate_all

router = APIRouter(prefix="/admin", tags=["admin"])


class GoalIn(BaseModel):
    match_id: int
    player_id: int
    player_name: str
    team_tla: str | None = None
    minute: int | None = None


@router.post("/goals")
def add_goal(g: GoalIn, admin: dict = Depends(require_admin)):
    supabase_admin.table("match_goals").insert(g.model_dump()).execute()
    score_match(g.match_id)  # ricalcola subito i punti marcatore
    return {"ok": True}


@router.delete("/goals/{goal_id}")
def del_goal(goal_id: int, match_id: int, admin: dict = Depends(require_admin)):
    supabase_admin.table("match_goals").delete().eq("id", goal_id).execute()
    score_match(match_id)
    return {"ok": True}


@router.post("/scoring/recalculate")
def recalc(admin: dict = Depends(require_admin)):
    return recalculate_all()
```

### Integra lo scoring nel sync (`services/sync.py`)

Modifica `sync_matches()` per rilevare le partite appena passate a `FINISHED` e ricalcolarne
i punti automaticamente:

```python
# Dentro sync_matches(), PRIMA dell'upsert: leggi gli status correnti
existing = supabase_admin.table("matches").select("id, status").execute().data
prev_status = {m["id"]: m["status"] for m in existing}

# ... upsert delle rows come prima ...

# DOPO l'upsert: per ogni partita ora FINISHED che prima non lo era, calcola i punti
from app.services.scoring import score_match
for m in data.get("matches", []):
    if m["status"] == "FINISHED" and prev_status.get(m["id"]) != "FINISHED":
        score_match(m["id"])
```

### Registra i nuovi router in `main.py`

```python
from app.routers import health, auth, sync, matches, predictions, admin
# ... include_router per predictions e admin ...
app.include_router(predictions.router)
app.include_router(admin.router)
```

---

## 5. Frontend — pronostici

### `frontend/src/api/predictions.ts`

```typescript
import { apiFetch } from './client'

export function createPrediction(match_id: number, home_score: number, away_score: number) {
  return apiFetch('/predictions', {
    method: 'POST',
    body: JSON.stringify({ match_id, home_score, away_score }),
  })
}

export function createScorerPrediction(match_id: number, player_id: number) {
  return apiFetch('/predictions/scorer', {
    method: 'POST',
    body: JSON.stringify({ match_id, player_id }),
  })
}

export function getMyPredictions() {
  return apiFetch<any[]>('/predictions/me')
}

export function getMatchSummary(match_id: number) {
  return apiFetch(`/predictions/match/${match_id}/summary`)
}

export function getPlayers(teamTla: string) {
  return apiFetch<any[]>(`/players?team_tla=${teamTla}`)
}
```

> Aggiungi al backend un piccolo endpoint `GET /players?team_tla=` (router `players.py`)
> che ritorna i giocatori di una squadra, per popolare il dropdown marcatore.

### `frontend/src/screens/Predict.tsx` (schermata inserimento)

Specifica funzionale (Claude Code implementa col design system LMN):
- Riceve un `match` come prop.
- Mostra le due squadre con `crest` e nome.
- **Due score input** grandi affiancati (font display, stile tabellone).
- **Countdown live** al kickoff calcolato da `utc_date`; quando scade, disabilita gli input
  e mostra "Pronostici chiusi" (ma la verità resta lato server: il POST fallirebbe comunque).
- **Badge moltiplicatore** ben visibile per le fasi knockout (×2 / ×3).
- **Dropdown marcatore** (opzionale): carica i giocatori delle due squadre con `getPlayers`
  per entrambe le `tla`, l'utente sceglie un marcatore previsto.
- Bottone **Conferma** con stato loading; toast di esito. Gestisce il 403 (deadline) mostrando
  un messaggio chiaro.

### `frontend/src/screens/Matches.tsx` (potenzia quella dello Sprint 2)

- Selector data orizzontale (±7 giorni) + filtro per fase.
- Ogni card mostra lo **stato del pronostico** incrociando `getMyPredictions()` con le partite:
  - verde = pronosticato, giallo = da fare, rosso = scaduto e non pronosticato.
  - se la partita è `FINISHED`: mostra il risultato reale e i punti ottenuti dal pronostico.
- Tap sulla card apre `Predict` (se aperta) o il riepilogo (se iniziata).
- Dopo il kickoff, mostra il **summary** dei pronostici altrui (`getMatchSummary`).

---

## 6. Ordine di esecuzione (Claude Code)

1. Applica la migration `005`.
2. Crea `services/scoring.py` + `tests/test_scoring.py`, fai passare i test.
3. Crea `services/deadline.py`, `models/prediction.py`.
4. Crea i router `predictions.py`, `admin.py`, e il piccolo `players.py` (GET per tla).
5. Integra `score_match` nel `sync_matches()`.
6. Registra i router in `main.py`.
7. Frontend: `api/predictions.ts`, `screens/Predict.tsx`, potenzia `screens/Matches.tsx`,
   applicando il design system LMN.
8. Aggiorna README con le regole di gioco e il flusso admin per inserire i marcatori.
9. Verifica (sezione 7) e riporta gli esiti.

---

## 7. Verifica finale

- [ ] `uv run pytest tests/test_scoring.py` → tutti verdi.
- [ ] `POST /predictions` su una partita futura salva il pronostico; richiamarlo lo aggiorna.
- [ ] `POST /predictions` su una partita con `utc_date` nel passato → **403** (testato via API
      diretta, non solo UI). Per testarlo prima del torneo: usa l'override admin (Sprint 5) o
      una query SQL per portare temporaneamente una partita di test nel passato e a FINISHED.
- [ ] Porto a mano una partita di test a `FINISHED` con un risultato, lancio
      `POST /admin/scoring/recalculate`, e i `points` dei pronostici risultano corretti.
- [ ] `POST /admin/goals` inserisce un marcatore e i punti marcatore vengono assegnati a chi
      l'aveva pronosticato.
- [ ] `GET /predictions/me` ritorna i pronostici con `outcome` corretto (exact/sign/wrong/pending).
- [ ] `GET /predictions/match/{id}/summary` → 403 prima del kickoff, dati aggregati dopo.
- [ ] Frontend: inserisco un pronostico + un marcatore, vedo lo stato aggiornato nella lista;
      su una partita iniziata non riesco a modificare e vedo il riepilogo aggregato.

Quando tutti i check sono verdi, lo Sprint 3 è chiuso. Si passa allo Sprint 4: classifica,
statistiche profilo e achievement.

---

## Note importanti

- **La deadline vive lato server.** Il countdown nel frontend è solo UX: la verità è
  `assert_open_for_predictions`, che confronta `utc_date` con `now()` in UTC. Anche se
  qualcuno bypassasse l'interfaccia, il POST verrebbe rifiutato con 403.
- **Lo scoring è idempotente.** `score_match` riscrive i punti da zero ogni volta, quindi
  correzioni (risultato sbagliato dall'API, marcatore aggiunto in ritardo) si propagano
  semplicemente rieseguendolo. Nessun rischio di doppio conteggio.
- **Funzioni pure separate dai side effect.** `calculate_points` e `calculate_scorer_points`
  non toccano il DB: sono testabili in isolamento e sono il punto dove cambiare le regole.
- **Test dello scoring prima di giugno.** Dato che le partite vere iniziano l'11 giugno, per
  validare il calcolo punti end-to-end simula una partita FINISHED (override admin dello
  Sprint 5 o query SQL diretta) e verifica che i punti compaiano in classifica nello Sprint 4.
- **Marcatori manuali = 5 minuti a sera.** Con 3-4 partite/giorno nei gironi, l'inserimento
  dei marcatori via `POST /admin/goals` è rapido. Lo scoring scatta da solo dopo ogni insert.