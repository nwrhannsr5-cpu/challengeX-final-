-- Fixes for Challenge Rooms: Separate Join and Start states

-- 1. Function to join a room without starting the challenge yet
create or replace function public.join_room(p_challenge_id uuid)
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
    raise exception 'Already joined this room';
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
    null,
    'not_started',
    0,
    0
  );
end;
$$;

-- 2. Update start_challenge to work if user already joined
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
    if existing.status = 'active' then
      raise exception 'Challenge already started';
    elsif existing.status = 'completed' then
      raise exception 'Challenge already completed';
    end if;

    -- User is joined but not started, so we start it now
    update public.user_challenges
    set 
      status = 'active',
      start_time = now()
    where id = existing.id;
  else
    -- User hasn't joined at all, join and start simultaneously
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
  end if;
end;
$$;
