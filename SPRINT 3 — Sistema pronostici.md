Continuo "LMN World Cup". Sprint 1 e 2 completi (infra, auth, sync partite funzionante).
Questo è lo Sprint 3: il sistema di pronostici, il cuore dell'app.

NOTA DESIGN SYSTEM: va utilizzato come design system il design che trovi in "LMN World Cup Design System".
NOTA FRONTEND: il frontend deve essere visualizzabile da mobile come PWA e anche da PC.

REGOLE DI GIOCO (implementale ESATTAMENTE così):
- Pronostico = risultato esatto previsto: home_score e away_score (interi >= 0).
- Punteggio:
  * Risultato esatto (entrambi i gol giusti): 3 punti
  * Segno giusto (1/X/2 corretto ma risultato sbagliato): 1 punto
  * Sbagliato: 0 punti
- Moltiplicatori per fase (sul punteggio sopra):
  * GROUP_STAGE: x1
  * LAST_32, LAST_16, QUARTER_FINALS: x2
  * SEMI_FINALS, THIRD_PLACE, FINAL: x3
- I pronostici su fase knockout si basano sul risultato dei 90' + eventuali supplementari
  (il fullTime di football-data include i supplementari), NON sui rigori.

TASK BACKEND — pronostici:
1. models/prediction.py: schemi Pydantic PredictionCreate (match_id, home_score, away_score)
   e PredictionOut (con campo "outcome": exact|sign|wrong|pending e "points").
2. Endpoint POST /predictions: crea o aggiorna (upsert su user_id+match_id) il pronostico.
   VALIDAZIONE CRITICA LATO SERVER: recupera la partita, confronta match.utc_date con
   datetime.now(timezone.utc). Se la partita è già iniziata (utc_date <= now), rifiuta
   con 403 "Pronostici chiusi per questa partita". NON fidarti mai del client per la deadline.
3. Endpoint GET /predictions/me: tutti i pronostici dell'utente con outcome calcolato.
   Per partite non ancora finite, outcome = "pending".
4. Endpoint GET /predictions/match/{match_id}/summary: statistiche aggregate dei pronostici
   altrui su quella partita. RESTITUISCI SOLO se la partita è iniziata (utc_date <= now),
   altrimenti 403. Ritorna: numero totale di pronostici, distribuzione dei segni (% 1/X/2),
   risultati più gettonati. MAI rivelare chi ha pronosticato cosa prima del kickoff.

TASK BACKEND — calcolo punti:
1. services/scoring.py: funzione pura calculate_points(pred_home, pred_away, actual_home,
   actual_away, stage) -> int. Deve essere testabile in isolamento. Applica regole e
   moltiplicatori sopra. Scrivi anche dei test (pytest) con casi: esatto, segno, sbagliato,
   pareggio, knockout x2, finale x3.
2. services/scoring.py: funzione score_match(match_id) che, data una partita FINISHED,
   ricalcola e aggiorna il campo points di TUTTI i pronostici su quella partita.
3. Integra score_match nel job di sync: quando sync_matches rileva che una partita è passata
   a FINISHED (cambio di status), chiama score_match per quella partita.
4. Endpoint POST /scoring/recalculate (solo admin): ricalcola i punti di tutte le partite
   finite. Utile in caso di correzioni.

TASK FRONTEND:
1. Schermata "Pronostica" per una singola partita:
   - Card partita in evidenza: bandiere (usa il crest URL), nomi, orario locale, gruppo/fase.
   - Due score input grandi affiancati (stile tabellone, font display).
   - Countdown live al kickoff. Quando scade, disabilita l'input e mostra "Pronostici chiusi".
   - Badge che mostra il valore in punti potenziale (x2 / x3 nelle fasi finali).
   - Bottone Conferma con stato loading; mostra toast di successo/errore.
2. Schermata "Partite del giorno" (potenzia quella temporanea dello Sprint 2):
   - Selector data orizzontale scrollabile (±7 giorni).
   - Ogni card mostra lo stato del pronostico dell'utente: verde=fatto, giallo=da fare,
     rosso=scaduto-non-fatto. Per partite finite, mostra il risultato e i punti ottenuti.
   - Filtro per fase (Gironi / Round of 32 / Ottavi / ...).
3. Dopo che una partita è iniziata, nella sua schermata mostra il summary dei pronostici
   altrui (chiamando l'endpoint summary).
4. api/predictions.ts: funzioni tipizzate createPrediction, getMyPredictions, getMatchSummary.

CRITERI DI COMPLETAMENTO:
- Posso inserire un pronostico su una partita futura e modificarlo finché non inizia
- Tentare un pronostico su una partita iniziata ritorna 403 (testato lato API, non solo UI)
- Quando una partita passa a FINISHED via sync, i punti vengono calcolati automaticamente
- I test di calculate_points passano tutti
- Non riesco a vedere i pronostici dei colleghi finché la partita non è iniziata