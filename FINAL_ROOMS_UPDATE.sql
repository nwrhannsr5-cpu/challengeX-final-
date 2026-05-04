-- FINAL_ROOMS_UPDATE.sql
-- Fixes missing columns, adds admin ownership, and implements Room Join Requests.

------------------------------------------------------------
-- 1. FIX CHALLENGES TABLE (Incomplete Room Bug)
------------------------------------------------------------
-- Ensure challenges table has the required columns
alter table public.challenges add column if not exists room_id uuid references public.challenge_rooms(id) on delete cascade;
alter table public.challenges add column if not exists total_days int default 7;

------------------------------------------------------------
-- 2. ADD ROOM ADMIN
------------------------------------------------------------
-- Add created_by to challenge_rooms so we know who the admin is
alter table public.challenge_rooms add column if not exists created_by uuid references auth.users(id);

-- Set existing rooms' created_by to the first user found (to avoid orphans) if they are null
update public.challenge_rooms cr
set created_by = (select id from auth.users limit 1)
where created_by is null;

------------------------------------------------------------
-- 3. ROOM REQUESTS TABLE
------------------------------------------------------------
create table if not exists public.room_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.challenge_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.room_requests enable row level security;

-- Users can read their own requests OR requests for rooms they created
drop policy if exists "requests_select" on public.room_requests;
create policy "requests_select" on public.room_requests for select using (
  auth.uid() = user_id OR
  auth.uid() IN (select created_by from public.challenge_rooms where id = room_requests.room_id)
);

-- Users can insert their own requests
drop policy if exists "requests_insert" on public.room_requests;
create policy "requests_insert" on public.room_requests for insert with check (auth.uid() = user_id);

------------------------------------------------------------
-- 4. NEW RPC: Create Room with Admin
------------------------------------------------------------
-- Safely inserts a room and challenge and sets the creator
create or replace function public.create_room_with_challenge(
  p_name text,
  p_difficulty text,
  p_duration_days int,
  p_title text,
  p_description text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.challenge_rooms (name, difficulty, duration_days, created_by)
  values (p_name, p_difficulty, p_duration_days, auth.uid())
  returning id into v_room_id;

  insert into public.challenges (room_id, title, description, total_days)
  values (v_room_id, p_title, p_description, p_duration_days);

  return v_room_id;
end;
$$;

------------------------------------------------------------
-- 5. NEW RPC: Admin Approve/Reject Request
------------------------------------------------------------
create or replace function public.handle_room_request(
  p_request_id uuid,
  p_status text -- 'approved' or 'rejected'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_room_id uuid;
  v_user_id uuid;
  v_challenge_id uuid;
  v_admin_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  -- Get request info
  select room_id, user_id into v_room_id, v_user_id
  from public.room_requests where id = p_request_id;

  if v_room_id is null then raise exception 'Request not found'; end if;

  -- Verify auth user is the room creator (admin)
  select created_by into v_admin_id from public.challenge_rooms where id = v_room_id;
  if v_admin_id != auth.uid() then raise exception 'Unauthorized: Only the room creator can handle requests'; end if;

  -- Update request status
  update public.room_requests set status = p_status where id = p_request_id;

  -- If approved, insert into user_challenges automatically
  if p_status = 'approved' then
    select id into v_challenge_id from public.challenges where room_id = v_room_id limit 1;
    
    if v_challenge_id is not null then
      -- Insert into user_challenges as "not_started"
      insert into public.user_challenges (user_id, challenge_id, status, progress_count, progress)
      values (v_user_id, v_challenge_id, 'not_started', 0, 0)
      on conflict (user_id, challenge_id) do nothing;
    end if;
  end if;
end;
$$;
