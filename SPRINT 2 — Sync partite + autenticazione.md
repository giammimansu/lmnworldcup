Continuo "LMN World Cup". Lo Sprint 1 (infrastruttura, schema DB, deploy) è completo.
Questo è lo Sprint 2: autenticazione utenti e sincronizzazione dati partite.

NOTA DESIGN SYSTEM: va utilizzato come design system il design che trovi in "LMN World Cup Design System".
NOTA FRONTEND: il frontend deve essere visualizzabile da mobile come PWA e anche da PC.

CONTESTO API ESTERNA — football-data.org:
- Base URL: https://api.football-data.org/v4
- Auth: header "X-Auth-Token: {FOOTBALL_DATA_API_KEY}"
- Endpoint partite: GET /competitions/WC/matches?season=2026
- Rate limit free tier: 10 richieste/minuto. NON chiamare mai dal frontend (blocco CORS):
  tutte le chiamate partono dal backend.
- Struttura risposta: { matches: [ { id, utcDate, status, stage, matchday, group,
  homeTeam:{id,name,tla,crest}, awayTeam:{...}, score:{fullTime:{home,away}} } ] }
- status possibili: TIMED, SCHEDULED, IN_PLAY, PAUSED, FINISHED

TASK AUTENTICAZIONE:
1. Usa Supabase Auth con magic link (OTP via email), niente password.
2. Backend: dependency get_current_user() che valida il JWT Supabase dall'header
   Authorization e ritorna il profilo utente. Solleva 401 se invalido.
3. Backend: dependency require_admin() che estende get_current_user e verifica is_admin.
4. Endpoint POST /auth/invite (solo admin): riceve un'email, crea il profilo in profiles
   e invia magic link via Supabase Auth admin API. Serve a far entrare i colleghi.
5. Trigger Supabase (in 003_auth_trigger.sql): quando un utente si registra in auth.users,
   crea automaticamente la riga corrispondente in profiles.

TASK SYNC PARTITE:
1. services/football_api.py: client async (httpx) per football-data.org con gestione
   rate limit (retry con backoff se 429) e timeout.
2. services/sync.py: funzione sync_matches() che:
   - chiama GET /competitions/WC/matches?season=2026
   - fa upsert di ogni partita nella tabella matches (chiave: id)
   - mappa status, score.fullTime in home_score/away_score, group, stage, ecc.
   - scrive una riga in sync_log con esito e numero partite aggiornate
   - usa il client Supabase service role (bypassa RLS)
3. Endpoint POST /sync/matches (solo admin): trigger manuale di sync_matches().
4. Cron Vercel: aggiungi a vercel.json un cron job che chiama un endpoint
   GET /sync/cron (protetto da un secret header CRON_SECRET) ogni 15 minuti.
   La funzione deve essere idempotente.
5. Endpoint GET /matches: lista partite con filtri opzionali query param:
   ?date=YYYY-MM-DD, ?stage=GROUP_STAGE, ?group=GROUP_A, ?matchday=1.
   Ordina per utc_date. Lettura per utenti autenticati.
6. Endpoint GET /matches/{match_id}: dettaglio singola partita.

TASK FRONTEND:
1. Pagina Login: input email → invio magic link → schermata "controlla la tua email".
   Gestisci il redirect di ritorno dal magic link.
2. AuthContext + useAuth() hook: gestisce sessione Supabase, loading state, logout.
   Espone user, session, isAdmin.
3. ProtectedRoute: wrapper che redirige a /login se non autenticato.
4. api/matches.ts: funzioni tipizzate getMatches(filters), getMatch(id).
5. Schermata temporanea "Partite" che lista le partite del giorno chiamando GET /matches?date=today,
   mostrando squadre, orario in fuso locale, gruppo e stato. Solo per verificare il flusso dati.

CRITERI DI COMPLETAMENTO:
- Un admin può invitare un collega che riceve il magic link ed entra
- POST /sync/matches popola la tabella matches con tutte le 104 partite del Mondiale 2026
- GET /matches?date=2026-06-11 ritorna le partite di quel giorno
- Gli orari nel frontend sono mostrati nel fuso locale del browser
- Il cron è configurato (anche se le partite vere iniziano a giugno)

ATTENZIONE: la deadline pronostici e il calcolo punti sono Sprint 3, non farli ora.