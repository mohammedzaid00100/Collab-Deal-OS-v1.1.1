-- Phase 5: provider-verified Razorpay subscriptions, idempotent billing
-- commands, replay-safe webhooks, and effective-plan synchronization.

alter table public.subscriptions
  add column provider_plan_id text,
  add column provider_status text,
  add column last_provider_event_at timestamptz,
  add column last_provider_event_id text,
  add column last_reconciled_at timestamptz,
  add column cancel_requested_at timestamptz;

alter table public.payment_webhook_events
  add column provider_subscription_id text,
  add column api_verified boolean not null default false,
  add column provider_event_created_at timestamptz,
  add column retry_count integer not null default 0 check (retry_count >= 0),
  add constraint payment_webhook_processing_status_valid
    check (processing_status in ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'));

create index payment_webhook_subscription_idx
on public.payment_webhook_events (provider, provider_subscription_id, created_at desc);

create table public.billing_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  command_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  account_role public.account_type not null,
  requested_plan public.plan_tier not null check (requested_plan <> 'FREE'),
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_plan_id text not null,
  provider_subscription_id text unique,
  status text not null default 'RESERVED'
    check (status in ('RESERVED', 'CREATED', 'UNCERTAIN', 'FAILED', 'ACTIVATED', 'CANCELLED', 'EXPIRED')),
  provider_error_code text,
  checkout_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, command_id)
);

create unique index billing_checkout_one_open_per_user_idx
on public.billing_checkout_attempts (user_id)
where status in ('RESERVED', 'CREATED', 'UNCERTAIN');
create index billing_checkout_provider_subscription_idx
on public.billing_checkout_attempts (provider_subscription_id) where provider_subscription_id is not null;
create trigger billing_checkout_attempts_set_updated_at before update on public.billing_checkout_attempts
for each row execute function public.set_updated_at();
alter table public.billing_checkout_attempts enable row level security;
revoke all on public.billing_checkout_attempts from anon, authenticated;

create table public.billing_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  command_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  provider_subscription_id text not null,
  status text not null default 'RESERVED' check (status in ('RESERVED', 'SUBMITTED', 'UNCERTAIN', 'FAILED')),
  provider_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, command_id)
);

create unique index billing_cancellation_one_open_per_user_idx
on public.billing_cancellation_requests (user_id, provider_subscription_id)
where status in ('RESERVED', 'SUBMITTED', 'UNCERTAIN');
create trigger billing_cancellation_requests_set_updated_at before update on public.billing_cancellation_requests
for each row execute function public.set_updated_at();
alter table public.billing_cancellation_requests enable row level security;
revoke all on public.billing_cancellation_requests from anon, authenticated;

create or replace function public.sync_subscription_account_cache()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.users
  set plan = case when new.status in ('ACTIVE', 'TRIALING')
    and new.current_period_start <= now() and new.current_period_end > now()
    then new.plan else 'FREE'::public.plan_tier end
  where id = new.user_id;
  return new;
end;
$$;

drop trigger subscriptions_sync_account_cache on public.subscriptions;
create trigger subscriptions_sync_account_cache
after insert or update of plan, status, current_period_start, current_period_end on public.subscriptions
for each row execute function public.sync_subscription_account_cache();

-- Repair any cache written by the original plan-only trigger.
update public.users u
set plan = case when s.status in ('ACTIVE', 'TRIALING')
  and s.current_period_start <= now() and s.current_period_end > now()
  then s.plan else 'FREE'::public.plan_tier end
from public.subscriptions s where s.user_id = u.id;

create or replace view public.account_state with (security_invoker = true) as
select u.id, u.email, u.account_type,
  case when s.status in ('ACTIVE', 'TRIALING') and s.current_period_start <= now()
    and s.current_period_end > now() then s.plan else 'FREE'::public.plan_tier end as plan,
  coalesce(ul.free_evaluations_used + ul.paid_period_evaluations_used, 0) as evaluation_count,
  case when u.account_type = 'creator' then coalesce(cp.onboarding_complete, false)
    when u.account_type = 'brand' then coalesce(bp.onboarding_complete, false) else false end as onboarding_complete,
  case when u.account_type = 'creator' then cp.full_name
    when u.account_type = 'brand' then bp.brand_name else null end as display_name,
  ul.free_evaluations_total, ul.free_evaluations_used, s.status as subscription_status
from public.users u
left join public.creator_profiles cp on cp.user_id = u.id
left join public.brand_profiles bp on bp.user_id = u.id
left join public.usage_limits ul on ul.user_id = u.id
left join public.subscriptions s on s.user_id = u.id;

create or replace function public.reserve_billing_checkout(
  requester_user_id uuid,
  request_command_id uuid,
  billing_request_hash text,
  target_plan public.plan_tier,
  target_provider_plan_id text
)
returns table (
  attempt_id uuid,
  attempt_status text,
  reservation_created boolean,
  provider_subscription_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_role public.account_type;
  subscription_record public.subscriptions%rowtype;
  existing_attempt public.billing_checkout_attempts%rowtype;
  new_attempt_id uuid;
begin
  if requester_user_id is null or request_command_id is null then raise exception 'Billing identity is required'; end if;
  if billing_request_hash is null or billing_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid billing request hash'; end if;
  if target_plan is null or target_plan = 'FREE' then raise exception 'A paid plan is required'; end if;
  if target_provider_plan_id is null or target_provider_plan_id !~ '^plan_[A-Za-z0-9]{14,}$' then
    raise exception 'Invalid provider plan';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(81010, pg_catalog.hashtext(requester_user_id::text));
  select u.account_type into requester_role from public.users u where u.id = requester_user_id;
  if requester_role is null then raise exception 'Completed account role is required'; end if;
  if requester_role = 'creator' and not exists (
    select 1 from public.creator_profiles cp where cp.user_id = requester_user_id and cp.onboarding_complete
  ) then raise exception 'Completed creator profile is required'; end if;
  if requester_role = 'brand' and not exists (
    select 1 from public.brand_profiles bp where bp.user_id = requester_user_id and bp.onboarding_complete
  ) then raise exception 'Completed brand profile is required'; end if;

  select * into subscription_record from public.subscriptions s
  where s.user_id = requester_user_id for update;
  if not found then raise exception 'Subscription account is unavailable'; end if;

  select * into existing_attempt from public.billing_checkout_attempts bca
  where bca.user_id = requester_user_id and bca.command_id = request_command_id;
  if found then
    if existing_attempt.request_hash is distinct from billing_request_hash then
      raise exception 'Billing request ID was already used for different data';
    end if;
    return query select existing_attempt.id, existing_attempt.status, false,
      existing_attempt.provider_subscription_id;
    return;
  end if;

  if subscription_record.status in ('ACTIVE', 'TRIALING', 'PAST_DUE')
    or (subscription_record.provider_subscription_id is not null and coalesce(subscription_record.provider_status, 'unknown')
      not in ('cancelled', 'completed', 'expired')) then
    raise exception 'An active subscription already exists';
  end if;
  if exists (
    select 1 from public.billing_checkout_attempts bca
    where bca.user_id = requester_user_id and bca.status in ('RESERVED', 'CREATED', 'UNCERTAIN')
  ) then raise exception 'A subscription checkout is already pending'; end if;
  if not exists (select 1 from public.plan_entitlements pe where pe.plan = target_plan
    and pe.ai_enabled and pe.ai_evaluations_per_period is not null) then
    raise exception 'Paid AI evaluation limit is not configured';
  end if;
  if (
    select count(*) from public.billing_checkout_attempts bca
    where bca.user_id = requester_user_id and bca.created_at > now() - interval '1 hour'
  ) >= 5 then raise exception 'Billing checkout rate limit reached'; end if;

  insert into public.billing_checkout_attempts (
    user_id, command_id, request_hash, account_role, requested_plan, provider_plan_id
  ) values (
    requester_user_id, request_command_id, billing_request_hash, requester_role, target_plan, target_provider_plan_id
  ) returning id into new_attempt_id;
  return query select new_attempt_id, 'RESERVED'::text, true, null::text;
end;
$$;

create or replace function public.complete_billing_checkout(
  target_attempt_id uuid,
  target_provider_subscription_id text,
  provider_checkout_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_record public.billing_checkout_attempts%rowtype;
begin
  if target_provider_subscription_id is null or target_provider_subscription_id !~ '^sub_[A-Za-z0-9]{14,}$' then
    raise exception 'Invalid provider subscription';
  end if;
  select * into attempt_record from public.billing_checkout_attempts bca where bca.id = target_attempt_id;
  perform pg_catalog.pg_advisory_xact_lock(81010, pg_catalog.hashtext(attempt_record.user_id::text));
  select * into attempt_record from public.billing_checkout_attempts bca where bca.id = target_attempt_id for update;
  if not found then raise exception 'Billing checkout attempt was not found'; end if;
  if attempt_record.status in ('CREATED', 'ACTIVATED', 'CANCELLED', 'EXPIRED') then
    if attempt_record.provider_subscription_id is distinct from target_provider_subscription_id then
      raise exception 'Provider subscription mismatch';
    end if;
    return;
  end if;
  if attempt_record.status <> 'RESERVED' then raise exception 'Billing checkout is not reservable'; end if;

  update public.billing_checkout_attempts set status = 'CREATED',
    provider_subscription_id = target_provider_subscription_id,
    checkout_expires_at = provider_checkout_expires_at
  where id = target_attempt_id;
  update public.subscriptions set provider = 'razorpay', plan = attempt_record.requested_plan,
    status = 'INACTIVE', provider_plan_id = attempt_record.provider_plan_id,
    provider_subscription_id = target_provider_subscription_id, provider_status = 'created',
    provider_customer_id = null, current_period_start = null, current_period_end = null,
    cancel_at_period_end = false, cancel_requested_at = null,
    last_provider_event_at = null, last_provider_event_id = null
  where user_id = attempt_record.user_id;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (attempt_record.user_id, 'SUBSCRIPTION_CHECKOUT_CREATED', 'subscription', target_attempt_id,
    jsonb_build_object('plan', attempt_record.requested_plan, 'provider', 'razorpay'));
end;
$$;

create or replace function public.mark_billing_checkout_failure(
  target_attempt_id uuid,
  failure_code text,
  outcome_uncertain boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_checkout_attempts
  set status = case when coalesce(outcome_uncertain, false) then 'UNCERTAIN' else 'FAILED' end,
      provider_error_code = left(coalesce(nullif(trim(failure_code), ''), 'PROVIDER_ERROR'), 80)
  where id = target_attempt_id and status = 'RESERVED';
end;
$$;

create or replace function public.reserve_subscription_cancellation(
  requester_user_id uuid,
  request_command_id uuid,
  cancellation_request_hash text
)
returns table (
  cancellation_id uuid,
  cancellation_status text,
  reservation_created boolean,
  provider_subscription_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_record public.subscriptions%rowtype;
  existing_request public.billing_cancellation_requests%rowtype;
  new_request_id uuid;
begin
  if requester_user_id is null or request_command_id is null then raise exception 'Cancellation identity is required'; end if;
  if cancellation_request_hash is null or cancellation_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid cancellation request hash';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(81010, pg_catalog.hashtext(requester_user_id::text));
  select * into subscription_record from public.subscriptions s
  where s.user_id = requester_user_id for update;
  if not found or subscription_record.provider <> 'razorpay'
     or subscription_record.provider_subscription_id is null then
    raise exception 'No Razorpay subscription is available';
  end if;
  select * into existing_request from public.billing_cancellation_requests bcr
  where bcr.user_id = requester_user_id and bcr.command_id = request_command_id;
  if found then
    if existing_request.request_hash is distinct from cancellation_request_hash then
      raise exception 'Cancellation request ID was already used for different data';
    end if;
    return query select existing_request.id, existing_request.status, false,
      existing_request.provider_subscription_id;
    return;
  end if;
  if subscription_record.status not in ('ACTIVE', 'TRIALING') then raise exception 'Subscription is not cancellable'; end if;
  if subscription_record.cancel_at_period_end then raise exception 'Cancellation is already scheduled'; end if;
  if exists (
    select 1 from public.billing_cancellation_requests bcr
    where bcr.user_id = requester_user_id and bcr.provider_subscription_id = subscription_record.provider_subscription_id
      and bcr.status in ('RESERVED', 'SUBMITTED', 'UNCERTAIN')
  ) then raise exception 'A cancellation request is already pending'; end if;
  insert into public.billing_cancellation_requests (
    user_id, command_id, request_hash, provider_subscription_id
  ) values (
    requester_user_id, request_command_id, cancellation_request_hash,
    subscription_record.provider_subscription_id
  ) returning id into new_request_id;
  return query select new_request_id, 'RESERVED'::text, true, subscription_record.provider_subscription_id;
end;
$$;

create or replace function public.complete_subscription_cancellation(target_cancellation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancellation_record public.billing_cancellation_requests%rowtype;
begin
  select * into cancellation_record from public.billing_cancellation_requests bcr
  where bcr.id = target_cancellation_id;
  perform pg_catalog.pg_advisory_xact_lock(81010, pg_catalog.hashtext(cancellation_record.user_id::text));
  select * into cancellation_record from public.billing_cancellation_requests bcr
  where bcr.id = target_cancellation_id for update;
  if not found then raise exception 'Cancellation request was not found'; end if;
  if cancellation_record.status = 'SUBMITTED' then return; end if;
  if cancellation_record.status <> 'RESERVED' then raise exception 'Cancellation request is not reservable'; end if;
  update public.billing_cancellation_requests set status = 'SUBMITTED'
  where id = target_cancellation_id;
    update public.subscriptions set cancel_at_period_end = true, cancel_requested_at = now()
    where user_id = cancellation_record.user_id
      and provider = 'razorpay'
      and status not in ('CANCELLED', 'EXPIRED')
      and provider_subscription_id = cancellation_record.provider_subscription_id;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (cancellation_record.user_id, 'SUBSCRIPTION_CANCELLATION_REQUESTED', 'subscription', target_cancellation_id,
    jsonb_build_object('at_period_end', true, 'provider', 'razorpay'));
end;
$$;

create or replace function public.mark_subscription_cancellation_failure(
  target_cancellation_id uuid,
  failure_code text,
  outcome_uncertain boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_cancellation_requests
  set status = case when coalesce(outcome_uncertain, false) then 'UNCERTAIN' else 'FAILED' end,
      provider_error_code = left(coalesce(nullif(trim(failure_code), ''), 'PROVIDER_ERROR'), 80)
  where id = target_cancellation_id and status = 'RESERVED';
end;
$$;

create or replace function public.record_razorpay_webhook_event(
  target_event_id text,
  target_event_type text,
  target_payload_hash text,
  target_subscription_id text,
  target_event_created_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.payment_webhook_events%rowtype;
  inserted_id uuid;
begin
  if target_event_id is null or char_length(target_event_id) not between 1 and 200 then
    raise exception 'Invalid provider event ID';
  end if;
  if target_event_type is null or char_length(target_event_type) not between 1 and 120 then
    raise exception 'Invalid provider event type';
  end if;
  if target_payload_hash is null or target_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid webhook payload hash';
  end if;
  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, signature_verified, payload_hash,
    provider_subscription_id, provider_event_created_at
  ) values (
    'razorpay', target_event_id, target_event_type, true, target_payload_hash,
    nullif(target_subscription_id, ''), target_event_created_at
  ) on conflict (provider, provider_event_id) do nothing returning id into inserted_id;
  if inserted_id is not null then return true; end if;

  select * into event_record from public.payment_webhook_events pwe
  where pwe.provider = 'razorpay' and pwe.provider_event_id = target_event_id for update;
  if event_record.payload_hash is distinct from target_payload_hash
     or event_record.event_type is distinct from target_event_type then
    raise exception 'Provider event collision';
  end if;
  if event_record.processing_status in ('PROCESSED', 'IGNORED') then return false; end if;
  update public.payment_webhook_events set processing_status = 'RECEIVED', error_code = null,
    retry_count = retry_count + 1 where id = event_record.id;
  return true;
end;
$$;

create or replace function public.ignore_razorpay_webhook_event(target_event_id text, ignore_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_webhook_events set processing_status = 'IGNORED',
    processed_at = now(), error_code = left(coalesce(nullif(trim(ignore_code), ''), 'IGNORED'), 80)
  where provider = 'razorpay' and provider_event_id = target_event_id
    and processing_status not in ('PROCESSED', 'IGNORED');
end;
$$;

create or replace function public.fail_razorpay_webhook_event(target_event_id text, failure_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_webhook_events set processing_status = 'FAILED',
    error_code = left(coalesce(nullif(trim(failure_code), ''), 'PROCESSING_FAILED'), 80)
  where provider = 'razorpay' and provider_event_id = target_event_id
    and processing_status not in ('PROCESSED', 'IGNORED');
end;
$$;

create or replace function public.apply_razorpay_subscription_snapshot(
  target_event_id text,
  target_event_type text,
  target_subscription_id text,
  target_checkout_attempt_id uuid,
  target_provider_plan_id text,
  target_provider_status text,
  target_customer_id text,
  target_period_start timestamptz,
  target_period_end timestamptz,
  target_cancel_at_period_end boolean,
  target_event_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.payment_webhook_events%rowtype;
  attempt_record public.billing_checkout_attempts%rowtype;
  subscription_record public.subscriptions%rowtype;
  mapped_status public.subscription_status;
  account_role public.account_type;
  linked_user_id uuid;
begin
  if target_subscription_id is null or target_subscription_id !~ '^sub_[A-Za-z0-9]{14,}$' then
    raise exception 'Invalid provider subscription';
  end if;
  if target_provider_plan_id is null or target_provider_plan_id !~ '^plan_[A-Za-z0-9]{14,}$' then
    raise exception 'Invalid provider plan';
  end if;
  if target_provider_status is null or target_provider_status not in (
    'created', 'authenticated', 'active', 'pending', 'halted', 'paused',
    'resumed', 'cancelled', 'completed', 'expired'
  ) then raise exception 'Unsupported provider subscription status'; end if;

  select bca.user_id into linked_user_id from public.billing_checkout_attempts bca
  where bca.id = target_checkout_attempt_id or bca.provider_subscription_id = target_subscription_id limit 1;
  if linked_user_id is null then raise exception 'Provider subscription is not linked to an account'; end if;
  perform pg_catalog.pg_advisory_xact_lock(81010, pg_catalog.hashtext(linked_user_id::text));
  select u.account_type into account_role from public.users u where u.id = linked_user_id;
  select * into subscription_record from public.subscriptions s where s.user_id = linked_user_id for update;

  if subscription_record.provider_subscription_id is not null
     and subscription_record.provider_subscription_id <> target_subscription_id then
    perform public.ignore_razorpay_webhook_event(target_event_id, 'SUPERSEDED_SUBSCRIPTION');
    return subscription_record.id;
  end if;

  if subscription_record.provider_subscription_id = target_subscription_id and (
    (subscription_record.last_provider_event_at is not null and target_event_created_at < subscription_record.last_provider_event_at)
    or (subscription_record.provider_status in ('cancelled', 'completed', 'expired')
      and target_provider_status not in ('cancelled', 'completed', 'expired'))
  ) then
    perform public.ignore_razorpay_webhook_event(target_event_id, 'STALE_EVENT');
    return subscription_record.id;
  end if;

  select * into event_record from public.payment_webhook_events pwe
  where pwe.provider = 'razorpay' and pwe.provider_event_id = target_event_id for update;
  if not found or not (event_record.signature_verified or event_record.api_verified) then raise exception 'Verified provider event is required'; end if;
  if event_record.processing_status in ('PROCESSED', 'IGNORED') then
    select s.id into subscription_record.id from public.subscriptions s
    where s.provider = 'razorpay' and s.provider_subscription_id = target_subscription_id;
    return subscription_record.id;
  end if;
  if event_record.event_type is distinct from target_event_type
     or event_record.provider_subscription_id is distinct from target_subscription_id then
    raise exception 'Webhook event metadata mismatch';
  end if;

  if target_checkout_attempt_id is not null then
    select * into attempt_record from public.billing_checkout_attempts bca
    where bca.id = target_checkout_attempt_id for update;
    if found then
      if attempt_record.provider_plan_id is distinct from target_provider_plan_id then
        raise exception 'Checkout plan does not match provider snapshot';
      end if;
      if attempt_record.provider_subscription_id is not null
         and attempt_record.provider_subscription_id is distinct from target_subscription_id then
        raise exception 'Checkout subscription does not match provider snapshot';
      end if;
      update public.billing_checkout_attempts set provider_subscription_id = target_subscription_id,
        status = case target_provider_status
          when 'active' then 'ACTIVATED'
          when 'resumed' then 'ACTIVATED'
          when 'pending' then 'ACTIVATED'
          when 'halted' then 'ACTIVATED'
          when 'paused' then 'ACTIVATED'
          when 'cancelled' then 'CANCELLED'
          when 'completed' then 'EXPIRED'
          when 'expired' then 'EXPIRED'
          else 'CREATED' end,
        provider_error_code = null
      where id = attempt_record.id;
      update public.subscriptions set provider = 'razorpay', plan = attempt_record.requested_plan,
        provider_plan_id = attempt_record.provider_plan_id,
        provider_subscription_id = target_subscription_id
      where user_id = attempt_record.user_id
        and (provider_subscription_id is null or provider_subscription_id = target_subscription_id);
    end if;
  end if;

  select * into subscription_record from public.subscriptions s
  where s.provider = 'razorpay' and s.provider_subscription_id = target_subscription_id for update;
  if not found then raise exception 'Provider subscription is not linked to an account'; end if;
  if subscription_record.provider_plan_id is distinct from target_provider_plan_id then
    raise exception 'Provider plan does not match the linked subscription';
  end if;

  mapped_status := case target_provider_status
    when 'active' then 'ACTIVE'::public.subscription_status
    when 'resumed' then 'ACTIVE'::public.subscription_status
    when 'pending' then 'PAST_DUE'::public.subscription_status
    when 'halted' then 'PAST_DUE'::public.subscription_status
    when 'paused' then 'PAST_DUE'::public.subscription_status
    when 'cancelled' then 'CANCELLED'::public.subscription_status
    when 'completed' then 'EXPIRED'::public.subscription_status
    when 'expired' then 'EXPIRED'::public.subscription_status
    else 'INACTIVE'::public.subscription_status end;
  if mapped_status = 'ACTIVE' and (
    target_period_start is null or target_period_end is null
    or target_period_end <= target_period_start
  ) then raise exception 'Active subscription period is invalid'; end if;

  update public.subscriptions set status = mapped_status,
    provider_status = target_provider_status,
    provider_customer_id = coalesce(nullif(target_customer_id, ''), provider_customer_id),
    current_period_start = target_period_start,
    current_period_end = target_period_end,
    cancel_at_period_end = case when mapped_status in ('CANCELLED', 'EXPIRED') then false
      else cancel_at_period_end or coalesce(target_cancel_at_period_end, false) end,
    last_provider_event_at = coalesce(target_event_created_at, now()),
    last_provider_event_id = target_event_id
  where id = subscription_record.id;

  if mapped_status = 'ACTIVE' and subscription_record.status <> 'ACTIVE' then
    insert into public.notifications (user_id, type, title, body, action_url)
    values (subscription_record.user_id, 'SUBSCRIPTION_ACTIVATED', 'Subscription activated',
      'Your paid plan is active after provider verification.',
      '/' || account_role::text || '/subscription');
  elsif mapped_status = 'PAST_DUE' and subscription_record.status <> 'PAST_DUE' then
    insert into public.notifications (user_id, type, title, body, action_url)
    values (subscription_record.user_id, 'PAYMENT_FAILED', 'Subscription payment failed',
      'Your paid AI access is paused. Review your payment method with Razorpay.', null);
  elsif mapped_status = 'CANCELLED' and subscription_record.status <> 'CANCELLED' then
    insert into public.notifications (user_id, type, title, body, action_url)
    values (subscription_record.user_id, 'ACCOUNT_ALERT', 'Subscription cancelled',
      'Your subscription has been cancelled and paid access is no longer active.', null);
  end if;
  if target_event_type = 'subscription.charged' then
    insert into public.notifications (user_id, type, title, body, action_url)
    values (subscription_record.user_id, 'ACCOUNT_ALERT', 'Subscription payment received',
      'Razorpay confirmed your subscription charge.', null);
  end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (subscription_record.user_id, 'SUBSCRIPTION_WEBHOOK_APPLIED', 'subscription', subscription_record.id,
    jsonb_build_object('provider_event_id', target_event_id, 'provider_event_type', target_event_type,
      'provider_status', target_provider_status, 'subscription_status', mapped_status,
      'previous_status', subscription_record.status, 'plan', subscription_record.plan));
  update public.payment_webhook_events set processing_status = 'PROCESSED', processed_at = now(), error_code = null
  where id = event_record.id;
  return subscription_record.id;
end;
$$;

-- Only the maintenance server calls this after an authenticated provider GET.
-- Keep API verification distinct from webhook signature verification in audit data.
create or replace function public.record_razorpay_reconciliation(
  target_event_id text, target_payload_hash text, target_subscription_id text, observed_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_event_id is null or target_event_id not like 'reconcile:%'
    or observed_at is null or observed_at > now() + interval '1 minute' then raise exception 'Invalid reconciliation identity'; end if;
  perform public.record_razorpay_webhook_event(target_event_id, 'subscription.reconciled', target_payload_hash, target_subscription_id, observed_at);
  update public.payment_webhook_events set signature_verified = false, api_verified = true
  where provider = 'razorpay' and provider_event_id = target_event_id and processing_status = 'RECEIVED';
  update public.subscriptions set last_reconciled_at = now()
  where provider = 'razorpay' and provider_subscription_id = target_subscription_id;
end;
$$;
revoke all on function public.record_razorpay_reconciliation(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_razorpay_reconciliation(text, text, text, timestamptz) to service_role;

revoke all on function public.reserve_billing_checkout(uuid, uuid, text, public.plan_tier, text) from public, anon, authenticated;
revoke all on function public.complete_billing_checkout(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_billing_checkout_failure(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.reserve_subscription_cancellation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_subscription_cancellation(uuid) from public, anon, authenticated;
revoke all on function public.mark_subscription_cancellation_failure(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.record_razorpay_webhook_event(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.ignore_razorpay_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.fail_razorpay_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.apply_razorpay_subscription_snapshot(text, text, text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz) from public, anon, authenticated;

grant execute on function public.reserve_billing_checkout(uuid, uuid, text, public.plan_tier, text) to service_role;
grant execute on function public.complete_billing_checkout(uuid, text, timestamptz) to service_role;
grant execute on function public.mark_billing_checkout_failure(uuid, text, boolean) to service_role;
grant execute on function public.reserve_subscription_cancellation(uuid, uuid, text) to service_role;
grant execute on function public.complete_subscription_cancellation(uuid) to service_role;
grant execute on function public.mark_subscription_cancellation_failure(uuid, text, boolean) to service_role;
grant execute on function public.record_razorpay_webhook_event(text, text, text, text, timestamptz) to service_role;
grant execute on function public.ignore_razorpay_webhook_event(text, text) to service_role;
grant execute on function public.fail_razorpay_webhook_event(text, text) to service_role;
grant execute on function public.apply_razorpay_subscription_snapshot(text, text, text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz) to service_role;
