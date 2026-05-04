create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, username, avatar_url, created_at, updated_at)
select
  au.id,
  coalesce(u.username, u.name, u.full_name, split_part(au.email, '@', 1), 'Challenger'),
  u.avatar_url,
  coalesce(u.created_at, now()),
  now()
from auth.users au
left join public.users u on u.id = au.id
on conflict (id) do update set
  username = excluded.username,
  avatar_url = excluded.avatar_url,
  updated_at = now();

create or replace function public.sync_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, created_at, updated_at)
  values (
    new.id,
    coalesce(new.username, new.name, new.full_name, split_part(new.email, '@', 1), 'Challenger'),
    new.avatar_url,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update set
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_user_to_profile on public.users;
create trigger sync_user_to_profile
after insert or update of username, name, full_name, email, avatar_url
on public.users
for each row execute function public.sync_user_to_profile();

-- Social feed
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  image_url text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'posts_user_id_profiles_fkey'
  ) then
    alter table public.posts
    add constraint posts_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  type text not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

-- Challenge rooms
create table if not exists public.challenge_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  duration_days int not null default 7 check (duration_days > 0),
  created_at timestamptz not null default now()
);

alter table public.challenges add column if not exists room_id uuid references public.challenge_rooms(id) on delete cascade;
alter table public.challenges add column if not exists total_days int;
alter table public.challenges add column if not exists created_at timestamptz not null default now();
update public.challenges set total_days = coalesce(total_days, 7) where total_days is null;

alter table public.user_challenges add column if not exists start_time timestamptz;
alter table public.user_challenges add column if not exists end_time timestamptz;
alter table public.user_challenges add column if not exists progress_count int not null default 0;
alter table public.user_challenges add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_challenges_user_id_profiles_fkey'
  ) then
    alter table public.user_challenges
    add constraint user_challenges_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_challenges_challenge_id_fkey'
  ) then
    alter table public.user_challenges
    add constraint user_challenges_challenge_id_fkey
    foreign key (challenge_id) references public.challenges(id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_challenges_user_challenge_unique'
  ) then
    alter table public.user_challenges
    add constraint user_challenges_user_challenge_unique unique (user_id, challenge_id);
  end if;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.daily_progress (
  id uuid primary key default gen_random_uuid(),
  user_challenge_id uuid not null references public.user_challenges(id) on delete cascade,
  date date not null default current_date,
  completed boolean not null default true,
  proof text,
  created_at timestamptz not null default now(),
  unique (user_challenge_id, date)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.challenge_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

-- Server-side challenge start. Prevents restarting existing challenges.
create or replace function public.start_challenge(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.user_challenges;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into existing
  from public.user_challenges
  where user_id = auth.uid() and challenge_id = p_challenge_id
  limit 1;

  if existing.id is not null then
    raise exception 'Challenge already started';
  end if;

  insert into public.user_challenges (
    user_id,
    challenge_id,
    start_time,
    status,
    progress_count,
    progress
  )
  values (
    auth.uid(),
    p_challenge_id,
    now(),
    'active',
    0,
    0
  );
end;
$$;

-- Server-side daily progress. Enforces one update per day and prevents instant completion.
create or replace function public.mark_daily_progress(p_user_challenge_id uuid, p_proof text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.user_challenges;
  challenge_total int;
  room_difficulty text;
  next_progress int;
  elapsed_days int;
  base_points int;
  speed_bonus int;
  streak_bonus int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into entry
  from public.user_challenges
  where id = p_user_challenge_id and user_id = auth.uid()
  for update;

  if entry.id is null then
    raise exception 'Challenge entry not found';
  end if;

  if entry.status = 'completed' then
    raise exception 'Challenge already completed';
  end if;

  if exists (
    select 1
    from public.daily_progress
    where user_challenge_id = p_user_challenge_id
      and date = current_date
  ) then
    raise exception 'Daily progress already submitted today';
  end if;

  select coalesce(c.total_days, cr.duration_days, 7), coalesce(cr.difficulty, 'medium')
  into challenge_total, room_difficulty
  from public.challenges c
  left join public.challenge_rooms cr on cr.id = c.room_id
  where c.id = entry.challenge_id;

  next_progress := entry.progress_count + 1;

  if next_progress >= challenge_total and entry.start_time::date = current_date then
    raise exception 'Challenge cannot be completed instantly';
  end if;

  insert into public.daily_progress (user_challenge_id, date, completed, proof)
  values (p_user_challenge_id, current_date, true, nullif(trim(coalesce(p_proof, '')), ''));

  if next_progress >= challenge_total then
    elapsed_days := greatest(1, (current_date - entry.start_time::date) + 1);
    base_points := case room_difficulty
      when 'hard' then 500
      when 'medium' then 300
      else 180
    end;
    speed_bonus := greatest(0, (challenge_total - elapsed_days) * 25);
    streak_bonus := challenge_total * 10;

    update public.user_challenges
    set
      progress_count = next_progress,
      progress = 100,
      status = 'completed',
      end_time = now(),
      completed_at = now()
    where id = p_user_challenge_id;

    update public.users
    set total_points = coalesce(total_points, 0) + base_points + speed_bonus + streak_bonus
    where id = auth.uid();

    insert into public.activity_log (user_id, action, points, metadata, created_at)
    values (
      auth.uid(),
      'completed_room_challenge',
      base_points + speed_bonus + streak_bonus,
      jsonb_build_object(
        'challenge_id', entry.challenge_id,
        'base_points', base_points,
        'speed_bonus', speed_bonus,
        'streak_bonus', streak_bonus
      ),
      now()
    );
  else
    update public.user_challenges
    set
      progress_count = next_progress,
      progress = floor((next_progress::numeric / challenge_total::numeric) * 100),
      status = 'active'
    where id = p_user_challenge_id;
  end if;
end;
$$;

-- Storage
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do update set public = true;

-- RLS
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.challenge_rooms enable row level security;
alter table public.challenges enable row level security;
alter table public.user_challenges enable row level security;
alter table public.daily_progress enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone" on public.posts for select using (true);

drop policy if exists "Users can create own posts" on public.posts;
create policy "Users can create own posts" on public.posts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts" on public.posts for delete using (auth.uid() = user_id);

drop policy if exists "Reactions are viewable by everyone" on public.reactions;
create policy "Reactions are viewable by everyone" on public.reactions for select using (true);

drop policy if exists "Users can manage own reactions" on public.reactions;
create policy "Users can manage own reactions" on public.reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone" on public.comments for select using (true);

drop policy if exists "Users can create own comments" on public.comments;
create policy "Users can create own comments" on public.comments for insert with check (auth.uid() = user_id);

drop policy if exists "Rooms are viewable by everyone" on public.challenge_rooms;
create policy "Rooms are viewable by everyone" on public.challenge_rooms for select using (true);

drop policy if exists "Authenticated users can create rooms" on public.challenge_rooms;
create policy "Authenticated users can create rooms" on public.challenge_rooms for insert with check (auth.uid() is not null);

drop policy if exists "Challenges are viewable by everyone" on public.challenges;
create policy "Challenges are viewable by everyone" on public.challenges for select using (true);

drop policy if exists "Authenticated users can create room challenges" on public.challenges;
create policy "Authenticated users can create room challenges" on public.challenges for insert with check (auth.uid() is not null);

drop policy if exists "User challenge entries are viewable" on public.user_challenges;
create policy "User challenge entries are viewable" on public.user_challenges for select using (true);

drop policy if exists "Users can insert own challenge entries" on public.user_challenges;
create policy "Users can insert own challenge entries" on public.user_challenges for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own challenge entries" on public.user_challenges;
create policy "Users can update own challenge entries" on public.user_challenges for update using (auth.uid() = user_id);

drop policy if exists "Daily progress is viewable" on public.daily_progress;
create policy "Daily progress is viewable" on public.daily_progress for select using (true);

drop policy if exists "Messages are viewable" on public.messages;
create policy "Messages are viewable" on public.messages for select using (true);

drop policy if exists "Users can create room messages" on public.messages;
create policy "Users can create room messages" on public.messages for insert with check (auth.uid() = user_id);

drop policy if exists "Post images are publicly viewable" on storage.objects;
create policy "Post images are publicly viewable" on storage.objects for select using (bucket_id = 'posts');

drop policy if exists "Users can upload post images" on storage.objects;
create policy "Users can upload post images" on storage.objects for insert with check (
  bucket_id = 'posts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

notify pgrst, 'reload schema';
