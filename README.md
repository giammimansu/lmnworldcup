# LMN World Cup

Webapp privata di pronostici per i Mondiali 2026 tra colleghi.
**Indovina. Scala. Domina.**

## Regole del gioco

- Pronostichi il **risultato esatto** di ogni partita, fino al calcio d'inizio
  (deadline imposta lato server, in UTC).
- Punteggio:
  - **Risultato esatto**: 3 punti
  - **Segno giusto** (1/X/2): 1 punto
  - Sbagliato: 0 punti
- Moltiplicatori per fase: Gironi **x1** · Sedicesimi/Ottavi/Quarti **x2** ·
  Semifinali/Finale 3° posto/Finale **x3**.
- **Bonus marcatori**: i marcatori previsti sono legati al risultato. Per un pronostico
  H-A scegli **H giocatori della squadra di casa + A della trasferta** (duplicati ammessi
  per doppiette/triplette; 0-0 = nessun marcatore). **+2 per ogni marcatore azzeccato**
  (intersezione multiset coi gol reali); il moltiplicatore di fase **non** si applica al
  bonus. I gol reali li registra l'admin a fine partita.
- Knockout: conta il risultato dopo i supplementari, **mai i rigori**.
- I pronostici degli altri sono visibili **solo dopo il kickoff**.
- Achievement sbloccabili: Primo sangue, Cecchino, Veggente, En plein, Comeback.

## Stack

- **Backend**: Python 3.11+ / FastAPI, gestito con [uv](https://docs.astral.sh/uv/)
- **Database**: Supabase (PostgreSQL)
- **Frontend**: React + Vite + TypeScript
- **Deploy**: Vercel (frontend statico + backend serverless Python)

## Struttura

```
├── backend/          # API FastAPI
│   ├── app/          # codice applicativo
│   ├── migrations/   # SQL da applicare su Supabase
│   └── tests/
├── frontend/         # SPA React + Vite
├── api/index.py      # entrypoint serverless Vercel
└── vercel.json
```

## Setup locale

### 1. Variabili d'ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Compila i valori da **Supabase → Project Settings → API**:

| File | Variabile | Valore |
|------|-----------|--------|
| `backend/.env` | `SUPABASE_URL` | Project URL |
| `backend/.env` | `SUPABASE_ANON_KEY` | anon/publishable key |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**mai nel frontend**) |
| `backend/.env` | `FOOTBALL_DATA_API_KEY` | chiave da football-data.org (Sprint 2) |
| `frontend/.env` | `VITE_SUPABASE_URL` | Project URL |
| `frontend/.env` | `VITE_SUPABASE_ANON_KEY` | anon/publishable key |
| `frontend/.env` | `VITE_API_URL` | `http://localhost:8000` in locale |

### 2. Database (migration)

Nel dashboard Supabase: **SQL Editor → New query**, incolla ed esegui **in ordine**:

1. `backend/migrations/001_initial_schema.sql`
2. `backend/migrations/002_rls_policies.sql`
3. `backend/migrations/003_auth_trigger.sql` (auto-creazione profilo alla registrazione)
4. `backend/migrations/004_leaderboard_achievements.sql` (snapshot classifica + achievements)
5. `backend/migrations/005_leagues.sql` (leghe private — Sprint 6)
6. `backend/migrations/006_players.sql` (rose giocatori — Sprint 8)
7. `backend/migrations/007_goals_and_scorer_predictions.sql` (marcatori — Sprint 8)
8. `backend/migrations/008_scorer_predictions_multi.sql` (marcatori multipli — Sprint 8.1)

Dopo la `006`, popola le rose: scarica il PDF FIFA "Squad Lists" in
`backend/` ed esegui `cd backend && uv run python -m import_squads_from_fifa <pdf>`.

### 3. Backend

```bash
cd backend
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

Verifica: `curl localhost:8000/ping` → `{"status":"ok","db":true}`
(`db:true` richiede le migration applicate su Supabase).

Test: `uv run pytest`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173): deve mostrare
"Backend connesso. Database: OK".

## Deploy su Vercel

1. Pusha la repo su GitHub e importala in Vercel (**Add New → Project**).
2. Lascia che `vercel.json` configuri build e routing:
   - frontend buildato e servito alla root
   - `/api/*` instradato alla funzione serverless FastAPI (`api/index.py`)
3. In **Project Settings → Environment Variables** inserisci tutte le variabili
   di `backend/.env.example` e `frontend/.env.example`, con due differenze per
   la produzione:
   - `VITE_API_URL=/api`
   - `ALLOWED_ORIGINS=https://<tuo-progetto>.vercel.app`
4. Deploy. Verifica `https://<tuo-progetto>.vercel.app/api/ping`.

> **Alternativa**: se il deploy combinato dà problemi, crea due progetti Vercel
> separati (frontend con preset Vite, backend Python). In quel caso `VITE_API_URL`
> punta all'URL pubblico del backend e `ALLOWED_ORIGINS` include il dominio del
> frontend.

## Autenticazione & sync (Sprint 2)

### Primo admin

Dopo il primo login (o invito), promuovi il tuo utente da SQL Editor:

```sql
update profiles set is_admin = true where email = 'tua.email@lastminute.com';
```

### Invitare colleghi

Dalla pagina **/admin** (visibile solo agli admin): sezione "Invita colleghi" → email → Invita.
Oppure via API: `POST /auth/invite` con body `{"email": "...", "display_name": "..."}`.
Supabase invia il magic link; il trigger crea il profilo automaticamente.
Al primo accesso il collega può impostare una password da **/password** (poi entra
con email+password, senza più email).

### Override risultati (admin)

Se football-data.org sbaglia un risultato: pagina **/admin** → "Override risultati" →
scegli la data → correggi score/status → Salva. I punti dei pronostici vengono
ricalcolati automaticamente. Ogni override è tracciato nel sync log.

### Sync partite

- Manuale: `POST /sync/matches` (admin). Popola `matches` da football-data.org
  (Mondiale 2026, ~104 partite) con upsert idempotente. Esito in `sync_log`.
- Automatico: cron Vercel ogni 15 minuti su `GET /api/sync/cron`, protetto da
  `CRON_SECRET` (Vercel lo invia come `Authorization: Bearer <CRON_SECRET>` se
  la env var `CRON_SECRET` è configurata sul progetto).
  Nota: il piano Hobby di Vercel limita i cron a 1 esecuzione/giorno — per i
  15 minuti serve il piano Pro, oppure un servizio esterno (es. cron-job.org)
  che chiami l'endpoint con l'header giusto.

### Endpoint partite

- `GET /matches?date=YYYY-MM-DD&stage=GROUP_STAGE&group=GROUP_A&matchday=1` — lista filtrata
- `GET /matches/{id}` — dettaglio

## Leghe private (Sprint 6)

Ogni utente può creare la propria lega, invitare amici con un codice e vedere una
classifica ristretta ai membri. **I pronostici e il punteggio non cambiano**: un
pronostico vale in tutte le leghe a cui partecipi — cambia solo come si aggregano
le classifiche.

### Ruoli

- **app-admin** (tu): sync partite, override risultati, marcatori. Globale, indipendente
  dalle leghe (flag `is_admin` sul profilo).
- **proprietario di lega**: rinomina, rigenera codice, rimuove membri. Nessun potere
  sui dati del torneo.
- **membro**: pronostica e vede la classifica delle sue leghe.

### Registrazione self-service

Dallo Sprint 6 il magic link crea l'utente se non esiste (`shouldCreateUser: true`).
Assicurati che in **Supabase → Authentication → Providers → Email** le signup pubbliche
siano abilitate. `POST /auth/invite` resta utile solo per nominare app-admin.

### Come si usa

- **Creare**: Profilo → "Le mie leghe" → *Crea una lega* → nome → ottieni il codice
  invito (es. `WC26-X7K2P`), con bottoni Copia / Copia link.
- **Unirsi**: *Unisciti con un codice* → inserisci il codice. Oppure apri il link
  condiviso `…/leagues?code=WC26-XXXXX` (il join parte da solo, anche dopo il login).
- **Più leghe**: in Home un selettore in cima alla classifica cambia la lega corrente.
- **Gestione** (solo owner): rinomina, rigenera codice (invalida il vecchio), rimuovi
  membri. I non-owner hanno "Esci dalla lega"; l'owner non può uscire (deve eliminare
  o trasferire — il trasferimento è un'estensione futura).

### Endpoint principali

- `POST /leagues` · `POST /leagues/join` · `GET /leagues/me`
- `GET /leagues/{id}/members` · `GET /leagues/{id}/leaderboard`
- `PATCH /leagues/{id}` · `POST /leagues/{id}/regenerate-code`
- `DELETE /leagues/{id}/members/{member_id}` · `POST /leagues/{id}/leave`

> **Privacy**: la RLS garantisce che un utente veda solo le leghe di cui è membro e i
> relativi membri. La funzione `is_league_member` (SECURITY DEFINER) evita la ricorsione
> nelle policy di `league_members` — non rimuoverla.

Verifica E2E: `uv run python scripts/verify_sprint6.py` (backend attivo su :8000).

## Recap giornata (Sprint 7)

Quando arrivano i risultati ufficiali, la Home mostra il recap dell'ultima giornata
conclusa della lega selezionata: per ogni partita il risultato reale e i pronostici di
**tutti i membri** con i punti, più il **vincitore di giornata** e la classifica del turno.
Sola lettura, zero migration: aggrega `matches`, `predictions`, `league_members`, `profiles`.

### Come appare

Automatico, agganciato al flusso esistente:
1. Partita finisce → il sync la porta a `FINISHED` con il risultato.
2. `score_match` (Sprint 3) calcola i punti.
3. Al caricamento della Home, il recap include quella partita.

- **Quale giornata**: default = ultima matchday con almeno una partita `FINISHED`. Con
  `?matchday=N` forzi un turno specifico. Frecce ‹ › in Home per navigare ai turni precedenti.
- **Privacy a doppia barriera**: solo partite `FINISHED` (già iniziate) → nessun pronostico
  futuro è mai esposto. Solo i membri della lega vedono il recap (403 altrimenti).
- **Pre-torneo**: nessuna giornata conclusa → `matchday: null`, empty state pulito.
- **Punti coerenti**: somma gli stessi `predictions.points` della classifica generale, quindi
  vincitore di giornata e classifica totale non si contraddicono.

> **Marcatori (Sprint 8)**: il recap mostra anche il marcatore scelto da ogni membro
> accanto al pronostico risultato, col bonus (+2 / 0), e ne somma i punti nella
> classifica di giornata.

### Endpoint

- `GET /leagues/{id}/recap[?matchday=N]` — recap della giornata (solo membri).

Verifica E2E: `uv run python scripts/verify_sprint7.py` (backend attivo su :8000).

## Marcatori (Sprint 8)

Pronostico marcatori end-to-end: nella schermata pronostico compaiono tante tendine
quanti i gol previsti (H per la squadra di casa, A per la trasferta), con la stessa
deadline del pronostico risultato; obbligatorie se il risultato ha gol, assenti su 0-0.
A fine gara l'**admin** registra i gol reali da
**/admin → Marcatori** (scegli data → partita finita → giocatore + minuto); `score_match`
riassegna i punti marcatore in automatico e in modo idempotente (rimuovere un gol li
azzera). L'esito compare nel recap e nello storico personale.

- `GET /players[?team_tla=XYZ]` — rosa per il dropdown.
- `POST /predictions/scorer` — salva la lista marcatori (`player_ids`); richiede il
  pronostico risultato, conteggi per squadra = gol previsti (403 se iniziata, 400 se i
  conteggi non tornano o un giocatore non gioca la partita).
- `GET /predictions/scorer/me` — i propri pronostici marcatore con esito.
- `POST/DELETE /admin/goals`, `GET /admin/goals/{match_id}` — gestione gol reali (admin).

Verifica E2E: `uv run python scripts/verify_sprint8.py` (backend :8000 + rose popolate).

## Checklist go-live

- [ ] Migration 001–007 applicate su Supabase
- [ ] Repo su GitHub + progetto Vercel con env vars (`VITE_API_URL=/api`,
      `ALLOWED_ORIGINS=https://<dominio>.vercel.app`, `CRON_SECRET`, chiavi Supabase
      e football-data)
- [ ] Cron attivi su Vercel: sync ogni 15' + snapshot classifica a mezzanotte
      (piano Hobby = max 1/giorno: serve Pro o cron esterno tipo cron-job.org)
- [ ] SMTP custom su Supabase (Authentication → SMTP) — il built-in è limitato
      a ~2 email/ora, insufficiente per gli inviti
- [ ] Redirect URLs su Supabase: aggiungi `https://<dominio>.vercel.app/**`
- [ ] Invita i colleghi da /admin
- [ ] Verifica `https://<dominio>.vercel.app/api/ping` → `db:true`
- [ ] Primi kickoff 11 giugno 2026: pronostici già aperti su tutte le 104 partite

## Sicurezza

- Nessun segreto nel codice: tutto via `.env` (locale) o Environment Variables (Vercel).
- La **service_role key bypassa le RLS**: usala solo nel backend, mai esporla al client.
- RLS attiva su `profiles`, `matches`, `predictions`; i pronostici altrui sono
  visibili solo dopo il kickoff della partita.
