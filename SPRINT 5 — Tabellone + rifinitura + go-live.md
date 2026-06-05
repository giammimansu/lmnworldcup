Continuo "LMN World Cup". Sprint 1-4 completi.
Questo è lo Sprint 5 finale: tabellone knockout, admin panel, test e go-live.

NOTA DESIGN SYSTEM: va utilizzato come design system il design che trovi in "LMN World Cup Design System".
NOTA FRONTEND: il frontend deve essere visualizzabile da mobile come PWA e anche da PC.

CONTESTO: la fase a eliminazione del Mondiale 2026 ha questa struttura:
LAST_32 (Round of 32, 32 squadre) → LAST_16 (ottavi) → QUARTER_FINALS → SEMI_FINALS →
THIRD_PLACE + FINAL. Le squadre di ogni turno si conoscono solo dopo il turno precedente,
quindi gli slot iniziano come TBD e si popolano dai risultati sincronizzati.

TASK BACKEND — tabellone:
1. Endpoint GET /bracket: ritorna la struttura del tabellone organizzata per fase, basata
   sulle partite knockout già presenti in matches (stage != GROUP_STAGE). Per ogni match:
   squadre (o TBD se non ancora definite), risultato, vincitore. Raggruppa per stage in
   ordine: LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL.
2. Assicurati che il sync (Sprint 2) gestisca correttamente le partite knockout man mano
   che football-data.org le popola con le squadre qualificate.

TASK BACKEND — admin panel:
1. Endpoint GET /admin/users (solo admin): lista utenti con stato e numero pronostici.
2. Endpoint PATCH /admin/matches/{match_id} (solo admin): override manuale di home_score,
   away_score e status di una partita, in caso di errori dell'API esterna. Dopo l'override,
   ri-triggera score_match per ricalcolare i punti.
3. Endpoint GET /admin/sync-log (solo admin): ultime 50 righe di sync_log.

TASK FRONTEND — tabellone:
1. Schermata Tabellone: bracket knockout orizzontale scrollabile, dal Round of 32 alla Finale.
   - Ogni slot: bandiera (crest) + nome squadra, oppure "?" se TBD.
   - Linee connettori tra i match (SVG o bordi CSS).
   - Il vincitore di ogni sfida decisa evidenziato in oro.
   - La Finale ben visibile a destra con icona trofeo.
2. Pronostici knockout: riusa la schermata "Pronostica" dello Sprint 3, ma evidenzia il
   moltiplicatore di fase (x2 / x3) in modo prominente.

TASK FRONTEND — admin:
1. Pagina /admin protetta da isAdmin: lista utenti, tabella con override risultati
   (form inline per correggere uno score), e visualizzazione del sync log.

TASK NAVIGAZIONE FINALE:
1. Bottom navigation bar con 5 tab: Home (classifica), Partite, Pronostica, Tabellone, Profilo.
   Tab attiva evidenziata. Routing tra le schermate.
2. Applica il design system "LMN World Cup" già creato a tutte le schermate per coerenza
   visiva (dark mode, font display per i punteggi, palette gold/electric).

TASK QUALITÀ E GO-LIVE:
1. Gestione errori globale frontend: stati di loading, empty state, error boundary.
2. Verifica timezone: tutti gli orari mostrati nel fuso locale dell'utente; tutte le
   deadline calcolate lato server in UTC. Testa con un fuso diverso.
3. Test end-to-end manuale del flusso completo: invito → login → pronostico → partita
   finita → punti → classifica.
4. Test responsive a 375px (mobile) e desktop, su Chrome/Safari/Firefox.
5. README aggiornato con: regole del gioco, come invitare colleghi, come fare override admin.
6. Checklist go-live: verifica che il cron di sync sia attivo, che gli inviti funzionino,
   e apri i pronostici per le prime partite (kickoff 11 giugno 2026).

CRITERI DI COMPLETAMENTO:
- Il tabellone si popola correttamente dalle partite knockout sincronizzate
- L'admin può correggere un risultato e i punti si ricalcolano
- Tutte e 5 le tab navigano correttamente con il design system applicato
- L'app funziona su mobile e desktop
- Il flusso completo invito→pronostico→punti→classifica funziona end-to-end