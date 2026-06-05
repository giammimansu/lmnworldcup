-- Sprint 6 — Leghe private.
-- Pronostici/scoring invariati: un pronostico vale in tutte le leghe. Cambia solo
-- come si aggregano le classifiche.

create table if not exists leagues (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    owner_id    uuid not null references profiles(id) on delete cascade,
    invite_code text not null unique,
    created_at  timestamptz not null default now()
);

create table if not exists league_members (
    league_id uuid not null references leagues(id) on delete cascade,
    user_id   uuid not null references profiles(id) on delete cascade,
    joined_at timestamptz not null default now(),
    primary key (league_id, user_id)
);

create index if not exists idx_league_members_user on league_members(user_id);

-- Helper SECURITY DEFINER per verificare l'appartenenza senza ricorsione nelle policy.
create or replace function public.is_league_member(lid uuid, uid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from league_members
    where league_id = lid and user_id = uid
  );
$$;

alter table leagues        enable row level security;
alter table league_members enable row level security;

-- LEAGUES: vedi una lega solo se ne sei membro (o proprietario).
drop policy if exists "leagues visible to members" on leagues;
create policy "leagues visible to members" on leagues
    for select to authenticated
    using (owner_id = auth.uid() or public.is_league_member(id, auth.uid()));

-- Creazione: chiunque, ma deve essere owner di se stesso.
drop policy if exists "leagues insert own" on leagues;
create policy "leagues insert own" on leagues
    for insert to authenticated
    with check (owner_id = auth.uid());

-- Modifica/eliminazione: solo il proprietario.
drop policy if exists "leagues update owner" on leagues;
create policy "leagues update owner" on leagues
    for update to authenticated using (owner_id = auth.uid());
drop policy if exists "leagues delete owner" on leagues;
create policy "leagues delete owner" on leagues
    for delete to authenticated using (owner_id = auth.uid());

-- LEAGUE_MEMBERS: vedi i membri delle leghe di cui fai parte.
drop policy if exists "members visible to co-members" on league_members;
create policy "members visible to co-members" on league_members
    for select to authenticated
    using (public.is_league_member(league_id, auth.uid()));

-- Un utente può aggiungere SOLO se stesso (join). La rimozione altrui la fa il backend
-- con service role (controllo owner lato API).
drop policy if exists "members insert self" on league_members;
create policy "members insert self" on league_members
    for insert to authenticated
    with check (user_id = auth.uid());

drop policy if exists "members delete self" on league_members;
create policy "members delete self" on league_members
    for delete to authenticated
    using (user_id = auth.uid());
