-- Run this once in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

create extension if not exists pgcrypto;

------------------------------------------------------------
-- 1. USERS table
------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  username text,
  full_name text,
  handle text,
  height_cm numeric,
  weight_kg numeric,
  calorie_goal int,
  profile_completed boolean default false,
  total_points int default 0,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.users
  add column if not exists id uuid,
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists username text,
  add column if not exists full_name text,
  add column if not exists handle text,
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists calorie_goal int,
  add column if not exists profile_completed boolean default false,
  add column if not exists total_points int default 0,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz default now();

update public.users
set name = coalesce(name, full_name, username, handle, email, 'Challenger')
where name is null;

alter table public.users alter column name set default 'Challenger';

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'users'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.users add primary key (id);
  end if;
end $$;

create unique index if not exists users_handle_unique on public.users (handle) where handle is not null;

alter table public.users enable row level security;

drop policy if exists "users select all" on public.users;
create policy "users select all" on public.users for select using (true);

drop policy if exists "users insert self" on public.users;
create policy "users insert self" on public.users for insert with check (auth.uid() = id);

drop policy if exists "users update self" on public.users;
create policy "users update self" on public.users for update using (auth.uid() = id);

------------------------------------------------------------
-- 2. CHALLENGES table
------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  points_reward int default 100,
  icon text,
  category text,
  created_at timestamptz default now()
);

alter table public.challenges
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists points_reward int default 100,
  add column if not exists icon text,
  add column if not exists category text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'challenges'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.challenges add primary key (id);
  end if;
end $$;

alter table public.challenges enable row level security;

drop policy if exists "challenges read all" on public.challenges;
create policy "challenges read all" on public.challenges for select using (true);

drop policy if exists "challenges insert any auth" on public.challenges;
create policy "challenges insert any auth" on public.challenges for insert to authenticated with check (true);

------------------------------------------------------------
-- 3. USER_CHALLENGES table
------------------------------------------------------------
create table if not exists public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  challenge_id uuid not null,
  status text default 'in_progress',
  progress int default 0,
  started_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.user_challenges
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists challenge_id uuid,
  add column if not exists status text default 'in_progress',
  add column if not exists progress int default 0,
  add column if not exists started_at timestamptz default now(),
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'user_challenges'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.user_challenges add primary key (id);
  end if;
end $$;

create unique index if not exists user_challenges_unique on public.user_challenges (user_id, challenge_id);

alter table public.user_challenges enable row level security;

drop policy if exists "uc read own" on public.user_challenges;
create policy "uc read own" on public.user_challenges for select using (auth.uid() = user_id);

drop policy if exists "uc insert own" on public.user_challenges;
create policy "uc insert own" on public.user_challenges for insert with check (auth.uid() = user_id);

drop policy if exists "uc update own" on public.user_challenges;
create policy "uc update own" on public.user_challenges for update using (auth.uid() = user_id);

------------------------------------------------------------
-- 4. ROOMS table
------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text,
  status text default 'waiting',
  challenge_id uuid,
  created_by uuid,
  max_players int default 8,
  created_at timestamptz default now()
);

alter table public.rooms
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists status text default 'waiting',
  add column if not exists challenge_id uuid,
  add column if not exists created_by uuid,
  add column if not exists max_players int default 8,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'rooms'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.rooms add primary key (id);
  end if;
end $$;

alter table public.rooms enable row level security;

drop policy if exists "rooms read all" on public.rooms;
create policy "rooms read all" on public.rooms for select using (true);

drop policy if exists "rooms insert auth" on public.rooms;
create policy "rooms insert auth" on public.rooms for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "rooms update creator" on public.rooms;
create policy "rooms update creator" on public.rooms for update using (auth.uid() = created_by);

------------------------------------------------------------
-- 5. ROOM_PARTICIPANTS table
------------------------------------------------------------
create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz default now()
);

alter table public.room_participants
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists room_id uuid,
  add column if not exists user_id uuid,
  add column if not exists joined_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'room_participants'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.room_participants add primary key (id);
  end if;
end $$;

create unique index if not exists room_participants_unique on public.room_participants (room_id, user_id);

alter table public.room_participants enable row level security;

drop policy if exists "rp read all" on public.room_participants;
create policy "rp read all" on public.room_participants for select using (true);

drop policy if exists "rp insert self" on public.room_participants;
create policy "rp insert self" on public.room_participants for insert with check (auth.uid() = user_id);

------------------------------------------------------------
-- 6. ACTIVITY_LOG table
------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text,
  points int default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.activity_log
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists action text,
  add column if not exists points int default 0,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'activity_log'
      and constraint_type = 'PRIMARY KEY'
  ) then
    alter table public.activity_log add primary key (id);
  end if;
end $$;

alter table public.activity_log enable row level security;

drop policy if exists "log read own" on public.activity_log;
create policy "log read own" on public.activity_log for select using (auth.uid() = user_id);

drop policy if exists "log insert own" on public.activity_log;
create policy "log insert own" on public.activity_log for insert with check (auth.uid() = user_id);

------------------------------------------------------------
-- 7. SEED CHALLENGES (only if empty)
------------------------------------------------------------
insert into public.challenges (title, description, points_reward, icon, category)
select *
from (
  values
    ('10K Steps Daily', 'Walk 10,000 steps every day for a week.', 250, 'footprints', 'cardio'),
    ('Hydration Hero', 'Drink 2.5L of water every day.', 150, 'droplet', 'wellness'),
    ('Protein Power', 'Hit 120g of protein for 5 days.', 200, 'apple', 'nutrition'),
    ('Sleep Champion', 'Sleep 8 hours for 7 nights.', 300, 'moon', 'recovery'),
    ('Squat Squad', '100 squats per day for 14 days.', 400, 'dumbbell', 'strength'),
    ('Mindful Mornings', 'Meditate 10 min every morning.', 180, 'heart', 'wellness'),
    ('5K Runner', 'Run 5K three times a week.', 350, 'footprints', 'cardio'),
    ('Cold Plunge', 'Take a cold shower for 30 days.', 500, 'droplet', 'recovery')
) as v(title, description, points_reward, icon, category)
where not exists (select 1 from public.challenges);
