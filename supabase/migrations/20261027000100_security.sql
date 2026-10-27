-- Row Level Security and grants. Model: deny by default, then grant the
-- `authenticated` role exactly what the app needs. `anon` gets nothing.
-- Every policy compares to (select auth.uid()) so Postgres evaluates it once
-- per statement (Supabase performance recommendation).

-- ---------------------------------------------------------------------------
-- Strip the broad default privileges Supabase gives anon/authenticated.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table in public. New tables must do the same
-- (enforced by supabase/tests/rls.test.ts).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.imports enable row level security;
alter table public.activities enable row level security;
alter table public.activity_metrics enable row level security;
alter table public.performed_exercises enable row level security;
alter table public.performed_sets enable row level security;
alter table public.historical_totals enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.heart_rate_samples enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: read and update your own row. Rows are created by the
-- on_auth_user_created trigger, never by the client; no delete.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name, timezone, weight_increment_kg) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Exercises: global library is read-only; custom exercises are owner-only.
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.exercises to authenticated;
grant update (name, category, primary_muscles, secondary_muscles, equipment,
              instructions, measurement_type, archived_at)
  on public.exercises to authenticated;

create policy exercises_select_global_or_own on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and slug is null);
create policy exercises_update_own on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy exercises_delete_own on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Plain owner-only tables. The composite FKs (parent_id, user_id) guarantee a
-- child can only point at a parent with the same owner.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  public.workout_templates,
  public.activities,
  public.activity_metrics,
  public.performed_sets,
  public.historical_totals
to authenticated;

create policy workout_templates_all_own on public.workout_templates
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy activities_all_own on public.activities
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy activity_metrics_all_own on public.activity_metrics
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy performed_sets_all_own on public.performed_sets
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy historical_totals_all_own on public.historical_totals
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Tables that also reference the exercise library: the referenced exercise
-- must be visible to the caller (global or own). The FK alone would accept
-- another user's private exercise id.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.template_exercises, public.performed_exercises to authenticated;

create policy template_exercises_select_own on public.template_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy template_exercises_insert_own on public.template_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e
                where e.id = exercise_id
                  and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy template_exercises_update_own on public.template_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e
                where e.id = exercise_id
                  and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy template_exercises_delete_own on public.template_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

create policy performed_exercises_select_own on public.performed_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy performed_exercises_insert_own on public.performed_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (exercise_id is null or exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))))
  );
create policy performed_exercises_update_own on public.performed_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (exercise_id is null or exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))))
  );
create policy performed_exercises_delete_own on public.performed_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Imports: one log row per import run, written by import_activities()
-- (security invoker, so the caller's own privileges and policies apply).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.imports to authenticated;

create policy imports_all_own on public.imports
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Prepared health tables: read-only for the client for now. Writes will come
-- from a future, reviewed import path (docs/INTEGRATIONS.md).
-- ---------------------------------------------------------------------------
grant select on public.daily_metrics, public.heart_rate_samples to authenticated;

create policy daily_metrics_select_own on public.daily_metrics
  for select to authenticated using (user_id = (select auth.uid()));
create policy heart_rate_samples_select_own on public.heart_rate_samples
  for select to authenticated using (user_id = (select auth.uid()));
