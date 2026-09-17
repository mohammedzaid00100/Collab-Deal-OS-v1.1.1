-- Server-side payment password security for sensitive prototype actions,
-- including account deletion. Real payment-provider authentication can replace
-- or extend this in the MVP without changing the account-deletion requirement.

create table if not exists public.payment_security (
  user_id uuid primary key references public.users(id) on delete cascade,
  password_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_security enable row level security;
revoke all on table public.payment_security from anon, authenticated;

create or replace function public.has_payment_password()
returns boolean
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.payment_security ps
      where ps.user_id = auth.uid()
    );
$$;

create or replace function public.set_payment_password(new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uid uuid := auth.uid();
  cleaned text := coalesce(new_password, '');
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if length(cleaned) < 6 or length(cleaned) > 128 then
    raise exception 'Payment password must be between 6 and 128 characters';
  end if;

  insert into public.payment_security (user_id, password_hash, failed_attempts, locked_until, updated_at)
  values (uid, extensions.crypt(cleaned, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (user_id) do update
    set password_hash = excluded.password_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();

  return true;
end;
$$;

create or replace function public.verify_payment_password(candidate text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uid uuid := auth.uid();
  row_data public.payment_security%rowtype;
  next_attempts integer;
begin
  if uid is null then
    return jsonb_build_object('valid', false, 'reason', 'AUTH_REQUIRED');
  end if;

  select *
  into row_data
  from public.payment_security
  where user_id = uid
  for update;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'NOT_CONFIGURED');
  end if;

  if row_data.locked_until is not null and row_data.locked_until > now() then
    return jsonb_build_object(
      'valid', false,
      'reason', 'LOCKED',
      'locked_until', row_data.locked_until
    );
  end if;

  if extensions.crypt(coalesce(candidate, ''), row_data.password_hash) = row_data.password_hash then
    update public.payment_security
    set failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where user_id = uid;

    return jsonb_build_object('valid', true, 'reason', 'OK', 'remaining_attempts', 5);
  end if;

  next_attempts := coalesce(row_data.failed_attempts, 0) + 1;

  if next_attempts >= 5 then
    update public.payment_security
    set failed_attempts = 5,
        locked_until = now() + interval '1 minute',
        updated_at = now()
    where user_id = uid;

    return jsonb_build_object(
      'valid', false,
      'reason', 'LOCKED',
      'remaining_attempts', 0,
      'locked_until', now() + interval '1 minute'
    );
  end if;

  update public.payment_security
  set failed_attempts = next_attempts,
      locked_until = null,
      updated_at = now()
  where user_id = uid;

  return jsonb_build_object(
    'valid', false,
    'reason', 'INCORRECT',
    'remaining_attempts', 5 - next_attempts
  );
end;
$$;

-- Deletes the signed-in user's product data transactionally. Authentication is
-- removed separately through the server-side Supabase Admin API after this RPC.
create or replace function public.purge_current_account_data()
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uid uuid := auth.uid();
  brand_id uuid;
  creator_id uuid;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select id into brand_id from public.brand_profiles where user_id = uid limit 1;
  select id into creator_id from public.creator_profiles where user_id = uid limit 1;

  -- Remove restrictive legacy offer/deal records first.
  delete from public.deal_analyses da
  where da.requested_by = uid
     or exists (
       select 1 from public.offers o
       where o.id = da.offer_id
         and (
           o.created_by = uid
           or (brand_id is not null and o.brand_profile_id = brand_id)
           or (creator_id is not null and o.creator_profile_id = creator_id)
         )
     );

  delete from public.offer_events oe
  where oe.actor_user_id = uid
     or exists (
       select 1 from public.offers o
       where o.id = oe.offer_id
         and (
           o.created_by = uid
           or (brand_id is not null and o.brand_profile_id = brand_id)
           or (creator_id is not null and o.creator_profile_id = creator_id)
         )
     );

  delete from public.offer_revisions orv
  where orv.changed_by = uid
     or exists (
       select 1 from public.offers o
       where o.id = orv.offer_id
         and (
           o.created_by = uid
           or (brand_id is not null and o.brand_profile_id = brand_id)
           or (creator_id is not null and o.creator_profile_id = creator_id)
         )
     );

  delete from public.offers o
  where o.created_by = uid
     or (brand_id is not null and o.brand_profile_id = brand_id)
     or (creator_id is not null and o.creator_profile_id = creator_id);

  delete from public.analysis_usage_ledger where user_id = uid;
  delete from public.billing_cancellation_requests where user_id = uid;
  delete from public.billing_checkout_attempts where user_id = uid;
  delete from public.delivery_outbox where user_id = uid;

  -- Cascades remove profiles, campaigns, conversations, messages,
  -- preferences, notifications, wallet-security data and other owned rows.
  delete from public.users where id = uid;

  return true;
end;
$$;

revoke all on function public.has_payment_password() from public, anon;
revoke all on function public.set_payment_password(text) from public, anon;
revoke all on function public.verify_payment_password(text) from public, anon;
revoke all on function public.purge_current_account_data() from public, anon;

grant execute on function public.has_payment_password() to authenticated;
grant execute on function public.set_payment_password(text) to authenticated;
grant execute on function public.verify_payment_password(text) to authenticated;
grant execute on function public.purge_current_account_data() to authenticated;
