-- Initial schema for the personal training platform.
-- Design notes live in docs/DATABASE.md. Security model in docs/SECURITY.md.
--
-- Conventions
-- * Every user-owned row carries user_id (default auth.uid()).
-- * Child tables reference their parent with a composite FK (parent_id, user_id)
--   -> parent(id, user_id). That makes it impossible to attach a row to a parent
--   owned by someone else, independently of RLS.
-- * History is snapshotted: performed exercises copy name/category/measurement
--   from the library, activities copy the template name.
-- * Timestamps are timestamptz (UTC). activities.local_date is derived from
--   started_at + the IANA timezone the activity was logged in, and is what all
--   week/month statistics group on.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.activity_type as enum (
  'gym', 'football_training', 'football_match', 'walk', 'run', 'other'
);
create type public.activity_status as enum ('in_progress', 'completed');
create type public.data_source as enum (
  'manual', 'import_csv', 'import_json', 'apple_health', 'other'
);
create type public.exercise_category as enum (
  'legs', 'hamstrings', 'hip_groin', 'core', 'explosive', 'mobility',
  'upper_body', 'conditioning'
);
create type public.measurement_type as enum (
  'weight_reps', 'bodyweight_reps', 'duration', 'distance'
);
create type public.set_kind as enum ('warmup', 'working');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Raises for unknown IANA names instead of silently storing garbage.
create function public.assert_valid_timezone(p_tz text) returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if p_tz is null or char_length(p_tz) > 64 then
    raise exception 'invalid timezone: %', p_tz using errcode = '22023';
  end if;
  perform now() at time zone p_tz;
exception
  when invalid_parameter_value then
    raise exception 'invalid timezone: %', p_tz using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  timezone text not null default 'Europe/Stockholm',
  weight_increment_kg numeric(4, 2) not null default 2.5
    check (weight_increment_kg > 0 and weight_increment_kg <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.profiles_validate() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_valid_timezone(new.timezone);
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.profiles_validate();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Exercise library: global rows (owner_id is null, managed by migrations only)
-- and user-owned custom exercises in one table so templates and history can
-- reference either with a single FK. RLS keeps global rows read-only.
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text unique,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category public.exercise_category not null,
  primary_muscles text[] not null default '{}' check (cardinality(primary_muscles) <= 12),
  secondary_muscles text[] not null default '{}' check (cardinality(secondary_muscles) <= 12),
  equipment text[] not null default '{}' check (cardinality(equipment) <= 8),
  instructions text check (char_length(instructions) <= 1000),
  measurement_type public.measurement_type not null default 'weight_reps',
  image_path text check (char_length(image_path) <= 300),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Global rows are identified by slug; user rows never have one.
  constraint exercises_slug_iff_global check ((owner_id is null) = (slug is not null))
);

create unique index exercises_owner_name_key
  on public.exercises (owner_id, lower(name))
  where owner_id is not null and archived_at is null;
create index exercises_owner_idx on public.exercises (owner_id);

create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workout templates
-- ---------------------------------------------------------------------------
create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  notes text check (char_length(notes) <= 1000),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index workout_templates_user_idx on public.workout_templates (user_id, sort_order);
create trigger workout_templates_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  user_id uuid not null default auth.uid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position integer not null check (position >= 0),
  warmup_sets smallint not null default 0 check (warmup_sets between 0 and 10),
  planned_sets smallint not null default 3 check (planned_sets between 1 and 20),
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  target_duration_s integer check (target_duration_s between 1 and 86400),
  target_distance_m integer check (target_distance_m between 1 and 100000),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_exercises_rep_range check (rep_min is null or rep_max is null or rep_min <= rep_max),
  constraint template_exercises_position_key unique (template_id, position) deferrable initially deferred,
  foreign key (template_id, user_id) references public.workout_templates (id, user_id) on delete cascade
);

create index template_exercises_user_idx on public.template_exercises (user_id);
create index template_exercises_exercise_idx on public.template_exercises (exercise_id);
create trigger template_exercises_updated_at before update on public.template_exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Imports (one row per import run; activities point back to it)
-- ---------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source public.data_source not null check (source <> 'manual'),
  file_name text check (char_length(file_name) <= 255),
  total_rows integer not null default 0 check (total_rows >= 0),
  inserted_rows integer not null default 0 check (inserted_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  error_summary text check (char_length(error_summary) <= 4000),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index imports_user_idx on public.imports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Activities: one row per session of any kind (gym, football, walk, run...)
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.activity_type not null,
  status public.activity_status not null default 'completed',
  title text check (char_length(title) <= 120),
  started_at timestamptz not null,
  ended_at timestamptz,
  timezone text not null default 'Europe/Stockholm',
  local_date date not null,
  duration_s integer check (duration_s between 0 and 86400),
  perceived_exertion smallint check (perceived_exertion between 1 and 10),
  notes text check (char_length(notes) <= 2000),
  template_id uuid,
  template_name text check (char_length(template_name) <= 80),
  source public.data_source not null default 'manual',
  external_id text check (char_length(external_id) between 1 and 200),
  import_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Import idempotency: the same external record can only land once per source.
  constraint activities_external_key unique (user_id, source, external_id),
  constraint activities_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint activities_only_gym_in_progress check (status = 'completed' or type = 'gym'),
  foreign key (template_id, user_id) references public.workout_templates (id, user_id)
    on delete set null (template_id),
  foreign key (import_id, user_id) references public.imports (id, user_id)
    on delete set null (import_id)
);

-- At most one running gym session per user: protects against double starts.
create unique index activities_one_in_progress on public.activities (user_id)
  where status = 'in_progress';
create index activities_user_date_idx on public.activities (user_id, local_date desc);
create index activities_user_type_idx on public.activities (user_id, type, local_date desc);

create function public.activities_derive() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_valid_timezone(new.timezone);
  new.local_date := (new.started_at at time zone new.timezone)::date;
  if new.ended_at is not null and new.duration_s is null then
    new.duration_s := least(86400, extract(epoch from (new.ended_at - new.started_at))::integer);
  end if;
  return new;
end;
$$;

create trigger activities_derive before insert or update on public.activities
  for each row execute function public.activities_derive();
create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

-- Typed, optional measurements for an activity (1:1). Not key/value.
create table public.activity_metrics (
  activity_id uuid primary key,
  user_id uuid not null default auth.uid(),
  distance_m integer check (distance_m between 0 and 1000000),
  -- Steps taken during this activity only. Daily totals live in daily_metrics.
  steps integer check (steps between 0 and 200000),
  avg_heart_rate smallint check (avg_heart_rate between 25 and 250),
  max_heart_rate smallint check (max_heart_rate between 25 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);

create index activity_metrics_user_idx on public.activity_metrics (user_id);
create trigger activity_metrics_updated_at before update on public.activity_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Gym detail: performed exercises and sets (snapshots, independent of library)
-- ---------------------------------------------------------------------------
create table public.performed_exercises (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  user_id uuid not null default auth.uid(),
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null check (char_length(exercise_name) between 1 and 80),
  category public.exercise_category not null,
  measurement_type public.measurement_type not null,
  position integer not null check (position >= 0),
  planned_sets smallint check (planned_sets between 0 and 20),
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (activity_id, user_id) references public.activities (id, user_id) on delete cascade
);

create index performed_exercises_activity_idx on public.performed_exercises (activity_id, position);
create index performed_exercises_user_exercise_idx on public.performed_exercises (user_id, exercise_id);
create trigger performed_exercises_updated_at before update on public.performed_exercises
  for each row execute function public.set_updated_at();

create table public.performed_sets (
  -- The client generates this id, so a retried save is an idempotent upsert
  -- and can never create a duplicate set.
  id uuid primary key default gen_random_uuid(),
  performed_exercise_id uuid not null,
  user_id uuid not null default auth.uid(),
  position integer not null check (position >= 0),
  kind public.set_kind not null default 'working',
  weight_kg numeric(6, 2) check (weight_kg between 0 and 1000),
  reps smallint check (reps between 0 and 1000),
  duration_s integer check (duration_s between 0 and 86400),
  distance_m integer check (distance_m between 0 and 100000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (performed_exercise_id, user_id) references public.performed_exercises (id, user_id) on delete cascade
);

create index performed_sets_exercise_idx on public.performed_sets (performed_exercise_id, position);
create index performed_sets_user_idx on public.performed_sets (user_id);
create trigger performed_sets_updated_at before update on public.performed_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Historical totals: counts without dates (e.g. "110 gym visits before the app").
-- See docs/TRAINING_MODEL.md for the reconciliation rule (covers_until).
-- ---------------------------------------------------------------------------
create table public.historical_totals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_type public.activity_type not null,
  session_count integer not null check (session_count between 0 and 100000),
  total_distance_m bigint check (total_distance_m between 0 and 100000000),
  total_duration_s bigint check (total_duration_s between 0 and 1000000000),
  period_start date,
  covers_until date not null,
  source_label text check (char_length(source_label) <= 120),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_totals_period check (period_start is null or period_start <= covers_until)
);

create index historical_totals_user_idx on public.historical_totals (user_id, activity_type);
create trigger historical_totals_updated_at before update on public.historical_totals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Future health data (prepared, no UI yet). Kept out of the activity tables.
-- ---------------------------------------------------------------------------
create table public.daily_metrics (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  source public.data_source not null,
  -- All steps that day, including steps during logged activities.
  steps integer check (steps between 0 and 200000),
  resting_heart_rate smallint check (resting_heart_rate between 25 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, source)
);

create trigger daily_metrics_updated_at before update on public.daily_metrics
  for each row execute function public.set_updated_at();

create table public.heart_rate_samples (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_id uuid,
  recorded_at timestamptz not null,
  bpm smallint not null check (bpm between 25 and 250),
  source public.data_source not null,
  unique (user_id, source, recorded_at),
  foreign key (activity_id, user_id) references public.activities (id, user_id)
    on delete set null (activity_id)
);

create index heart_rate_samples_activity_idx on public.heart_rate_samples (activity_id)
  where activity_id is not null;
