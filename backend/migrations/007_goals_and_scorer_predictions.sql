-- Sprint 8 — Marcatori end-to-end.
-- (Nel plan era numerata 005, ma 005 è già usata da leagues: qui è 007.)
-- Richiede la tabella `players` popolata (migration 006 + script FIFA).

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
