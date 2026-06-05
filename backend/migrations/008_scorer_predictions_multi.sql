-- Sprint 8.1 — Marcatori multipli legati al risultato previsto.
-- Da un singolo marcatore (player_id) a una lista ordinata (player_ids):
-- per un pronostico H-A servono H marcatori della squadra di casa + A della trasferta.
-- Duplicati ammessi (doppiette/triplette). Punteggio: +2 per slot azzeccato.

alter table scorer_predictions drop column if exists player_id;
alter table scorer_predictions
    add column if not exists player_ids bigint[] not null default '{}';
