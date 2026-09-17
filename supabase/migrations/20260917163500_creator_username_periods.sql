alter table public.creator_profiles
  drop constraint if exists creator_profiles_username_check;

alter table public.creator_profiles
  add constraint creator_profiles_username_check
  check (username ~ '^[a-z0-9._]{3,30}$');
