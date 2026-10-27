-- RPC functions used by the app. All client-callable functions are
-- SECURITY INVOKER: they run with the caller's privileges and RLS policies,
-- so they can never reach another user's rows. They exist for atomicity
-- (several inserts in one transaction) and to keep gym rules in one place.

-- ---------------------------------------------------------------------------
-- add_performed_exercise: snapshot an exercise into a workout and create its
-- planned sets, prefilled from the last completed performance of the same
-- exercise. Prefilled sets are not completed until the user marks them.
-- ---------------------------------------------------------------------------
create function public.add_performed_exercise(
  p_activity_id uuid,
  p_exercise_id uuid,
  p_position integer,
  p_warmup_sets integer default 0,
  p_planned_sets integer default 3,
  p_rep_min integer default null,
  p_rep_max integer default null,
  p_target_duration_s integer default null,
  p_target_distance_m integer default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ex public.exercises;
  v_pe_id uuid;
  v_last_pe uuid;
  v_prev_warmup jsonb;
  v_prev_working jsonb;
  v_prev jsonb;
  v_pos integer := 0;
  v_i integer;
begin
  if p_warmup_sets not between 0 and 10 or p_planned_sets not between 0 and 20 then
    raise exception 'invalid set count' using errcode = '22023';
  end if;

  -- RLS: only global or own exercises are visible.
  select * into v_ex from public.exercises where id = p_exercise_id;
  if not found then
    raise exception 'exercise not found' using errcode = 'P0002';
  end if;

  -- The composite FK (activity_id, user_id) rejects activities owned by others.
  insert into public.performed_exercises (
    activity_id, exercise_id, exercise_name, category, measurement_type,
    position, planned_sets, rep_min, rep_max
  ) values (
    p_activity_id, v_ex.id, v_ex.name, v_ex.category, v_ex.measurement_type,
    p_position, p_planned_sets, p_rep_min, p_rep_max
  ) returning id into v_pe_id;

  select pe.id into v_last_pe
  from public.performed_exercises pe
  join public.activities a on a.id = pe.activity_id
  where pe.exercise_id = p_exercise_id
    and a.status = 'completed'
    and exists (select 1 from public.performed_sets s
                where s.performed_exercise_id = pe.id and s.completed_at is not null)
  order by a.started_at desc, pe.position
  limit 1;

  select
    coalesce(jsonb_agg(to_jsonb(s) order by s.position) filter (where s.kind = 'warmup'), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(s) order by s.position) filter (where s.kind = 'working'), '[]'::jsonb)
  into v_prev_warmup, v_prev_working
  from public.performed_sets s
  where s.performed_exercise_id = v_last_pe and s.completed_at is not null;

  for v_i in 0 .. p_warmup_sets - 1 loop
    v_prev := v_prev_warmup -> least(v_i, jsonb_array_length(v_prev_warmup) - 1);
    insert into public.performed_sets (performed_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m)
    values (v_pe_id, v_pos, 'warmup',
            (v_prev ->> 'weight_kg')::numeric, (v_prev ->> 'reps')::smallint,
            (v_prev ->> 'duration_s')::integer, (v_prev ->> 'distance_m')::integer);
    v_pos := v_pos + 1;
  end loop;

  for v_i in 0 .. p_planned_sets - 1 loop
    v_prev := v_prev_working -> least(v_i, jsonb_array_length(v_prev_working) - 1);
    insert into public.performed_sets (performed_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m)
    values (v_pe_id, v_pos, 'working',
            (v_prev ->> 'weight_kg')::numeric,
            coalesce((v_prev ->> 'reps')::smallint,
                     case when v_ex.measurement_type in ('weight_reps', 'bodyweight_reps') then p_rep_min end),
            coalesce((v_prev ->> 'duration_s')::integer, p_target_duration_s),
            coalesce((v_prev ->> 'distance_m')::integer, p_target_distance_m));
    v_pos := v_pos + 1;
  end loop;

  return v_pe_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- start_workout: create an in-progress gym activity, optionally from a
-- template. Fails with 'active_workout_exists' if one is already running.
-- ---------------------------------------------------------------------------
create function public.start_workout(
  p_template_id uuid default null,
  p_timezone text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tz text;
  v_tpl public.workout_templates;
  v_activity_id uuid;
  r public.template_exercises;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_tz := coalesce(p_timezone, (select timezone from public.profiles where id = v_uid), 'UTC');

  if p_template_id is not null then
    select * into v_tpl from public.workout_templates where id = p_template_id;
    if not found then
      raise exception 'template not found' using errcode = 'P0002';
    end if;
  end if;

  begin
    insert into public.activities (type, status, title, started_at, timezone, template_id, template_name)
    values ('gym', 'in_progress', v_tpl.name, now(), v_tz, v_tpl.id, v_tpl.name)
    returning id into v_activity_id;
  exception when unique_violation then
    raise exception 'active_workout_exists' using errcode = '23505';
  end;

  if p_template_id is not null then
    for r in
      select * from public.template_exercises te
      where te.template_id = p_template_id
      order by te.position
    loop
      perform public.add_performed_exercise(
        v_activity_id, r.exercise_id, r.position, r.warmup_sets, r.planned_sets,
        r.rep_min, r.rep_max, r.target_duration_s, r.target_distance_m
      );
    end loop;
  end if;

  return v_activity_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- finish_workout: mark completed, drop sets that were planned but never done,
-- and drop exercises left without sets. History holds only performed work.
-- ---------------------------------------------------------------------------
create function public.finish_workout(
  p_activity_id uuid,
  p_ended_at timestamptz default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.performed_sets s
  using public.performed_exercises pe
  where s.performed_exercise_id = pe.id
    and pe.activity_id = p_activity_id
    and s.completed_at is null;

  delete from public.performed_exercises pe
  where pe.activity_id = p_activity_id
    and not exists (select 1 from public.performed_sets s where s.performed_exercise_id = pe.id);

  update public.activities a
  set status = 'completed',
      ended_at = greatest(coalesce(p_ended_at, now()), a.started_at),
      duration_s = null
  where a.id = p_activity_id and a.status = 'in_progress';

  if not found then
    raise exception 'no active workout with this id' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_template: create or update a template and replace its exercise list
-- in one transaction. Workouts already performed are unaffected because they
-- hold snapshots, not references to template rows.
-- p_items: [{ id?, exercise_id, warmup_sets, planned_sets, rep_min, rep_max,
--             target_duration_s, target_distance_m, rest_seconds, notes }]
-- ---------------------------------------------------------------------------
create function public.save_template(
  p_template_id uuid,
  p_name text,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_ord bigint;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 40 then
    raise exception 'items must be an array of at most 40 exercises' using errcode = '22023';
  end if;

  if p_template_id is null then
    insert into public.workout_templates (name, notes, sort_order)
    values (
      p_name, nullif(btrim(p_notes), ''),
      coalesce((select max(sort_order) + 1 from public.workout_templates), 0)
    )
    returning id into v_id;
  else
    update public.workout_templates set name = p_name, notes = nullif(btrim(p_notes), '')
    where id = p_template_id
    returning id into v_id;
    if v_id is null then
      raise exception 'template not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.template_exercises te
  where te.template_id = v_id
    and te.id not in (
      select (x ->> 'id')::uuid from jsonb_array_elements(p_items) x
      where nullif(x ->> 'id', '') is not null
    );

  for v_item, v_ord in select x, o from jsonb_array_elements(p_items) with ordinality as t(x, o) loop
    insert into public.template_exercises as te (
      id, template_id, exercise_id, position, warmup_sets, planned_sets, rep_min, rep_max,
      target_duration_s, target_distance_m, rest_seconds, notes
    ) values (
      coalesce(nullif(v_item ->> 'id', '')::uuid, gen_random_uuid()),
      v_id,
      (v_item ->> 'exercise_id')::uuid,
      v_ord - 1,
      coalesce((v_item ->> 'warmup_sets')::smallint, 0),
      coalesce((v_item ->> 'planned_sets')::smallint, 3),
      (v_item ->> 'rep_min')::smallint,
      (v_item ->> 'rep_max')::smallint,
      (v_item ->> 'target_duration_s')::integer,
      (v_item ->> 'target_distance_m')::integer,
      (v_item ->> 'rest_seconds')::smallint,
      nullif(v_item ->> 'notes', '')
    )
    on conflict (id) do update set
      exercise_id = excluded.exercise_id,
      position = excluded.position,
      warmup_sets = excluded.warmup_sets,
      planned_sets = excluded.planned_sets,
      rep_min = excluded.rep_min,
      rep_max = excluded.rep_max,
      target_duration_s = excluded.target_duration_s,
      target_distance_m = excluded.target_distance_m,
      rest_seconds = excluded.rest_seconds,
      notes = excluded.notes
    where te.template_id = v_id;
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- last_performances: the most recent completed sets per exercise.
-- ---------------------------------------------------------------------------
create function public.last_performances(p_exercise_ids uuid[])
returns table (
  exercise_id uuid,
  activity_id uuid,
  started_at timestamptz,
  rep_min smallint,
  rep_max smallint,
  sets jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (pe.exercise_id)
    pe.exercise_id,
    a.id,
    a.started_at,
    pe.rep_min,
    pe.rep_max,
    (
      select jsonb_agg(jsonb_build_object(
        'kind', s.kind, 'weight_kg', s.weight_kg, 'reps', s.reps,
        'duration_s', s.duration_s, 'distance_m', s.distance_m
      ) order by s.position)
      from public.performed_sets s
      where s.performed_exercise_id = pe.id and s.completed_at is not null
    )
  from public.performed_exercises pe
  join public.activities a on a.id = pe.activity_id
  where pe.exercise_id = any (p_exercise_ids)
    and a.status = 'completed'
    and exists (select 1 from public.performed_sets s
                where s.performed_exercise_id = pe.id and s.completed_at is not null)
  order by pe.exercise_id, a.started_at desc, pe.position
$$;

-- ---------------------------------------------------------------------------
-- import_activities: idempotent bulk import of dated activities.
-- Each row: { type, started_at, timezone?, duration_s?, distance_m?, steps?,
--             avg_heart_rate?, max_heart_rate?, perceived_exertion?, title?,
--             notes?, external_id? }
-- Rows are deduplicated on (user, source, external_id). Without an
-- external_id one is derived from type + started_at, so re-importing the
-- same file never double counts. Invalid rows are counted, not inserted.
-- ---------------------------------------------------------------------------
create function public.import_activities(
  p_source public.data_source,
  p_file_name text,
  p_rows jsonb
) returns public.imports
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_import public.imports;
  v_row jsonb;
  v_idx integer := 0;
  v_activity_id uuid;
  v_inserted integer := 0;
  v_duplicates integer := 0;
  v_errors integer := 0;
  v_messages text[] := '{}';
  v_default_tz text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_source = 'manual' then
    raise exception 'imports cannot use source manual' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'rows must be an array of at most 5000 items' using errcode = '22023';
  end if;

  v_default_tz := coalesce((select timezone from public.profiles where id = v_uid), 'UTC');

  insert into public.imports (source, file_name, total_rows)
  values (p_source, left(p_file_name, 255), jsonb_array_length(p_rows))
  returning * into v_import;

  for v_row in select x from jsonb_array_elements(p_rows) x loop
    v_idx := v_idx + 1;
    begin
      if jsonb_typeof(v_row) is distinct from 'object' then
        raise exception 'not an object';
      end if;

      insert into public.activities (
        type, status, title, started_at, timezone, duration_s, perceived_exertion,
        notes, source, external_id, import_id
      ) values (
        (v_row ->> 'type')::public.activity_type,
        'completed',
        nullif(v_row ->> 'title', ''),
        (v_row ->> 'started_at')::timestamptz,
        coalesce(nullif(v_row ->> 'timezone', ''), v_default_tz),
        (v_row ->> 'duration_s')::integer,
        (v_row ->> 'perceived_exertion')::smallint,
        nullif(v_row ->> 'notes', ''),
        p_source,
        coalesce(
          nullif(btrim(v_row ->> 'external_id'), ''),
          md5((v_row ->> 'type') || '|' || ((v_row ->> 'started_at')::timestamptz)::text)
        ),
        v_import.id
      )
      on conflict on constraint activities_external_key do nothing
      returning id into v_activity_id;

      if v_activity_id is null then
        v_duplicates := v_duplicates + 1;
      else
        if coalesce(v_row ->> 'distance_m', v_row ->> 'steps', v_row ->> 'avg_heart_rate',
                    v_row ->> 'max_heart_rate') is not null then
          insert into public.activity_metrics (activity_id, distance_m, steps, avg_heart_rate, max_heart_rate)
          values (
            v_activity_id,
            (v_row ->> 'distance_m')::integer,
            (v_row ->> 'steps')::integer,
            (v_row ->> 'avg_heart_rate')::smallint,
            (v_row ->> 'max_heart_rate')::smallint
          );
        end if;
        v_inserted := v_inserted + 1;
      end if;
    exception when others then
      v_errors := v_errors + 1;
      if cardinality(v_messages) < 20 then
        v_messages := v_messages || format('rad %s: %s', v_idx, sqlerrm);
      end if;
    end;
  end loop;

  update public.imports
  set inserted_rows = v_inserted,
      duplicate_rows = v_duplicates,
      error_rows = v_errors,
      error_summary = nullif(array_to_string(v_messages, E'\n'), '')
  where id = v_import.id
  returning * into v_import;

  return v_import;
end;
$$;

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + two editable example templates.
-- SECURITY DEFINER because it runs from the auth.users trigger; it only ever
-- writes rows for NEW.id and is not executable by API roles.
-- ---------------------------------------------------------------------------
create function public.create_example_templates(p_user_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid;
  v_b uuid;
begin
  insert into public.workout_templates (user_id, name, notes, sort_order)
  values (p_user_id, 'Fotbollsstyrka A', 'Ben, explosivitet och ljumske.', 0)
  returning id into v_a;

  insert into public.workout_templates (user_id, name, notes, sort_order)
  values (p_user_id, 'Fotbollsstyrka B', 'Baksida, höft och bibehållen överkropp.', 1)
  returning id into v_b;

  insert into public.template_exercises (
    template_id, user_id, exercise_id, position, warmup_sets, planned_sets,
    rep_min, rep_max, target_duration_s, rest_seconds
  )
  select t.template_id, p_user_id, e.id, t.position, t.warmup_sets, t.planned_sets,
         t.rep_min, t.rep_max, t.target_duration_s, t.rest_seconds
  from (values
    (v_a, 'box_jump',              0, 0, 3, 3, 5,    null, 90),
    (v_a, 'back_squat',            1, 2, 3, 5, 8,    null, 150),
    (v_a, 'romanian_deadlift',     2, 1, 3, 6, 10,   null, 120),
    (v_a, 'bulgarian_split_squat', 3, 0, 3, 8, 12,   null, 90),
    (v_a, 'copenhagen_plank',      4, 0, 3, null, null, 25, 60),
    (v_a, 'pallof_press',          5, 0, 3, 10, 12,  null, 60),
    (v_b, 'broad_jump',            0, 0, 3, 3, 5,    null, 90),
    (v_b, 'trap_bar_deadlift',     1, 2, 3, 4, 6,    null, 150),
    (v_b, 'nordic_hamstring_curl', 2, 0, 3, 4, 6,    null, 120),
    (v_b, 'hip_thrust',            3, 1, 3, 8, 12,   null, 90),
    (v_b, 'bench_press',           4, 1, 3, 6, 10,   null, 120),
    (v_b, 'pull_up',               5, 0, 3, 6, 10,   null, 120),
    (v_b, 'side_plank',            6, 0, 2, null, null, 40, 45)
  ) as t(template_id, slug, position, warmup_sets, planned_sets, rep_min, rep_max, target_duration_s, rest_seconds)
  join public.exercises e on e.slug = t.slug and e.owner_id is null;
end;
$$;

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''));
  perform public.create_example_templates(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Function privileges: nothing for anon; authenticated gets the RPCs and the
-- helper used inside triggers that run as the caller.
-- ---------------------------------------------------------------------------
revoke all on function public.create_example_templates(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.assert_valid_timezone(text) to authenticated;
grant execute on function public.add_performed_exercise(uuid, uuid, integer, integer, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.start_workout(uuid, text) to authenticated;
grant execute on function public.finish_workout(uuid, timestamptz) to authenticated;
grant execute on function public.save_template(uuid, text, text, jsonb) to authenticated;
grant execute on function public.last_performances(uuid[]) to authenticated;
grant execute on function public.import_activities(public.data_source, text, jsonb) to authenticated;
