-- Cardio set values. Typed columns (not key/value): each is optional and only
-- shown for the 'cardio' measurement type. Distance stays in distance_m and
-- time in duration_s.
alter table public.performed_sets
  add column speed_kmh numeric(4, 1) check (speed_kmh between 0 and 40),
  add column incline_pct numeric(4, 1) check (incline_pct between -10 and 40),
  add column calories smallint check (calories between 0 and 10000);

update public.exercises
set measurement_type = 'cardio',
    instructions = case slug
      when 'treadmill' then 'Ange tid, distans, hastighet, lutning och kalorier från maskinen. Fyll i det du har.'
      when 'cross_trainer' then 'Ange tid, distans och kalorier från maskinen. Fyll i det du har.'
      when 'exercise_bike' then 'Ange tid, distans och kalorier från maskinen. Fyll i det du har.'
    end
where slug in ('treadmill', 'cross_trainer', 'exercise_bike') and owner_id is null;

-- Prefill and "last time" must carry the new values too.
create or replace function public.add_performed_exercise(
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

  select * into v_ex from public.exercises where id = p_exercise_id;
  if not found then
    raise exception 'exercise not found' using errcode = 'P0002';
  end if;

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
    insert into public.performed_sets (performed_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m,
                                       speed_kmh, incline_pct, calories)
    values (v_pe_id, v_pos, 'warmup',
            (v_prev ->> 'weight_kg')::numeric, (v_prev ->> 'reps')::smallint,
            (v_prev ->> 'duration_s')::integer, (v_prev ->> 'distance_m')::integer,
            (v_prev ->> 'speed_kmh')::numeric, (v_prev ->> 'incline_pct')::numeric, (v_prev ->> 'calories')::smallint);
    v_pos := v_pos + 1;
  end loop;

  for v_i in 0 .. p_planned_sets - 1 loop
    v_prev := v_prev_working -> least(v_i, jsonb_array_length(v_prev_working) - 1);
    insert into public.performed_sets (performed_exercise_id, position, kind, weight_kg, reps, duration_s, distance_m,
                                       speed_kmh, incline_pct, calories)
    values (v_pe_id, v_pos, 'working',
            (v_prev ->> 'weight_kg')::numeric,
            coalesce((v_prev ->> 'reps')::smallint,
                     case when v_ex.measurement_type in ('weight_reps', 'bodyweight_reps') then p_rep_min end),
            coalesce((v_prev ->> 'duration_s')::integer, p_target_duration_s),
            coalesce((v_prev ->> 'distance_m')::integer, p_target_distance_m),
            (v_prev ->> 'speed_kmh')::numeric, (v_prev ->> 'incline_pct')::numeric, (v_prev ->> 'calories')::smallint);
    v_pos := v_pos + 1;
  end loop;

  return v_pe_id;
end;
$$;

create or replace function public.last_performances(p_exercise_ids uuid[])
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
        'duration_s', s.duration_s, 'distance_m', s.distance_m,
        'speed_kmh', s.speed_kmh, 'incline_pct', s.incline_pct, 'calories', s.calories
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
