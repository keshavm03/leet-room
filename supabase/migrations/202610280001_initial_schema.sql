-- Leet Room MVP schema for Supabase Postgres.
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.room_visibility as enum ('public', 'unlisted', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.problem_state as enum ('queued', 'solved', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.participant_state as enum ('not_started', 'thinking', 'solved', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  email_domain text unique,
  created_at timestamptz not null default now()
);

insert into public.organizations (name, slug)
values ('Leet Room Demo', 'default')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  email text not null,
  display_name text not null,
  handle text not null,
  avatar_url text,
  color text not null default '#6f74f6',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, handle)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  visibility public.room_visibility not null default 'private',
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (room_id, user_id)
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'leetcode',
  source_key text not null,
  title text not null,
  canonical_url text not null,
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (source, source_key)
);

create table if not exists public.room_problems (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  state public.problem_state not null default 'queued',
  position bigint generated always as identity,
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (room_id, problem_id)
);

create table if not exists public.problem_participants (
  room_problem_id uuid not null references public.room_problems(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  required boolean not null default true,
  state public.participant_state not null default 'not_started',
  started_at timestamptz,
  solved_at timestamptz,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (room_problem_id, user_id)
);

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists room_members_user_idx on public.room_members(user_id);
create index if not exists room_problems_room_state_idx on public.room_problems(room_id, state, position);
create index if not exists participants_user_state_idx on public.problem_participants(user_id, state);
create index if not exists activity_room_created_idx on public.activity_events(room_id, created_at desc);

create or replace function public.make_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 4));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_name text;
  v_handle text;
begin
  select id into v_org_id
  from public.organizations
  where lower(email_domain) = lower(split_part(new.email, '@', 2))
  limit 1;

  if v_org_id is null then
    select id into v_org_id from public.organizations where slug = 'default';
  end if;

  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  v_handle := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]+', '', 'g');
  v_handle := left(coalesce(nullif(v_handle, ''), 'member'), 22) || '_' || substr(new.id::text, 1, 5);

  insert into public.profiles (id, organization_id, email, display_name, handle, avatar_url)
  values (new.id, v_org_id, new.email, v_name, v_handle, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles if the migration is applied after users already exist.
insert into public.profiles (id, organization_id, email, display_name, handle, avatar_url)
select
  u.id,
  coalesce(
    (select o.id from public.organizations o where lower(o.email_domain) = lower(split_part(u.email, '@', 2)) limit 1),
    (select o.id from public.organizations o where o.slug = 'default' limit 1)
  ),
  u.email,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
  left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]+', '', 'g'), 22) || '_' || substr(u.id::text, 1, 5),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where u.email is not null
on conflict (id) do nothing;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select organization_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.room_members where room_id = p_room_id and user_id = p_user_id) $$;

create or replace function public.is_room_admin(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id and role in ('owner', 'admin')
  )
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.problems enable row level security;
alter table public.room_problems enable row level security;
alter table public.problem_participants enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists organizations_same_org on public.organizations;
create policy organizations_same_org on public.organizations for select to authenticated
using (id = public.current_org_id());

drop policy if exists profiles_same_org on public.profiles;
create policy profiles_same_org on public.profiles for select to authenticated
using (organization_id = public.current_org_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists rooms_visible on public.rooms;
create policy rooms_visible on public.rooms for select to authenticated
using (
  public.is_room_member(id)
  or (visibility = 'public' and organization_id = public.current_org_id())
);

drop policy if exists room_members_visible on public.room_members;
create policy room_members_visible on public.room_members for select to authenticated
using (
  public.is_room_member(room_id)
  or exists (
    select 1 from public.rooms r
    where r.id = room_id and r.visibility = 'public' and r.organization_id = public.current_org_id()
  )
);

drop policy if exists problems_authenticated_read on public.problems;
create policy problems_authenticated_read on public.problems for select to authenticated using (true);

drop policy if exists room_problems_members_read on public.room_problems;
create policy room_problems_members_read on public.room_problems for select to authenticated
using (public.is_room_member(room_id));

drop policy if exists participants_members_read on public.problem_participants;
create policy participants_members_read on public.problem_participants for select to authenticated
using (
  exists (
    select 1 from public.room_problems rp
    where rp.id = room_problem_id and public.is_room_member(rp.room_id)
  )
);

drop policy if exists activity_members_read on public.activity_events;
create policy activity_members_read on public.activity_events for select to authenticated
using (public.is_room_member(room_id));

-- Writes happen through the following security-definer RPCs. This keeps completion
-- checks, membership snapshots and audit events atomic and client-proof.
create or replace function public.create_room(p_name text, p_visibility text default 'private')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_org_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) not between 2 and 80 then raise exception 'Room name must be 2-80 characters'; end if;
  if p_visibility not in ('public', 'unlisted', 'private') then raise exception 'Invalid room visibility'; end if;
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  if v_org_id is null then raise exception 'Profile not found'; end if;

  loop
    v_code := public.make_invite_code();
    exit when not exists(select 1 from public.rooms where invite_code = v_code);
  end loop;

  insert into public.rooms (organization_id, name, visibility, invite_code, created_by)
  values (v_org_id, trim(p_name), p_visibility::public.room_visibility, v_code, auth.uid())
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role) values (v_room_id, auth.uid(), 'owner');
  insert into public.activity_events (room_id, actor_user_id, event_type, entity_id)
  values (v_room_id, auth.uid(), 'room_created', v_room_id);
  return v_room_id;
end;
$$;

create or replace function public.join_room(p_room_or_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  select * into v_room from public.rooms
  where id::text = trim(p_room_or_code) or upper(invite_code) = upper(trim(p_room_or_code))
  limit 1;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.organization_id <> v_org_id then raise exception 'This room belongs to another organization'; end if;

  insert into public.room_members (room_id, user_id, role)
  values (v_room.id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  insert into public.activity_events (room_id, actor_user_id, event_type, entity_id)
  values (v_room.id, auth.uid(), 'member_joined', auth.uid());
  return v_room.id;
end;
$$;

create or replace function public.enqueue_problem(
  p_room_id uuid,
  p_url text,
  p_title text,
  p_difficulty text default 'Medium',
  p_tags text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_source_key text;
  v_canonical_url text;
  v_slug text;
  v_problem_number text;
  v_problem_index text;
  v_problem_id uuid;
  v_room_problem_id uuid;
begin
  if not public.is_room_member(p_room_id) then raise exception 'You are not a member of this room'; end if;
  v_slug := lower(substring(p_url from 'leetcode\.com/problems/([^/?#]+)'));
  if v_slug is not null then
    v_source := 'leetcode';
    v_source_key := v_slug;
    v_canonical_url := 'https://leetcode.com/problems/' || v_slug || '/';
  else
    v_slug := lower(substring(p_url from 'geeksforgeeks\.org/problems/([^/?#]+)'));
    if v_slug is not null then
      v_problem_number := substring(p_url from 'geeksforgeeks\.org/problems/[^/?#]+/([0-9]+)');
      v_source := 'geeksforgeeks';
      v_source_key := v_slug || case when v_problem_number is null then '' else '-' || v_problem_number end;
      v_canonical_url := 'https://www.geeksforgeeks.org/problems/' || v_slug || '/' || coalesce(v_problem_number, '');
    else
      v_problem_number := substring(p_url from 'codeforces\.com/problemset/problem/([0-9]+)');
      v_problem_index := upper(substring(p_url from 'codeforces\.com/problemset/problem/[0-9]+/([A-Za-z0-9]+)'));
      if v_problem_number is null then
        v_problem_number := substring(p_url from 'codeforces\.com/contest/([0-9]+)');
        v_problem_index := upper(substring(p_url from 'codeforces\.com/contest/[0-9]+/problem/([A-Za-z0-9]+)'));
      end if;
      if v_problem_number is not null and v_problem_index is not null then
        v_source := 'codeforces';
        v_source_key := v_problem_number || '-' || v_problem_index;
        v_canonical_url := 'https://codeforces.com/problemset/problem/' || v_problem_number || '/' || v_problem_index;
      end if;
    end if;
  end if;
  if v_source is null then raise exception 'Enter a supported LeetCode, GeeksforGeeks or Codeforces problem URL'; end if;
  if p_difficulty not in ('Easy', 'Medium', 'Hard') then raise exception 'Invalid difficulty'; end if;

  insert into public.problems (source, source_key, title, canonical_url, difficulty, tags)
  values (v_source, v_source_key, trim(p_title), v_canonical_url, p_difficulty, coalesce(p_tags, '{}'))
  on conflict (source, source_key) do update set
    title = excluded.title,
    canonical_url = excluded.canonical_url,
    difficulty = excluded.difficulty,
    tags = excluded.tags
  returning id into v_problem_id;

  insert into public.room_problems (room_id, problem_id, added_by)
  values (p_room_id, v_problem_id, auth.uid())
  on conflict (room_id, problem_id) do nothing
  returning id into v_room_problem_id;
  if v_room_problem_id is null then raise exception 'This problem is already in the room'; end if;

  insert into public.problem_participants (room_problem_id, user_id)
  select v_room_problem_id, rm.user_id from public.room_members rm where rm.room_id = p_room_id;

  insert into public.activity_events (room_id, actor_user_id, event_type, entity_id, payload)
  values (p_room_id, auth.uid(), 'problem_added', v_room_problem_id, jsonb_build_object('source', v_source, 'sourceKey', v_source_key));
  return v_room_problem_id;
end;
$$;

create or replace function public.set_problem_state(p_room_problem_id uuid, p_state text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_all_solved boolean;
begin
  if p_state not in ('not_started', 'thinking', 'solved') then raise exception 'Invalid participant state'; end if;
  select room_id into v_room_id from public.room_problems where id = p_room_problem_id for update;
  if v_room_id is null then raise exception 'Problem not found'; end if;
  if not public.is_room_member(v_room_id) then raise exception 'You are not a member of this room'; end if;
  if not exists(select 1 from public.problem_participants where room_problem_id = p_room_problem_id and user_id = auth.uid()) then
    raise exception 'You are not assigned to this problem';
  end if;

  update public.problem_participants
  set
    state = p_state::public.participant_state,
    started_at = case
      when p_state = 'not_started' then null
      when p_state = 'thinking' and state <> 'thinking' then now()
      else coalesce(started_at, now())
    end,
    solved_at = case when p_state = 'solved' then now() else null end,
    elapsed_seconds = case
      when p_state = 'solved' then greatest(0, extract(epoch from (now() - coalesce(started_at, now())))::integer)
      when p_state = 'not_started' or state = 'solved' then 0
      else elapsed_seconds
    end,
    updated_at = now()
  where room_problem_id = p_room_problem_id and user_id = auth.uid();

  select not exists(
    select 1 from public.problem_participants
    where room_problem_id = p_room_problem_id and required = true and state <> 'solved'
  ) into v_all_solved;

  update public.room_problems
  set state = case when v_all_solved then 'solved'::public.problem_state else 'queued'::public.problem_state end,
      completed_at = case when v_all_solved then coalesce(completed_at, now()) else null end
  where id = p_room_problem_id;

  insert into public.activity_events (room_id, actor_user_id, event_type, entity_id, payload)
  values (v_room_id, auth.uid(), 'participant_state_changed', p_room_problem_id, jsonb_build_object('state', p_state));
  return case when v_all_solved then 'solved' else 'queued' end;
end;
$$;

create or replace function public.remove_problem(p_room_problem_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_room_id uuid;
begin
  select room_id into v_room_id from public.room_problems where id = p_room_problem_id;
  if v_room_id is null then raise exception 'Problem not found'; end if;
  if not public.is_room_admin(v_room_id) then raise exception 'Only room admins can remove problems'; end if;
  delete from public.room_problems where id = p_room_problem_id;
  insert into public.activity_events (room_id, actor_user_id, event_type, entity_id)
  values (v_room_id, auth.uid(), 'problem_removed', p_room_problem_id);
end;
$$;

create or replace function public.get_app_snapshot(p_active_room_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_active_room_id uuid;
  v_rooms jsonb;
  v_public_rooms jsonb;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'Profile not found'; end if;

  if p_active_room_id is not null and public.is_room_member(p_active_room_id) then
    v_active_room_id := p_active_room_id;
  else
    select room_id into v_active_room_id from public.room_members where user_id = auth.uid() order by joined_at limit 1;
  end if;

  select coalesce(jsonb_agg(room_json order by room_name), '[]'::jsonb) into v_rooms
  from (
    select r.name room_name, jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'visibility', r.visibility,
      'inviteCode', r.invite_code,
      'role', me.role,
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'handle', p.handle,
          'initials', upper(left(p.display_name, 1)),
          'color', p.color,
          'online', false
        ) order by rm.joined_at)
        from public.room_members rm join public.profiles p on p.id = rm.user_id
        where rm.room_id = r.id
      ), '[]'::jsonb),
      'problems', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', rp.id,
          'source', pr.source,
          'sourceKey', pr.source_key,
          'title', pr.title,
          'url', pr.canonical_url,
          'difficulty', pr.difficulty,
          'tags', to_jsonb(pr.tags),
          'state', rp.state,
          'addedAt', rp.added_at,
          'completedAt', rp.completed_at,
          'participants', coalesce((
            select jsonb_agg(jsonb_build_object(
              'userId', pp.user_id,
              'status', pp.state,
              'required', pp.required,
              'startedAt', pp.started_at,
              'solvedAt', pp.solved_at,
              'elapsedSeconds', pp.elapsed_seconds
            ) order by pp.user_id)
            from public.problem_participants pp where pp.room_problem_id = rp.id
          ), '[]'::jsonb)
        ) order by rp.position)
        from public.room_problems rp join public.problems pr on pr.id = rp.problem_id
        where rp.room_id = r.id and rp.state <> 'archived'
      ), '[]'::jsonb)
    ) room_json
    from public.room_members me join public.rooms r on r.id = me.room_id
    where me.user_id = auth.uid() and r.archived_at is null
  ) room_rows;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'members', (select count(*) from public.room_members rm where rm.room_id = r.id),
    'problems', (select count(*) from public.room_problems rp where rp.room_id = r.id and rp.state <> 'archived'),
    'tags', jsonb_build_array('Company', 'Public')
  ) order by r.created_at desc), '[]'::jsonb) into v_public_rooms
  from public.rooms r
  where r.organization_id = v_profile.organization_id
    and r.visibility = 'public'
    and r.archived_at is null
    and not public.is_room_member(r.id);

  return jsonb_build_object(
    'currentUser', jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.display_name,
      'handle', v_profile.handle,
      'initials', upper(left(v_profile.display_name, 1)),
      'color', v_profile.color,
      'avatarUrl', v_profile.avatar_url
    ),
    'activeRoomId', v_active_room_id,
    'rooms', v_rooms,
    'publicRooms', v_public_rooms
  );
end;
$$;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public;
grant usage on schema public to authenticated;
grant select on public.organizations, public.profiles, public.rooms, public.room_members, public.problems,
  public.room_problems, public.problem_participants, public.activity_events to authenticated;
grant update (display_name, handle, avatar_url, color, timezone) on public.profiles to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;
grant execute on function public.is_room_admin(uuid, uuid) to authenticated;
grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.enqueue_problem(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.set_problem_state(uuid, text) to authenticated;
grant execute on function public.remove_problem(uuid) to authenticated;
grant execute on function public.get_app_snapshot(uuid) to authenticated;

-- Realtime Postgres Changes delivery still respects the RLS policies above.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_members') then
    alter publication supabase_realtime add table public.room_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_problems') then
    alter publication supabase_realtime add table public.room_problems;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'problem_participants') then
    alter publication supabase_realtime add table public.problem_participants;
  end if;
end $$;
