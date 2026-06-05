# LMN WORLD CUP — Implementation Plan: Sprint 4

> Classifica con trend, profilo utente con statistiche e grafici, e sistema di
> achievement. È lo sprint dell'engagement: trasforma i punti calcolati nello
> Sprint 3 in competizione visibile e gratificazione.
>
> **Prerequisito**: Sprint 1-3 completi. In particolare i `points` su `predictions`
> e `scorer_predictions` vengono calcolati correttamente da `score_match`.

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 4 deve essere vero **tutto** questo:

1. `GET /leaderboard` ritorna la classifica ordinata per punti totali (risultato + marcatore),
   con posizione, nome, punti, % precisione e **trend** (variazione di posizione vs ieri).
2. Uno snapshot giornaliero della classifica viene salvato (per calcolare il trend).
3. `GET /users/me/stats` ritorna statistiche dettagliate: punti, esatti, segni, sbagliati,
   mancati, % precisione, punti per giornata, ultimi 10 pronostici.
4. Gli achievement si sbloccano automaticamente dopo il calcolo punti; `GET /users/me/achievements`
   li elenca (sbloccati + ancora da sbloccare).
5. Frontend: schermata **Home** con podio + classifica (utente evidenziato, trend, polling
   ogni 60s) e schermata **Profilo** con stat card, grafico punti per giornata (solo CSS) e badge.

---

## 1. Nuove migration SQL

### `backend/migrations/006_leaderboard_and_achievements.sql`

```sql
-- VIEW: totali punti per utente (somma risultato + marcatore).
create or replace view leaderboard_totals as
select
    p.id                                   as user_id,
    p.display_name,
    coalesce(pr.result_points, 0) + coalesce(sc.scorer_points, 0) as total_points,
    coalesce(pr.exact_count, 0)            as exact_count,
    coalesce(pr.finished_count, 0)         as finished_count
from profiles p
left join (
    select user_id,
           sum(coalesce(points, 0))                              as result_points,
           count(*) filter (where points = 3 or points = 6 or points = 9) as exact_count,
           count(*) filter (where points is not null)            as finished_count
    from predictions
    group by user_id
) pr on pr.user_id = p.id
left join (
    select user_id, sum(coalesce(points, 0)) as scorer_points
    from scorer_predictions
    group by user_id
) sc on sc.user_id = p.id;

-- Snapshot giornaliero della classifica (per il trend).
create table if not exists leaderboard_snapshots (
    id        bigserial primary key,
    user_id   uuid not null references profiles(id) on delete cascade,
    snap_date date not null,
    position  int not null,
    points    int not null,
    unique (user_id, snap_date)
);

-- Catalogo achievement + sblocchi per utente.
create table if not exists achievements (
    code        text primary key,
    name        text not null,
    description text not null,
    icon        text
);

create table if not exists user_achievements (
    user_id        uuid not null references profiles(id) on delete cascade,
    achievement_code text not null references achievements(code) on delete cascade,
    unlocked_at    timestamptz not null default now(),
    primary key (user_id, achievement_code)
);

alter table leaderboard_snapshots enable row level security;
alter table achievements          enable row level security;
alter table user_achievements     enable row level security;

create policy "snapshots readable" on leaderboard_snapshots
    for select to authenticated using (true);
create policy "achievements readable" on achievements
    for select to authenticated using (true);
create policy "user_achievements readable" on user_achievements
    for select to authenticated using (true);

-- Seed del catalogo achievement
insert into achievements (code, name, description, icon) values
  ('primo_sangue', 'Primo Sangue', 'Primo a inserire un pronostico nel torneo', 'ti-droplet'),
  ('cecchino', 'Cecchino', '3 risultati esatti totali', 'ti-target'),
  ('veggente', 'Veggente', '5 pronostici corretti di fila', 'ti-eye'),
  ('en_plein', 'En Plein', 'Tutti i pronostici esatti in una giornata', 'ti-stars'),
  ('comeback', 'Rimonta', 'Risalita di 3+ posizioni in un giorno', 'ti-trending-up')
on conflict (code) do nothing;
```

> **Nota sull'`exact_count`**: nel view sopra è approssimato controllando i valori-punteggio
> tipici di un esatto (3, 6, 9 = base ×1/×2/×3). Se preferisci precisione assoluta, aggiungi
> una colonna booleana `is_exact` su `predictions` valorizzata da `score_match` e contala.
> Per un gioco tra colleghi l'approssimazione va benissimo; il piano lo segnala come opzione.

---

## 2. Backend — classifica e trend

### `backend/app/routers/leaderboard.py`

```python
from fastapi import APIRouter, Depends
from datetime import date, timedelta
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("")
def leaderboard(user: dict = Depends(get_current_user)):
    rows = supabase_admin.table("leaderboard_totals").select("*").execute().data
    rows.sort(key=lambda r: -r["total_points"])

    # Trend: confronto con lo snapshot di ieri (se esiste).
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    snaps = supabase_admin.table("leaderboard_snapshots").select(
        "user_id, position"
    ).eq("snap_date", yesterday).execute().data
    prev_pos = {s["user_id"]: s["position"] for s in snaps}

    out = []
    for i, r in enumerate(rows):
        pos = i + 1
        prev = prev_pos.get(r["user_id"])
        trend = (prev - pos) if prev is not None else 0  # >0 = salito
        finished = r.get("finished_count") or 0
        accuracy = round((r.get("exact_count") or 0) / finished * 100, 1) if finished else 0.0
        out.append({
            "position": pos,
            "user_id": r["user_id"],
            "display_name": r["display_name"],
            "total_points": r["total_points"],
            "exact_count": r.get("exact_count") or 0,
            "accuracy": accuracy,
            "trend": trend,
            "is_me": r["user_id"] == user["id"],
        })
    return out
```

### `backend/app/services/snapshots.py`

```python
from datetime import date
from app.database import supabase_admin


def take_snapshot() -> dict:
    """Salva la classifica odierna. Idempotente per giorno (upsert su user_id+snap_date)."""
    rows = supabase_admin.table("leaderboard_totals").select("*").execute().data
    rows.sort(key=lambda r: -r["total_points"])
    today = date.today().isoformat()
    snaps = [
        {"user_id": r["user_id"], "snap_date": today,
         "position": i + 1, "points": r["total_points"]}
        for i, r in enumerate(rows)
    ]
    if snaps:
        supabase_admin.table("leaderboard_snapshots").upsert(
            snaps, on_conflict="user_id,snap_date"
        ).execute()
    return {"snapshot_date": today, "users": len(snaps)}
```

Esponi lo snapshot via cron: aggiungi a `routers/sync.py` un endpoint
`GET /sync/snapshot` protetto da `CRON_SECRET` che chiama `take_snapshot()`, e schedulalo
in `vercel.json` una volta al giorno (es. `"schedule": "5 0 * * *"`).

---

## 3. Backend — statistiche profilo

### `backend/app/routers/stats.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/users", tags=["stats"])


def _compute_stats(user_id: str) -> dict:
    preds = supabase_admin.table("predictions").select(
        "points, home_score, away_score, matches(matchday, status, home_score, away_score, stage)"
    ).eq("user_id", user_id).execute().data
    scorer = supabase_admin.table("scorer_predictions").select("points").eq(
        "user_id", user_id
    ).execute().data

    result_points = sum((p["points"] or 0) for p in preds)
    scorer_points = sum((s["points"] or 0) for s in scorer)

    exact = sign = wrong = pending = 0
    points_by_matchday: dict[int, int] = {}
    for p in preds:
        m = p["matches"]
        if m["status"] != "FINISHED" or p["points"] is None:
            pending += 1
            continue
        if p["home_score"] == m["home_score"] and p["away_score"] == m["away_score"]:
            exact += 1
        elif p["points"] > 0:
            sign += 1
        else:
            wrong += 1
        md = m.get("matchday") or 0
        points_by_matchday[md] = points_by_matchday.get(md, 0) + (p["points"] or 0)

    finished = exact + sign + wrong
    accuracy = round(exact / finished * 100, 1) if finished else 0.0

    return {
        "total_points": result_points + scorer_points,
        "result_points": result_points,
        "scorer_points": scorer_points,
        "predictions_total": len(preds),
        "exact": exact, "sign": sign, "wrong": wrong, "pending": pending,
        "accuracy": accuracy,
        "points_by_matchday": [
            {"matchday": k, "points": v} for k, v in sorted(points_by_matchday.items())
        ],
    }


@router.get("/me/stats")
def my_stats(user: dict = Depends(get_current_user)):
    stats = _compute_stats(user["id"])
    # Ultimi 10 pronostici con esito
    recent = supabase_admin.table("predictions").select(
        "home_score, away_score, points, updated_at, "
        "matches(home_team_tla, away_team_tla, home_score, away_score, status, utc_date)"
    ).eq("user_id", user["id"]).order("updated_at", desc=True).limit(10).execute().data
    stats["recent"] = recent
    return stats


@router.get("/{user_id}/stats")
def public_stats(user_id: str, user: dict = Depends(get_current_user)):
    # Versione pubblica: solo aggregati, niente storico dettagliato.
    s = _compute_stats(user_id)
    return {k: s[k] for k in ("total_points", "exact", "sign", "wrong", "accuracy")}
```

---

## 4. Backend — achievement

### `backend/app/services/achievements.py`

```python
from app.database import supabase_admin


def _unlock(user_id: str, code: str):
    supabase_admin.table("user_achievements").upsert(
        {"user_id": user_id, "achievement_code": code},
        on_conflict="user_id,achievement_code",
    ).execute()


def evaluate_for_user(user_id: str):
    """Valuta e sblocca achievement per un utente. Chiamata dopo score_match."""
    preds = supabase_admin.table("predictions").select(
        "points, home_score, away_score, updated_at, "
        "matches(matchday, status, home_score, away_score)"
    ).eq("user_id", user_id).execute().data

    finished = [p for p in preds if p["matches"]["status"] == "FINISHED" and p["points"] is not None]

    def is_exact(p):
        m = p["matches"]
        return p["home_score"] == m["home_score"] and p["away_score"] == m["away_score"]

    # cecchino: 3 esatti totali
    if sum(1 for p in finished if is_exact(p)) >= 3:
        _unlock(user_id, "cecchino")

    # veggente: 5 corretti (punti > 0) di fila, in ordine cronologico di partita
    chrono = sorted(finished, key=lambda p: p["matches"].get("matchday") or 0)
    streak = 0
    for p in chrono:
        streak = streak + 1 if (p["points"] or 0) > 0 else 0
        if streak >= 5:
            _unlock(user_id, "veggente")
            break

    # en_plein: in almeno una giornata, tutti i pronostici di quella giornata sono esatti
    by_md: dict[int, list] = {}
    for p in finished:
        by_md.setdefault(p["matches"].get("matchday") or 0, []).append(p)
    for md, ps in by_md.items():
        if len(ps) >= 2 and all(is_exact(p) for p in ps):
            _unlock(user_id, "en_plein")
            break


def evaluate_primo_sangue():
    """Sblocca 'primo sangue' al primo che ha mai inserito un pronostico."""
    first = supabase_admin.table("predictions").select("user_id, created_at").order(
        "created_at"
    ).limit(1).execute().data
    if first:
        _unlock(first[0]["user_id"], "primo_sangue")
```

Aggancia in `score_match` (Sprint 3): dopo aver aggiornato i punti, chiama
`evaluate_for_user(user_id)` per ogni utente coinvolto, e `evaluate_primo_sangue()` una volta.
Il "comeback" si valuta nello snapshot giornaliero confrontando le posizioni.

### `backend/app/routers/achievements.py`

```python
from fastapi import APIRouter, Depends
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/users/me/achievements", tags=["achievements"])


@router.get("")
def my_achievements(user: dict = Depends(get_current_user)):
    catalog = supabase_admin.table("achievements").select("*").execute().data
    mine = supabase_admin.table("user_achievements").select("achievement_code").eq(
        "user_id", user["id"]
    ).execute().data
    unlocked = {m["achievement_code"] for m in mine}
    return [{**a, "unlocked": a["code"] in unlocked} for a in catalog]
```

Registra `leaderboard`, `stats`, `achievements` in `main.py`.

---

## 5. Frontend

### `frontend/src/api/leaderboard.ts` e `stats.ts`

```typescript
import { apiFetch } from './client'

export type Row = {
  position: number; user_id: string; display_name: string
  total_points: number; exact_count: number; accuracy: number
  trend: number; is_me: boolean
}
export const getLeaderboard = () => apiFetch<Row[]>('/leaderboard')
export const getMyStats = () => apiFetch<any>('/users/me/stats')
export const getMyAchievements = () => apiFetch<any[]>('/users/me/achievements')
```

### `frontend/src/screens/Home.tsx` — classifica

Specifica funzionale (Claude Code implementa col design system LMN):
- **Widget prossima partita** in alto con countdown (prima partita futura da `/matches`).
- **Podio top-3**: avatar con iniziali (colore deterministico dal nome), badge posizione,
  punti. Stile premium, oro per il primo.
- **Lista** dal 4° in giù, scrollabile; la riga dell'utente corrente (`is_me`) sempre
  evidenziata anche se fuori dai primi.
- Per ogni riga: posizione, nome, punti, freccia **trend** (↑ verde / ↓ rosso / – grigio
  in base al segno di `trend`), % precisione.
- **Polling ogni 60s** con `setInterval` per riaggiornare la classifica senza ricaricare.

### `frontend/src/screens/Profile.tsx` — profilo

- Header: avatar grande, `display_name`, posizione attuale (dalla leaderboard).
- **Grid 2×2 di stat card**: Punti totali · Pronostici esatti · % Precisione · Partite mancate.
- **Grafico a barre** dei punti per giornata: realizzato SOLO con `<div>` e CSS (altezza
  proporzionale), **niente librerie chart**. Una barra per `matchday` da `points_by_matchday`.
- **Achievement**: griglia di badge da `/users/me/achievements`; quelli con `unlocked:false`
  resi in grigio/opachi con icona lucchetto.
- **Storico** ultimi 10 pronostici (`recent`): partita (tla vs tla), tuo pronostico, risultato
  reale, punti, ed esito colorato (✓ esatto / ~ segno / ✗ sbagliato / ⏳ in attesa).

---

## 6. Ordine di esecuzione (Claude Code)

1. Applica la migration `006` (view, snapshots, achievements + seed).
2. Backend: crea `routers/leaderboard.py`, `services/snapshots.py`, `routers/stats.py`,
   `services/achievements.py`, `routers/achievements.py`.
3. Aggancia `evaluate_for_user` e `evaluate_primo_sangue` dentro `score_match`.
4. Aggiungi l'endpoint `GET /sync/snapshot` (protetto da CRON_SECRET) e il cron giornaliero
   in `vercel.json`.
5. Registra i nuovi router in `main.py`.
6. Frontend: `api/leaderboard.ts` + `stats.ts`, schermate `Home.tsx` e `Profile.tsx` col
   design system LMN.
7. Aggiorna README con la spiegazione del trend (richiede ≥2 snapshot) e degli achievement.
8. Verifica (sezione 7) e riporta gli esiti.

---

## 7. Verifica finale

- [ ] Migration `006` applicata; la view `leaderboard_totals` ritorna righe coerenti.
- [ ] Con alcuni pronostici finiti e scoreati, `GET /leaderboard` ordina correttamente per punti
      e calcola la % precisione.
- [ ] Eseguo `GET /sync/snapshot` due giorni di fila (o simulo due `snap_date` via SQL): il
      campo `trend` in `/leaderboard` mostra variazioni di posizione reali.
- [ ] `GET /users/me/stats` ritorna conteggi corretti (esatti/segni/sbagliati/mancati),
      la % precisione e l'array `points_by_matchday`.
- [ ] Forzo 3 risultati esatti per un utente e dopo `score_match` l'achievement "cecchino"
      risulta sbloccato in `GET /users/me/achievements`.
- [ ] Frontend Home: podio + lista, utente evidenziato, frecce trend coerenti, refresh in
      polling senza reload.
- [ ] Frontend Profilo: stat card corrette, grafico per giornata in CSS, badge bloccati/sbloccati,
      storico ultimi 10 con esiti colorati.

Quando tutti i check sono verdi, lo Sprint 4 è chiuso. Si passa allo Sprint 5: tabellone
knockout, pannello admin completo, rifinitura e go-live.

---

## Note importanti

- **Il trend richiede almeno due snapshot.** Al primo giorno il trend è 0 per tutti (manca
  il confronto). Per testarlo prima del torneo, inserisci a mano due righe in
  `leaderboard_snapshots` con date diverse.
- **La view fa il lavoro pesante.** Aggregare i punti in `leaderboard_totals` a livello SQL è
  più efficiente e più semplice che sommare in Python; il backend si limita a ordinare e ad
  aggiungere trend e precisione.
- **Precisione dell'`exact_count`.** Il view lo deduce dai valori-punteggio tipici (3/6/9).
  Se in futuro cambi le costanti di punteggio, aggiorna anche quel filtro — oppure adotta la
  colonna `is_exact` su `predictions` (più robusta) come indicato nella nota della migration.
- **Achievement idempotenti.** `_unlock` fa upsert: rieseguire la valutazione non crea
  duplicati né sblocca due volte. Sicuro da chiamare a ogni `score_match`.
- **Niente librerie chart nel profilo.** Il grafico a barre è volutamente in puro CSS: meno
  dipendenze, rendering immediato, e coerenza col design system senza override di stile.