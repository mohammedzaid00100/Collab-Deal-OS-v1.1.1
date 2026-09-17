-- Keep creator and brand signup paths distinct.
-- A role may be changed only while the account is still unfinished and has no role profile.
-- Once onboarding creates a creator/brand profile, the account role is locked.

create or replace function public.claim_account_role(desired_role public.account_type)
returns public.account_type
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_account_role public.account_type;
  completed_at timestamptz;
  auth_email text;
  has_creator_profile boolean := false;
  has_brand_profile boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select u.account_type, u.onboarding_completed_at
    into existing_account_role, completed_at
  from public.users u
  where u.id = current_user_id
  for update;

  if not found then
    select lower(coalesce(nullif(au.email, ''), au.id::text || '@invalid.local'))
      into auth_email
    from auth.users au
    where au.id = current_user_id;

    if auth_email is null then
      raise exception 'Authenticated user record not found';
    end if;

    insert into public.users (id, email, account_type)
    values (current_user_id, auth_email, desired_role)
    on conflict (id) do nothing;

    insert into public.usage_limits (user_id) values (current_user_id)
    on conflict (user_id) do nothing;

    insert into public.subscriptions (user_id) values (current_user_id)
    on conflict (user_id) do nothing;

    select u.account_type, u.onboarding_completed_at
      into existing_account_role, completed_at
    from public.users u
    where u.id = current_user_id
    for update;
  end if;

  if existing_account_role is null then
    update public.users
    set account_type = desired_role, updated_at = now()
    where id = current_user_id
    returning account_type into existing_account_role;
    return existing_account_role;
  end if;

  if existing_account_role <> desired_role and completed_at is null then
    select exists(select 1 from public.creator_profiles cp where cp.user_id = current_user_id)
      into has_creator_profile;
    select exists(select 1 from public.brand_profiles bp where bp.user_id = current_user_id)
      into has_brand_profile;

    if not has_creator_profile and not has_brand_profile then
      update public.users
      set account_type = desired_role, updated_at = now()
      where id = current_user_id
      returning account_type into existing_account_role;
    end if;
  end if;

  return existing_account_role;
end;
$$;

revoke execute on function public.claim_account_role(public.account_type) from public, anon;
grant execute on function public.claim_account_role(public.account_type) to authenticated;
