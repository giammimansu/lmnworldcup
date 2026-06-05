-- Snapshot giornalieri della classifica (per il trend)
create table if not exists leaderboard_snapshots (
    id         bigserial primary key,
    user_id    uuid not null references profiles(id) on delete cascade,
    date       date not null,
    position   int not null,
    points     int not null,
    unique (user_id, date)
);

create index if not exists idx_snapshots_user_date on leaderboard_snapshots(user_id, date desc);

-- Achievements
create table if not exists achievements (
    id          bigserial primary key,
    code        text not null unique,
    name        text not null,
    description text not null,
    icon        text not null
);

create table if not exists user_achievements (
    user_id        uuid not null references profiles(id) on delete cascade,
    achievement_id bigint not null references achievements(id) on delete cascade,
    unlocked_at    timestamptz not null default now(),
    primary key (user_id, achievement_id)
);

-- Seed dei 5 achievement
insert into achievements (code, name, description, icon) values
    ('primo_sangue', 'Primo sangue',  'Primo in assoluto a inserire un pronostico nel torneo', 'lightning'),
    ('cecchino',     'Cecchino',      '3 risultati esatti totali',                              'goal'),
    ('veggente',     'Veggente',      '5 pronostici corretti di fila',                          'star'),
    ('en_plein',     'En plein',      'Tutti i pronostici esatti in una singola giornata',      'fire'),
    ('comeback',     'Comeback',      'Risalita di 3+ posizioni in classifica in un giorno',    'trophy')
on conflict (code) do nothing;

-- RLS: lettura per autenticati, scrittura solo service role
alter table leaderboard_snapshots enable row level security;
alter table achievements          enable row level security;
alter table user_achievements     enable row level security;

create policy "snapshots readable by authenticated"
    on leaderboard_snapshots for select to authenticated using (true);

create policy "achievements readable by authenticated"
    on achievements for select to authenticated using (true);

create policy "user_achievements readable by authenticated"
    on user_achievements for select to authenticated using (true);
