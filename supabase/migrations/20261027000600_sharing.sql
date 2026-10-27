-- Sharing between members (owner decision 2026-10-27).
--
-- Accounts are invite-only, so every `authenticated` user is a member the
-- owner invited. Workout templates and custom exercises are shared with all
-- members automatically: everyone can read and start them, only the creator
-- can change or delete them. Logged training (activities, sets, metrics,
-- historical totals, imports, health data) stays private to its owner.
--
-- Global starter templates (user_id is null) are managed by migrations, like
-- the global exercise library.

-- ---------------------------------------------------------------------------
-- Templates: readable by all members, writable by the creator only.
-- ---------------------------------------------------------------------------
alter table public.workout_templates alter column user_id drop not null;
alter table public.template_exercises alter column user_id drop not null;

drop policy workout_templates_all_own on public.workout_templates;
create policy workout_templates_select_members on public.workout_templates
  for select to authenticated using (true);
create policy workout_templates_insert_own on public.workout_templates
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_templates_update_own on public.workout_templates
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_templates_delete_own on public.workout_templates
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy template_exercises_select_own on public.template_exercises;
create policy template_exercises_select_members on public.template_exercises
  for select to authenticated using (true);

-- Any exercise a member can see may be used (global, own or a friend's).
drop policy template_exercises_insert_own on public.template_exercises;
create policy template_exercises_insert_own on public.template_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );
drop policy template_exercises_update_own on public.template_exercises;
create policy template_exercises_update_own on public.template_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id)
  );

-- ---------------------------------------------------------------------------
-- Exercises: all members see every exercise; writes stay owner-only.
-- ---------------------------------------------------------------------------
drop policy exercises_select_global_or_own on public.exercises;
create policy exercises_select_members on public.exercises
  for select to authenticated using (true);

drop policy performed_exercises_insert_own on public.performed_exercises;
create policy performed_exercises_insert_own on public.performed_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id))
  );
drop policy performed_exercises_update_own on public.performed_exercises;
create policy performed_exercises_update_own on public.performed_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id))
  );

-- ---------------------------------------------------------------------------
-- Member names: the only profile field other members may see (to show who
-- shared a template or exercise). Kept in sync from profiles by a trigger, so
-- the rest of the profile stays private.
-- ---------------------------------------------------------------------------
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80)
);

alter table public.members enable row level security;
grant select on public.members to authenticated;
create policy members_select_members on public.members
  for select to authenticated using (true);

create function public.sync_member_name() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.members (user_id, display_name)
  values (new.id, new.display_name)
  on conflict (user_id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

create trigger profiles_sync_member_name
  after insert or update of display_name on public.profiles
  for each row execute function public.sync_member_name();

revoke all on function public.sync_member_name() from public, anon, authenticated;

insert into public.members (user_id, display_name)
select id, display_name from public.profiles
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- New members get no personal copies of starter templates any more: the
-- shared global templates (next migration) serve everyone.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''));
  return new;
end;
$$;

drop function public.create_example_templates(uuid);

-- ---------------------------------------------------------------------------
-- Starting a friend's or a global template: the workout keeps the template
-- name as its snapshot, but only links template_id to the caller's own
-- templates (the composite FK keeps every link within one owner).
-- ---------------------------------------------------------------------------
create or replace function public.start_workout(
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
    values ('gym', 'in_progress', v_tpl.name, now(), v_tz,
            case when v_tpl.user_id = v_uid then v_tpl.id end, v_tpl.name)
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
