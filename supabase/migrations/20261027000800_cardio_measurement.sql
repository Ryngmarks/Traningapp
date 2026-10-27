-- Cardio machines (treadmill, cross trainer, bike) log time, distance, speed,
-- incline and calories per set (owner request 2026-10-27). The enum value is
-- added in its own migration because it cannot be used in the transaction
-- that adds it.
alter type public.measurement_type add value if not exists 'cardio';
