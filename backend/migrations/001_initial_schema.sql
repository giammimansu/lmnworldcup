-- Profili utente (estende auth.users di Supabase)
create table if not exists profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    display_name text not null,
    is_admin     boolean not null default false,
    created_at   timestamptz not null default now()
);

-- Partite (id = id di football-data.org)
create table if not exists matches (
    id              bigint primary key,
    utc_date        timestamptz not null,
    status          text not null,            -- TIMED | IN_PLAY | FINISHED ...
    stage           text not null,            -- GROUP_STAGE | LAST_16 | FINAL ...
    matchday        int,
    group_name      text,                     -- GROUP_A ... (null nei knockout)
    home_team_id    bigint,
    home_team_name  text,
    home_team_tla   text,
    home_team_crest text,
    away_team_id    bigint,
    away_team_name  text,
    away_team_tla   text,
    away_team_crest text,
    home_score      int,
    away_score      int,
    last_synced     timestamptz
);

create index if not exists idx_matches_utc_date on matches(utc_date);
create index if not exists idx_matches_stage on matches(stage);

-- Pronostici
create table if not exists predictions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references profiles(id) on delete cascade,
    match_id   bigint not null references matches(id) on delete cascade,
    home_score int not null check (home_score >= 0),
    away_score int not null check (away_score >= 0),
    points     int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, match_id)
);

create index if not exists idx_predictions_user on predictions(user_id);
create index if not exists idx_predictions_match on predictions(match_id);

-- Log delle sincronizzazioni
create table if not exists sync_log (
    id              bigserial primary key,
    run_at          timestamptz not null default now(),
    matches_updated int,
    status          text,
    detail          text
);
