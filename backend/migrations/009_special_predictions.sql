-- Sprint 9 — Pronostici di torneo ("speciali").
-- Catalogo di domande risolte a fine torneo (capocannoniere, podio, squadra con
-- più gol...). Tre tipi di risposta: team / player / podium.
-- I punti confluiscono nella classifica: NB la classifica è calcolata in Python
-- (services/leaderboard.compute_leaderboard), NON da una view SQL — l'aggregazione
-- di special_predictions.points avviene lì.

-- Catalogo delle domande di torneo
create table if not exists special_questions (
    code           text primary key,           -- 'top_scorer', 'most_goals_team', 'podium'...
    title          text not null,
    qtype          text not null check (qtype in ('team', 'player', 'podium')),
    points         int not null default 5,      -- punti (per il podio: per posizione esatta)
    deadline       timestamptz not null,
    resolved       boolean not null default false,
    correct_answer jsonb,                       -- risposta giusta (formato dipende da qtype)
    sort_order     int not null default 0
);

-- Risposte degli utenti
create table if not exists special_predictions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references profiles(id) on delete cascade,
    question_code text not null references special_questions(code) on delete cascade,
    answer        jsonb not null,               -- stesso formato di correct_answer
    points        int,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (user_id, question_code)
);

create index if not exists idx_special_pred_user on special_predictions(user_id);

alter table special_questions   enable row level security;
alter table special_predictions enable row level security;

create policy "special_questions readable" on special_questions
    for select to authenticated using (true);

-- Proprie sempre; altrui solo dopo la scadenza della domanda
create policy "special_pred select own or after deadline" on special_predictions
    for select to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from special_questions q
            where q.code = special_predictions.question_code and q.deadline <= now()
        )
    );
create policy "special_pred insert own" on special_predictions
    for insert to authenticated with check (user_id = auth.uid());
create policy "special_pred update own" on special_predictions
    for update to authenticated using (user_id = auth.uid());

-- Seed delle domande. Formato answer/correct_answer:
--   team   -> {"team_tla": "BRA"}
--   player -> {"player_id": 412}
--   podium -> {"podium": ["BRA", "ARG", "FRA"]}  (1ª, 2ª, 3ª in ordine)
insert into special_questions (code, title, qtype, points, deadline, sort_order) values
  ('podium',            'Podio finale (1ª, 2ª, 3ª)',   'podium', 5,  '2026-06-11T19:00:00Z', 1),
  ('top_scorer',        'Capocannoniere',               'player', 10, '2026-06-11T19:00:00Z', 2),
  ('most_goals_team',   'Squadra con più gol fatti',    'team',   8,  '2026-06-11T19:00:00Z', 3),
  ('most_conceded_team','Squadra con più gol subiti',   'team',   8,  '2026-06-11T19:00:00Z', 4)
on conflict (code) do nothing;
