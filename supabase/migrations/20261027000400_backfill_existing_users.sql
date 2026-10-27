-- Accounts created before the on_auth_user_created trigger existed (e.g. the
-- owner's account was added in the dashboard before the first migration ran)
-- have no profile or example templates. Backfill them once. Idempotent.
do $$
declare
  u record;
begin
  for u in
    select au.id, au.raw_user_meta_data
    from auth.users au
    where not exists (select 1 from public.profiles p where p.id = au.id)
  loop
    insert into public.profiles (id, display_name)
    values (u.id, nullif(left(u.raw_user_meta_data ->> 'display_name', 80), ''));
    if not exists (select 1 from public.workout_templates t where t.user_id = u.id) then
      perform public.create_example_templates(u.id);
    end if;
  end loop;
end $$;
