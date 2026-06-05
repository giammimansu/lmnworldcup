-- Abilita RLS su tutte le tabelle con dati utente
alter table profiles    enable row level security;
alter table matches     enable row level security;
alter table predictions enable row level security;

-- PROFILES: ogni utente legge tutti i profili (servono display_name per la classifica),
-- ma può modificare solo il proprio.
create policy "profiles readable by authenticated"
    on profiles for select
    to authenticated
    using (true);

create policy "profiles update own"
    on profiles for update
    to authenticated
    using (id = auth.uid());

-- MATCHES: lettura per tutti gli autenticati. La scrittura avviene solo via service role
-- (che bypassa le RLS), quindi non serve policy di insert/update per gli utenti.
create policy "matches readable by authenticated"
    on matches for select
    to authenticated
    using (true);

-- PREDICTIONS: regola chiave del gioco.
-- Un utente vede i PROPRI pronostici sempre; vede quelli ALTRUI solo dopo che la
-- partita è iniziata (utc_date <= now()). Così nessuno può sbirciare prima del kickoff.
create policy "predictions select own or after kickoff"
    on predictions for select
    to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from matches m
            where m.id = predictions.match_id
              and m.utc_date <= now()
        )
    );

-- Un utente può inserire/modificare/cancellare solo i propri pronostici.
-- (La deadline pre-kickoff verrà imposta lato backend nello Sprint 3.)
create policy "predictions insert own"
    on predictions for insert
    to authenticated
    with check (user_id = auth.uid());

create policy "predictions update own"
    on predictions for update
    to authenticated
    using (user_id = auth.uid());

create policy "predictions delete own"
    on predictions for delete
    to authenticated
    using (user_id = auth.uid());
