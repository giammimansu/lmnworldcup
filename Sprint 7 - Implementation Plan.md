# LMN WORLD CUP — Implementation Plan: Sprint 7 (Recap giornata)

> Quando escono i risultati ufficiali, la Home mostra il recap della giornata conclusa:
> per ogni partita, il risultato reale e i pronostici di TUTTI i membri della lega con i
> punti ottenuti, più la classifica della singola giornata (chi ha fatto più punti nel turno).
>
> **Prerequisito**: Sprint 1-6 completi (scoring funzionante e leghe attive).
> Sprint additivo e di sola lettura: non modifica pronostici né scoring, li espone soltanto.

---

## 0. Obiettivo e definition of done

Al termine dello Sprint 7 deve essere vero **tutto** questo:

1. `GET /leagues/{league_id}/recap` ritorna l'ultima giornata con partite concluse: le partite
   finite, i pronostici di ogni membro della lega per ciascuna, i punti, e la classifica di giornata.
2. Privacy rispettata: solo partite **già iniziate/finite** vengono incluse (mai pronostici futuri).
3. Solo i **membri della lega** vedono il recap (403 altrimenti).
4. La Home mostra una sezione "Recap Giornata N": per ogni partita il risultato e la griglia
   dei pronostici dei membri; in cima, il **vincitore della giornata**.
5. Pre-torneo (nessuna giornata conclusa): empty state pulito, nessun errore.

Niente migration: usa solo tabelle esistenti (`matches`, `predictions`, `scorer_predictions`,
`league_members`, `profiles`).

---

## 1. Scelta di design: quale "giornata"

- Con `?matchday=N`: usa quella esplicitamente.
- Senza parametro (default): **ultima giornata con almeno una partita FINISHED** — il turno più
  recente di cui ci sono risultati. Mostra di quel turno solo le partite finite (più "viva":
  appare man mano che i risultati arrivano).
- *Variante "solo turni completi"*: usa la matchday massima in cui TUTTE le partite sono FINISHED.
  Conta solo nei gironi (una giornata dura 2-3 giorni). È un solo filtro in più; documentata sotto.

---

## 2. Backend

### `backend/app/routers/recap.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from app.deps import get_current_user
from app.database import supabase_admin

router = APIRouter(prefix="/leagues", tags=["recap"])


def _latest_finished_matchday() -> int | None:
    finished = supabase_admin.table("matches").select("matchday").eq(
        "status", "FINISHED"
    ).order("matchday", desc=True).limit(1).execute().data
    return finished[0]["matchday"] if finished else None


@router.get("/{league_id}/recap")
def league_recap(
    league_id: str,
    matchday: int | None = None,
    user: dict = Depends(get_current_user),
):
    # 1) Appartenenza alla lega
    is_member = supabase_admin.table("league_members").select("user_id").eq(
        "league_id", league_id
    ).eq("user_id", user["id"]).execute().data
    if not is_member:
        raise HTTPException(403, "Non sei membro di questa lega")

    # 2) Giornata target
    md = matchday if matchday is not None else _latest_finished_matchday()
    if md is None:
        return {"matchday": None, "matches": [], "ranking": []}

    # 3) Membri (id -> nome)
    members = supabase_admin.table("league_members").select(
        "user_id, profiles(display_name)"
    ).eq("league_id", league_id).execute().data
    member_ids = [m["user_id"] for m in members]
    names = {m["user_id"]: m["profiles"]["display_name"] for m in members}

    # 4) Partite FINISHED della giornata (finite => già iniziate => privacy ok)
    matches = supabase_admin.table("matches").select("*").eq(
        "matchday", md
    ).eq("status", "FINISHED").order("utc_date").execute().data
    match_ids = [mt["id"] for mt in matches]
    if not match_ids:
        return {"matchday": md, "matches": [], "ranking": []}

    # 5) Pronostici risultato dei membri
    preds = supabase_admin.table("predictions").select(
        "user_id, match_id, home_score, away_score, points"
    ).in_("match_id", match_ids).in_("user_id", member_ids).execute().data

    # 6) Pronostici marcatore (arricchimento opzionale)
    scorer_preds = supabase_admin.table("scorer_predictions").select(
        "user_id, match_id, points, players(name)"
    ).in_("match_id", match_ids).in_("user_id", member_ids).execute().data
    scorer_by = {(s["user_id"], s["match_id"]): s for s in scorer_preds}

    preds_by_match: dict[int, list] = {mid: [] for mid in match_ids}
    points_per_member: dict[str, int] = {uid: 0 for uid in member_ids}

    for p in preds:
        sp = scorer_by.get((p["user_id"], p["match_id"]))
        scorer_pts = (sp or {}).get("points") or 0
        total = (p["points"] or 0) + scorer_pts
        points_per_member[p["user_id"]] = points_per_member.get(p["user_id"], 0) + total
        preds_by_match[p["match_id"]].append({
            "user_id": p["user_id"],
            "display_name": names.get(p["user_id"], "?"),
            "home_score": p["home_score"],
            "away_score": p["away_score"],
            "points": p["points"] or 0,
            "scorer_name": (sp or {}).get("players", {}).get("name") if sp else None,
            "scorer_points": scorer_pts,
        })

    # 7) Output partite (pronostici ordinati per punti decrescenti)
    out_matches = []
    for mt in matches:
        rows = sorted(preds_by_match.get(mt["id"], []), key=lambda r: -r["points"])
        out_matches.append({
            "id": mt["id"],
            "home_team_name": mt["home_team_name"], "home_team_tla": mt["home_team_tla"],
            "home_team_crest": mt["home_team_crest"],
            "away_team_name": mt["away_team_name"], "away_team_tla": mt["away_team_tla"],
            "away_team_crest": mt["away_team_crest"],
            "home_score": mt["home_score"], "away_score": mt["away_score"],
            "stage": mt["stage"],
            "predictions": rows,
        })

    # 8) Classifica di giornata (solo punti di questa matchday)
    ranking = sorted(
        ({"user_id": uid, "display_name": names.get(uid, "?"), "points": pts}
         for uid, pts in points_per_member.items()),
        key=lambda r: -r["points"],
    )

    return {"matchday": md, "matches": out_matches, "ranking": ranking}
```

Registra in `main.py` (stesso prefisso `/leagues` di `leagues.py`: ok, i path non collidono).

> **Variante "solo turni completi"**: in `_latest_finished_matchday`, prendi la max matchday in
> cui il numero di partite FINISHED eguaglia il totale di partite di quella matchday. Una query
> di conteggio in più, nessun'altra modifica.

---

## 3. Frontend

### `frontend/src/api/recap.ts`

```typescript
import { apiFetch } from './client'

export type RecapPrediction = {
  user_id: string; display_name: string
  home_score: number; away_score: number; points: number
  scorer_name: string | null; scorer_points: number
}
export type RecapMatch = {
  id: number
  home_team_name: string; home_team_tla: string; home_team_crest: string
  away_team_name: string; away_team_tla: string; away_team_crest: string
  home_score: number; away_score: number; stage: string
  predictions: RecapPrediction[]
}
export type Recap = {
  matchday: number | null
  matches: RecapMatch[]
  ranking: { user_id: string; display_name: string; points: number }[]
}

export const getRecap = (leagueId: string, matchday?: number) =>
  apiFetch<Recap>(`/leagues/${leagueId}/recap${matchday ? `?matchday=${matchday}` : ''}`)
```

### Sezione "Recap Giornata" in `screens/Home.tsx` (design system LMN)

Chiama `getRecap(current.id)` usando la lega selezionata dal `LeagueContext`.

- **Header**: "Recap Giornata {matchday}" con icona; se `matchday === null`, empty state
  ("Il recap apparirà dopo le prime partite concluse") e stop.
- **Vincitore della giornata** (`ranking[0]` se punti > 0): card in evidenza con avatar, nome,
  punti del turno — il momento social. Se ci sono abbastanza membri, mostra il podio di giornata.
- **Una card per partita** (`matches`):
  - Crest + nomi + **risultato reale** in grande (font display).
  - Griglia compatta dei pronostici dei membri: nome, pronostico ("2-1"), badge punti
    (verde = esatto, ambra = segno, grigio = 0).
  - Se presente, marcatore pronosticato (`scorer_name`) con esito.
  - Pronostici ordinati per punti decrescenti.
- **Selettore giornata** (consigliato): frecce ‹ › per navigare ai turni precedenti conclusi,
  richiamando `getRecap(current.id, md)`.
- **Aggiornamento**: insieme al polling della classifica (60s) o al cambio di lega. Nessun
  real-time aggiuntivo.

---

## 4. Timing (come e quando appare)

Automatico, agganciato al flusso esistente:
1. Partita finisce → il sync (cron, Sprint 2) la porta a `FINISHED` con il risultato.
2. `score_match` (Sprint 3) calcola i punti.
3. Al successivo caricamento della Home, il recap include quella partita.

Unica azione manuale: i **marcatori**, se vuoi mostrare l'esito dei pronostici marcatore
(inserimento via pannello admin, Sprint 5). Il recap dei risultati funziona comunque senza.

---

## 5. Ordine di esecuzione (Claude Code)

1. Backend: crea `routers/recap.py`, registralo in `main.py`. Nessuna migration.
2. Frontend: crea `api/recap.ts`, aggiungi la sezione recap a `screens/Home.tsx` con empty
   state e (opzionale) selettore giornata.
3. Applica il design system LMN.
4. Aggiorna il README: quando appare il recap, ruolo dei marcatori, variante turni completi.
5. Verifica (sezione 6).

---

## 6. Verifica finale

- [ ] Pre-torneo: `GET /leagues/{id}/recap` → `matchday: null`; Home mostra l'empty state.
- [ ] Simulo una giornata conclusa (override admin → partite FINISHED): il recap mostra quelle
      partite con i pronostici dei membri e i punti corretti.
- [ ] La classifica di giornata (`ranking`) somma solo i punti di quella matchday ed è ordinata.
- [ ] Un utente NON membro → 403 sul recap.
- [ ] Solo partite FINISHED compaiono: nessun pronostico futuro è mai esposto.
- [ ] Cambiando lega nel selettore, il recap mostra i pronostici dei membri di QUELLA lega.
- [ ] `?matchday=1` esplicito mostra la giornata 1 anche se ce ne sono di più recenti.
- [ ] (Se usati) i marcatori pronosticati appaiono con il loro esito.

Con tutti i check verdi, lo Sprint 7 è chiuso.

---

## Note importanti

- **Sola lettura, zero migration.** Aggrega dati esistenti; rischio minimo sull'esistente.
- **Privacy a doppia barriera.** Solo partite `FINISHED` (quindi già iniziate): RLS + filtro
  status rendono impossibile esporre un pronostico prima del kickoff.
- **Punti coerenti.** Somma gli stessi campi della classifica generale: vincitore di giornata e
  classifica totale non possono contraddirsi.
- **Scala con la lega.** La query guarda un turno alla volta filtrato sui membri: resta leggera
  anche a torneo avanzato.