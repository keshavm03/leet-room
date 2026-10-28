-- Upgrade an existing Leet Room database with multi-site URL normalization.
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

grant execute on function public.enqueue_problem(uuid, text, text, text, text[]) to authenticated;
