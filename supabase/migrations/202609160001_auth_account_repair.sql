-- Repair OAuth accounts that were created in auth.users before the public account
-- trigger existed (or after a trigger failure), and make role claiming self-healing.
-- This specifically prevents successful Google OAuth callbacks from failing with
-- /login?error=account_unavailable because public.users is missing.

-- 1) Backfill public.users for any existing Supabase Auth users that do not yet
-- have an application account record.
insert into public.users (id, email, account_type)
select
  au.id,
  lower(coalesce(nullif(au.email, ''), au.id::text || '@invalid.local')),
  case
    when au.raw_user_meta_data ->> 'account_type' in ('creator', 'brand')
      then (au.raw_user_meta_data ->> 'account_type')::public.account_type
    else null
  end
from auth.users au
left join public.users u on u.id = au.id
where u.id is null
on conflict (id) do nothing;

-- Keep the support rows in sync for repaired accounts.
insert into public.usage_limits (user_id)
select u.id
from public.users u
left join public.usage_limits ul on ul.user_id = u.id
where ul.user_id is null
on conflict (user_id) do nothing;

insert into public.subscriptions (user_id)
select u.id
from public.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null
on conflict (user_id) do nothing;

-- 2) Make future auth-user creation more defensive. If the application row
-- already exists, preserve a claimed role instead of accidentally clearing it.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.account_type;
  normalized_email text;
begin
  if new.raw_user_meta_data ->> 'account_type' in ('creator', 'brand') then
    requested_role := (new.raw_user_meta_data ->> 'account_type')::public.account_type;
  else
    requested_role := null;
  end if;

  normalized_email := lower(coalesce(nullif(new.email, ''), new.id::text || '@invalid.local'));

  insert into public.users (id, email, account_type)
  values (new.id, normalized_email, requested_role)
  on conflict (id) do update
  set
    email = excluded.email,
    account_type = coalesce(public.users.account_type, excluded.account_type);

  insert into public.usage_limits (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 3) Self-heal claim_account_role. OAuth can succeed even if the original
-- public.users trigger was absent at the moment auth.users was created. Rather
-- than returning "Account record not found", recreate the missing app row from
-- auth.users and continue the normal role-claim flow.
create or replace function public.claim_account_role(desired_role public.account_type)
returns public.account_type
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  existing_account_role public.account_type;
  auth_email text;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select account_type into existing_account_role
  from public.users
  where id = current_user_id
  for update;

  if not found then
    select lower(coalesce(nullif(email, ''), id::text || '@invalid.local'))
      into auth_email
    from auth.users
    where id = current_user_id;

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

    select account_type into existing_account_role
    from public.users
    where id = current_user_id
    for update;
  end if;

  if existing_account_role is null then
    update public.users
    set account_type = desired_role
    where id = current_user_id
    returning account_type into existing_account_role;
  end if;

  return existing_account_role;
end;
$$;

revoke all on function public.claim_account_role(public.account_type) from public;
grant execute on function public.claim_account_role(public.account_type) to authenticated;
