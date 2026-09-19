-- Collab Deal OS: Remove Prototype Payment & Wallet System
-- Preserves all core user, profile, campaign, deal, offer, conversation, and message data.
-- Removes prototype payment tables and payment-password security.
-- Replaces payment-password account deletion with a clean, text-confirmed account deletion RPC.

-- 1. Drop prototype payment and wallet tables
drop table if exists public.prototype_withdrawal_requests cascade;
drop table if exists public.prototype_deal_events cascade;
drop table if exists public.payment_password_resets cascade;
drop table if exists public.payment_security cascade;

-- 2. Drop obsolete payment password functions
drop function if exists public.has_payment_password();
drop function if exists public.set_payment_password(text);
drop function if exists public.create_payment_password(text);
drop function if exists public.admin_reset_payment_password(uuid, text);
drop function if exists public.verify_payment_password(text);
drop function if exists public.delete_current_account_with_password(text);

-- 3. Update purge_current_account_data to clean only active non-payment tables
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

  -- Remove dependent offer/deal records first
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
  delete from public.delivery_outbox where user_id = uid;

  -- Cascades remove profiles, campaigns, conversations, messages, preferences, notifications.
  delete from public.users where id = uid;

  return true;
end;
$$;

revoke all on function public.purge_current_account_data() from public, anon, authenticated;

-- 4. Create clean, non-payment account deletion function
create or replace function public.delete_current_account(confirmation_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('deleted', false, 'reason', 'AUTH_REQUIRED');
  end if;

  if trim(coalesce(confirmation_text, '')) <> 'DELETE MY ACCOUNT' then
    return jsonb_build_object('deleted', false, 'reason', 'INVALID_CONFIRMATION');
  end if;

  perform public.purge_current_account_data();
  return jsonb_build_object('deleted', true, 'reason', 'OK');
end;
$$;

revoke all on function public.delete_current_account(text) from public, anon;
grant execute on function public.delete_current_account(text) to authenticated;
