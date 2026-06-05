-- Rose ufficiali FIFA (popolate da scripts.import_squads_from_fifa).
-- Full refresh: lo script svuota e ricarica la tabella ad ogni run.
create table if not exists players (
    id           bigserial primary key,
    team_id      bigint,
    team_tla     text,
    team_name    text,
    name         text not null,
    position     text,
    shirt_number int,
    created_at   timestamptz not null default now()
);

create index if not exists idx_players_team_id on players(team_id);
create index if not exists idx_players_team_tla on players(team_tla);

-- RLS: lettura per tutti gli autenticati. La scrittura avviene solo via service role
-- (che bypassa le RLS), come per matches.
alter table players enable row level security;

create policy "players readable by authenticated"
    on players for select
    to authenticated
    using (true);
