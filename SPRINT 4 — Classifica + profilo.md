Continuo "LMN World Cup". Sprint 1-3 completi (infra, auth, sync, pronostici e scoring).
Questo è lo Sprint 4: classifica, profilo utente e meccaniche di engagement.

NOTA DESIGN SYSTEM: va utilizzato come design system il design che trovi in "LMN World Cup Design System".
NOTA FRONTEND: il frontend deve essere visualizzabile da mobile come PWA e anche da PC.

TASK BACKEND — classifica e statistiche:
1. Endpoint GET /leaderboard: classifica di tutti i partecipanti ordinata per punti totali.
   Per ogni utente: posizione, display_name, punti totali, numero pronostici esatti,
   % precisione (pronostici esatti / pronostici su partite finite), e trend (variazione di
   posizione rispetto al giorno precedente — vedi sotto).
2. Per il trend: crea una tabella leaderboard_snapshots (user_id, date, position, points)
   e un job giornaliero (cron Vercel a mezzanotte) che salva la classifica del giorno.
   Il trend è la differenza tra la posizione di oggi e quella dell'ultimo snapshot.
3. Endpoint GET /users/me/stats: statistiche dettagliate dell'utente corrente:
   - punti totali, pronostici totali, pronostici esatti, segni giusti, sbagliati, mancati
   - % precisione
   - array punti per matchday (per il grafico a barre)
   - storico ultimi 10 pronostici con esito e punti
4. Endpoint GET /users/{user_id}/stats: versione pubblica (solo dati non sensibili) per
   vedere il profilo di un collega.

TASK BACKEND — achievements:
1. Tabella achievements (id, code, name, description, icon) e user_achievements
   (user_id, achievement_id, unlocked_at).
2. services/achievements.py con la logica di sblocco, valutata dopo ogni score_match:
   - "primo_sangue": primo in assoluto a inserire un pronostico nel torneo
   - "cecchino": 3 risultati esatti totali
   - "veggente": 5 pronostici corretti (esatti o segno) di fila
   - "en_plein": tutti i pronostici esatti in una singola giornata
   - "comeback": risalire di 3+ posizioni in classifica in un giorno
3. Endpoint GET /users/me/achievements: badge sbloccati + quelli ancora da sbloccare.

TASK FRONTEND:
1. Schermata Home — classifica:
   - Podio top-3 visuale (avatar con iniziali, colore deterministico dal nome).
   - Lista scrollabile degli altri, con la riga dell'utente corrente sempre evidenziata.
   - Per ogni riga: posizione, nome, punti, freccia trend (su/giù/stabile), % precisione.
   - Widget "prossima partita" in cima con countdown.
   - Polling ogni 60 secondi per aggiornare la classifica.
2. Schermata Profilo:
   - Header: avatar grande, nome, posizione attuale.
   - Grid 2x2 di stat card: punti totali, pronostici esatti, % precisione, partite mancate.
   - Grafico a barre dei punti per giornata, fatto SOLO con div/CSS (niente librerie chart).
   - Sezione achievement: griglia di badge, quelli bloccati in grigio/opachi.
   - Storico ultimi 10 pronostici: partita, tuo pronostico, risultato reale, punti, esito.
3. api/leaderboard.ts e api/stats.ts con le funzioni tipizzate.

CRITERI DI COMPLETAMENTO:
- GET /leaderboard ritorna la classifica corretta ordinata per punti
- Il trend mostra variazioni reali dopo almeno due snapshot giornalieri
- Il profilo mostra statistiche accurate e il grafico per giornata
- Gli achievement si sbloccano correttamente (testane almeno 2 manualmente)
- La Home si aggiorna in polling senza ricaricare la pagina