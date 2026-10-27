-- General gym categories (owner decision 2026-10-27: the gym module is for all
-- kinds of strength training, not only football). Enum values are added in
-- their own migration because a new value cannot be used in the same
-- transaction that adds it.
alter type public.exercise_category add value if not exists 'chest';
alter type public.exercise_category add value if not exists 'back';
alter type public.exercise_category add value if not exists 'shoulders';
alter type public.exercise_category add value if not exists 'arms';
