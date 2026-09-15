-- Phase 4: deterministic pricing snapshots, server-only AI reservations,
-- lifetime free usage, configurable paid entitlements, and failure-safe quota.

-- Terminal analyses are immutable, so retaining the analyzed offer is safer
-- than an ON DELETE SET NULL action that the immutability trigger would reject.
alter table public.deal_analyses drop constraint if exists deal_analyses_offer_id_fkey;
alter table public.deal_analyses
  add constraint deal_analyses_offer_id_fkey foreign key (offer_id)
  references public.offers(id) on delete restrict;

create table public.plan_entitlements (
  plan public.plan_tier primary key,
  ai_enabled boolean not null default true,
  ai_evaluations_per_period integer check (ai_evaluations_per_period is null or ai_evaluations_per_period > 0),
  hourly_ai_request_limit integer not null default 10 check (hourly_ai_request_limit between 1 and 1000),
  features jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.plan_entitlements (plan, ai_enabled, ai_evaluations_per_period, hourly_ai_request_limit, features)
values
  ('FREE', true, null, 10, '{"lifetime_free_evaluations":5}'::jsonb),
  ('PRO', true, null, 20, '{"paid_limit_status":"REQUIRES_CONFIGURATION"}'::jsonb),
  ('PREMIUM', true, null, 40, '{"paid_limit_status":"REQUIRES_CONFIGURATION"}'::jsonb)
on conflict (plan) do nothing;

create trigger plan_entitlements_set_updated_at before update on public.plan_entitlements
for each row execute function public.set_updated_at();
alter table public.plan_entitlements enable row level security;
create policy plan_entitlements_read on public.plan_entitlements for select to authenticated using (true);
revoke all on public.plan_entitlements from anon, authenticated;
grant select on public.plan_entitlements to authenticated;

create unique index pricing_benchmarks_active_selector_idx
on public.pricing_benchmarks (
  coalesce(lower(niche), ''), coalesce(lower(platform), ''), coalesce(lower(region), ''),
  currency, engine_version
)
where is_active;

alter table public.deal_analyses
  add column request_command_id uuid not null default gen_random_uuid(),
  add column request_hash text,
  add column analysis_input_version text not null default 'legacy-v0',
  add column benchmark_refs uuid[] not null default '{}'::uuid[],
  add column benchmark_config_hash text,
  add column risk_flags text[] not null default '{}'::text[],
  add column usage_bucket text check (usage_bucket in ('FREE', 'PAID')),
  add column usage_consumed boolean not null default false,
  add column usage_period_start timestamptz,
  add column usage_period_end timestamptz;

alter table public.deal_analyses disable trigger deal_analyses_immutable;
update public.deal_analyses set status = 'FAILED', provider_error_code = 'MIGRATION_UNMETERED_PENDING',
  completed_at = now() where status = 'PENDING';
update public.deal_analyses
set request_hash = public.sha256_text(request_command_id::text),
    benchmark_config_hash = public.sha256_text(pricing_engine_version);
alter table public.deal_analyses enable trigger deal_analyses_immutable;
alter table public.deal_analyses alter column analysis_input_version set default 'analysis-input-v1';
alter table public.deal_analyses
  alter column request_hash set not null,
  alter column benchmark_config_hash set not null,
  add constraint analysis_request_hash_valid check (request_hash ~ '^[0-9a-f]{64}$'),
  add constraint analysis_benchmark_hash_valid check (benchmark_config_hash ~ '^[0-9a-f]{64}$'),
  add constraint analysis_usage_state_valid check (
    ((usage_consumed and usage_bucket is not null) or (not usage_consumed))
    and (usage_bucket is distinct from 'PAID' or (usage_period_start is not null and usage_period_end is not null))
    and (usage_bucket is distinct from 'FREE' or (usage_period_start is null and usage_period_end is null))
  ),
  add constraint analysis_usage_period_valid check (
    (usage_period_start is null and usage_period_end is null)
    or (usage_period_start is not null and usage_period_end is not null and usage_period_end > usage_period_start)
  );

create unique index deal_analyses_request_command_idx
on public.deal_analyses (requested_by, request_command_id);

create table public.analysis_usage_ledger (
  id bigint generated always as identity primary key,
  analysis_id uuid not null references public.deal_analyses(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  event_type text not null check (event_type in ('RESERVED', 'COMMITTED', 'RELEASED')),
  usage_bucket text not null check (usage_bucket in ('FREE', 'PAID')),
  amount smallint not null default 1 check (amount = 1),
  reason_code text,
  created_at timestamptz not null default now(),
  unique (analysis_id, event_type)
);

create index analysis_usage_ledger_user_created_idx
on public.analysis_usage_ledger (user_id, created_at desc);
create trigger analysis_usage_ledger_immutable before update or delete on public.analysis_usage_ledger
for each row execute function public.prevent_immutable_record_change();
alter table public.analysis_usage_ledger enable row level security;
create policy analysis_usage_ledger_select_self on public.analysis_usage_ledger for select to authenticated
using (user_id = auth.uid());
revoke all on public.analysis_usage_ledger from anon, authenticated;
grant select on public.analysis_usage_ledger to authenticated;

create or replace function public.reserve_deal_analysis(
  requester_user_id uuid,
  analysis_request_id uuid,
  analysis_request_hash text,
  target_offer_id uuid,
  target_offer_version integer,
  analysis_input_snapshot jsonb,
  deterministic_result jsonb,
  selected_benchmark_refs uuid[]
)
returns table (
  analysis_id uuid,
  analysis_status public.analysis_status,
  reservation_created boolean,
  evaluations_remaining integer,
  reserved_bucket text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_role public.account_type;
  usage_record public.usage_limits%rowtype;
  subscription_record public.subscriptions%rowtype;
  entitlement_record public.plan_entitlements%rowtype;
  existing_record public.deal_analyses%rowtype;
  selected_bucket text;
  remaining_count integer;
  new_analysis_id uuid;
  fair_low_value bigint;
  fair_mid_value bigint;
  fair_high_value bigint;
  deal_score_value numeric;
  confidence_value numeric;
  counter_value bigint;
  engine_version_value text;
  benchmark_hash_value text;
  deterministic_verdict_value text;
  risk_values text[];
  hourly_limit integer;
begin
  if requester_user_id is null or analysis_request_id is null then raise exception 'Analysis identity is required'; end if;
  if analysis_request_hash is null or analysis_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid analysis request hash'; end if;
  if jsonb_typeof(analysis_input_snapshot) <> 'object'
     or jsonb_typeof(analysis_input_snapshot -> 'creator') is distinct from 'object'
     or jsonb_typeof(deterministic_result) <> 'object'
     or pg_column_size(analysis_input_snapshot) > 200000 or pg_column_size(deterministic_result) > 200000 then
    raise exception 'Invalid analysis snapshot';
  end if;
  if cardinality(coalesce(selected_benchmark_refs, '{}'::uuid[])) > 16
     or array_position(selected_benchmark_refs, null) is not null then
    raise exception 'Invalid benchmark references';
  end if;
  select u.account_type into requester_role from public.users u where u.id = requester_user_id;
  if requester_role is null then raise exception 'Completed account role is required'; end if;
  if requester_role = 'creator' and not exists (
    select 1 from public.creator_profiles cp where cp.user_id = requester_user_id and cp.onboarding_complete
  ) then raise exception 'Completed creator profile is required'; end if;
  if requester_role = 'brand' and not exists (
    select 1 from public.brand_profiles bp where bp.user_id = requester_user_id and bp.onboarding_complete
  ) then raise exception 'Completed brand profile is required'; end if;

  if target_offer_id is null and target_offer_version is not null then raise exception 'Offer version requires an offer'; end if;
  if target_offer_id is not null then
    if target_offer_version is null then raise exception 'Offer version is required'; end if;
    perform 1 from public.offers o
    join public.brand_profiles bp on bp.id = o.brand_profile_id
    join public.creator_profiles cp on cp.id = o.creator_profile_id
    where o.id = target_offer_id and o.version = target_offer_version
      and (bp.user_id = requester_user_id or (cp.user_id = requester_user_id and o.status <> 'DRAFT' and o.sent_at is not null));
    if not found then raise exception 'Offer is stale, unavailable, or not authorized'; end if;
  end if;

  select * into subscription_record from public.subscriptions s where s.user_id = requester_user_id for share;
  select * into usage_record from public.usage_limits ul where ul.user_id = requester_user_id for update;
  if not found then raise exception 'Usage account is unavailable'; end if;

  select * into existing_record from public.deal_analyses da
  where da.requested_by = requester_user_id and da.request_command_id = analysis_request_id;
  if found then
    if existing_record.request_hash is distinct from analysis_request_hash then
      raise exception 'Analysis request ID was already used for different data';
    end if;
    if existing_record.usage_bucket = 'FREE' then
      remaining_count := greatest(usage_record.free_evaluations_total - usage_record.free_evaluations_used, 0);
    else
      select * into entitlement_record from public.plan_entitlements pe where pe.plan = subscription_record.plan;
      remaining_count := case when entitlement_record.ai_evaluations_per_period is null then 0
        else greatest(entitlement_record.ai_evaluations_per_period - usage_record.paid_period_evaluations_used, 0) end;
    end if;
    return query select existing_record.id, existing_record.status, false, remaining_count, existing_record.usage_bucket;
    return;
  end if;

  select * into entitlement_record from public.plan_entitlements pe
  where pe.plan = case when subscription_record.status in ('ACTIVE', 'TRIALING') then subscription_record.plan else 'FREE'::public.plan_tier end;
  if not found or not entitlement_record.ai_enabled then raise exception 'AI evaluations are not enabled for this plan'; end if;
  hourly_limit := entitlement_record.hourly_ai_request_limit;
  if (
    select count(*) from public.deal_analyses da
    where da.requested_by = requester_user_id and da.created_at > now() - interval '1 hour'
  ) >= hourly_limit then raise exception 'AI evaluation rate limit reached. Try again later'; end if;

  if usage_record.free_evaluations_used < usage_record.free_evaluations_total then
    selected_bucket := 'FREE';
    update public.usage_limits set free_evaluations_used = free_evaluations_used + 1
    where user_id = requester_user_id returning * into usage_record;
    remaining_count := usage_record.free_evaluations_total - usage_record.free_evaluations_used;
  elsif subscription_record.status in ('ACTIVE', 'TRIALING') and subscription_record.plan <> 'FREE' then
    if entitlement_record.ai_evaluations_per_period is null then raise exception 'Paid AI evaluation limit is not configured'; end if;
    if subscription_record.current_period_start is null or subscription_record.current_period_end is null
       or subscription_record.current_period_start > now()
       or subscription_record.current_period_end <= now()
       or subscription_record.current_period_end <= subscription_record.current_period_start
    then raise exception 'Paid subscription period is invalid'; end if;
    if usage_record.period_started_at is distinct from subscription_record.current_period_start
       or usage_record.period_ends_at is distinct from subscription_record.current_period_end then
      update public.usage_limits set paid_period_evaluations_used = 0,
        period_started_at = subscription_record.current_period_start,
        period_ends_at = subscription_record.current_period_end
      where user_id = requester_user_id returning * into usage_record;
    end if;
    if usage_record.paid_period_evaluations_used >= entitlement_record.ai_evaluations_per_period then
      raise exception 'AI evaluation limit reached';
    end if;
    selected_bucket := 'PAID';
    update public.usage_limits set paid_period_evaluations_used = paid_period_evaluations_used + 1
    where user_id = requester_user_id returning * into usage_record;
    remaining_count := entitlement_record.ai_evaluations_per_period - usage_record.paid_period_evaluations_used;
  else
    raise exception 'Free AI evaluation limit reached';
  end if;

  fair_low_value := (deterministic_result ->> 'fairLow')::bigint;
  fair_mid_value := (deterministic_result ->> 'fairMid')::bigint;
  fair_high_value := (deterministic_result ->> 'fairHigh')::bigint;
  deal_score_value := (deterministic_result ->> 'dealScore')::numeric;
  confidence_value := (deterministic_result ->> 'confidenceScore')::numeric;
  counter_value := (deterministic_result ->> 'recommendedCounter')::bigint;
  engine_version_value := deterministic_result ->> 'pricingEngineVersion';
  benchmark_hash_value := deterministic_result ->> 'benchmarkConfigHash';
  deterministic_verdict_value := deterministic_result ->> 'verdict';
  if fair_low_value is null or fair_mid_value is null or fair_high_value is null
     or fair_low_value < 0 or fair_low_value > fair_mid_value or fair_mid_value > fair_high_value
     or fair_high_value > 1000000000 or deal_score_value is null or deal_score_value not between 0 and 100
     or confidence_value is null or confidence_value not between 0 and 100
     or counter_value is null or counter_value not between 0 and 1000000000
     or engine_version_value is null or char_length(engine_version_value) not between 1 and 120
     or benchmark_hash_value is null or benchmark_hash_value !~ '^[0-9a-f]{64}$'
     or deterministic_verdict_value is null or deterministic_verdict_value not in ('BELOW_FAIR', 'FAIR', 'ABOVE_FAIR') then
    raise exception 'Invalid deterministic pricing result';
  end if;
  if jsonb_typeof(coalesce(deterministic_result -> 'riskFlags', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid pricing risk flags';
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into risk_values
  from jsonb_array_elements_text(coalesce(deterministic_result -> 'riskFlags', '[]'::jsonb));

  insert into public.deal_analyses (
    requested_by, offer_id, offer_version, status, account_perspective,
    offer_snapshot, creator_metrics_snapshot, pricing_inputs_snapshot,
    fair_low, fair_mid, fair_high, deal_score, confidence_score,
    pricing_engine_version, recommended_counter, request_command_id,
    request_hash, benchmark_refs, benchmark_config_hash, risk_flags,
    usage_bucket, usage_consumed, usage_period_start, usage_period_end
  ) values (
    requester_user_id, target_offer_id, target_offer_version, 'PENDING', requester_role,
    analysis_input_snapshot, analysis_input_snapshot -> 'creator', deterministic_result,
    fair_low_value, fair_mid_value, fair_high_value, deal_score_value, confidence_value,
    engine_version_value, counter_value, analysis_request_id,
    analysis_request_hash, coalesce(selected_benchmark_refs, '{}'::uuid[]), benchmark_hash_value, risk_values,
    selected_bucket, true,
    case when selected_bucket = 'PAID' then subscription_record.current_period_start else null end,
    case when selected_bucket = 'PAID' then subscription_record.current_period_end else null end
  ) returning id into new_analysis_id;

  insert into public.analysis_usage_ledger (analysis_id, user_id, event_type, usage_bucket)
  values (new_analysis_id, requester_user_id, 'RESERVED', selected_bucket);
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (requester_user_id, 'AI_EVALUATION_RESERVED', 'deal_analysis', new_analysis_id,
    jsonb_build_object('usage_bucket', selected_bucket, 'remaining', remaining_count));
  return query select new_analysis_id, 'PENDING'::public.analysis_status, true, remaining_count, selected_bucket;
end;
$$;

create or replace function public.complete_deal_analysis(
  target_analysis_id uuid,
  provider_model text,
  verdict_data jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_record public.deal_analyses%rowtype;
  deterministic_verdict text;
  returned_verdict text;
begin
  if provider_model is null or char_length(provider_model) not between 1 and 120
     or jsonb_typeof(verdict_data) <> 'object' then raise exception 'Invalid AI result'; end if;
  select * into analysis_record from public.deal_analyses da
  where da.id = target_analysis_id for update;
  if not found then raise exception 'Analysis not found'; end if;
  if analysis_record.status = 'COMPLETED' then return; end if;
  if analysis_record.status <> 'PENDING' then raise exception 'Analysis is no longer pending'; end if;
  perform 1 from public.usage_limits ul where ul.user_id = analysis_record.requested_by for update;
  deterministic_verdict := analysis_record.pricing_inputs_snapshot ->> 'verdict';
  returned_verdict := verdict_data ->> 'verdict';
  if returned_verdict is null or returned_verdict not in ('BELOW_FAIR', 'FAIR', 'ABOVE_FAIR', 'NEEDS_REVIEW')
     or (verdict_data ->> 'recommended_counter')::bigint is distinct from analysis_record.recommended_counter
     or (returned_verdict is distinct from deterministic_verdict
       and not (returned_verdict = 'NEEDS_REVIEW' and analysis_record.confidence_score < 50))
     or char_length(trim(coalesce(verdict_data ->> 'summary', ''))) not between 1 and 700
     or char_length(trim(coalesce(verdict_data ->> 'confidence_message', ''))) not between 1 and 400
  then raise exception 'AI result conflicts with deterministic pricing'; end if;
  if jsonb_typeof(verdict_data -> 'strengths') is distinct from 'array'
     or jsonb_typeof(verdict_data -> 'risks') is distinct from 'array'
     or jsonb_typeof(verdict_data -> 'reasoning_points') is distinct from 'array'
  then raise exception 'AI result arrays are required'; end if;
  if jsonb_array_length(verdict_data -> 'strengths') > 6
     or jsonb_array_length(verdict_data -> 'risks') > 8
     or jsonb_array_length(verdict_data -> 'reasoning_points') not between 1 and 8 then
    raise exception 'AI result conflicts with deterministic pricing';
  end if;
  if exists (
    select 1 from jsonb_array_elements(verdict_data -> 'strengths') item
    where jsonb_typeof(item) is distinct from 'string' or char_length(trim(item #>> '{}')) not between 1 and 240
  ) or exists (
    select 1 from jsonb_array_elements(verdict_data -> 'risks') item
    where jsonb_typeof(item) is distinct from 'string' or char_length(trim(item #>> '{}')) not between 1 and 240
  ) or exists (
    select 1 from jsonb_array_elements(verdict_data -> 'reasoning_points') item
    where jsonb_typeof(item) is distinct from 'string' or char_length(trim(item #>> '{}')) not between 1 and 300
  ) then raise exception 'AI result array entries are invalid'; end if;
  update public.deal_analyses set status = 'COMPLETED', ai_model = provider_model,
    ai_verdict = verdict_data, completed_at = now() where id = target_analysis_id;
  insert into public.analysis_usage_ledger (analysis_id, user_id, event_type, usage_bucket)
  values (target_analysis_id, analysis_record.requested_by, 'COMMITTED', analysis_record.usage_bucket)
  on conflict (analysis_id, event_type) do nothing;
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (analysis_record.requested_by, 'AI_ANALYSIS_READY', 'Deal analysis ready',
    'Your deterministic fair-value range and AI explanation are ready to review.',
    '/' || analysis_record.account_perspective::text || '/analysis/' || target_analysis_id::text,
    jsonb_build_object('analysis_id', target_analysis_id, 'offer_id', analysis_record.offer_id));
  if analysis_record.usage_bucket = 'FREE' and exists (
    select 1 from public.usage_limits ul where ul.user_id = analysis_record.requested_by
      and ul.free_evaluations_used >= ul.free_evaluations_total
      and not exists (
        select 1 from public.deal_analyses pending
        where pending.requested_by = analysis_record.requested_by
          and pending.id <> target_analysis_id and pending.status = 'PENDING'
          and pending.usage_consumed and pending.usage_bucket = 'FREE'
      )
  ) then
    insert into public.notifications (user_id, type, title, body, action_url, metadata)
    values (analysis_record.requested_by, 'USAGE_EXHAUSTED', 'AI evaluation allowance used',
      'Your 5 free AI evaluations are now used. Browsing and deal workflows remain available.',
      '/' || analysis_record.account_perspective::text || '/subscription',
      jsonb_build_object('analysis_id', target_analysis_id, 'usage_bucket', 'FREE'));
  elsif analysis_record.usage_bucket = 'PAID' and exists (
    select 1 from public.usage_limits ul
    join public.subscriptions s on s.user_id = ul.user_id
    join public.plan_entitlements pe on pe.plan = s.plan
    where ul.user_id = analysis_record.requested_by
      and ul.period_started_at is not distinct from analysis_record.usage_period_start
      and ul.period_ends_at is not distinct from analysis_record.usage_period_end
      and pe.ai_evaluations_per_period is not null
      and ul.paid_period_evaluations_used >= pe.ai_evaluations_per_period
      and not exists (
        select 1 from public.deal_analyses pending
        where pending.requested_by = analysis_record.requested_by
          and pending.id <> target_analysis_id and pending.status = 'PENDING'
          and pending.usage_consumed and pending.usage_bucket = 'PAID'
          and pending.usage_period_start is not distinct from analysis_record.usage_period_start
          and pending.usage_period_end is not distinct from analysis_record.usage_period_end
      )
  ) then
    insert into public.notifications (user_id, type, title, body, action_url, metadata)
    values (analysis_record.requested_by, 'USAGE_EXHAUSTED', 'AI evaluation allowance used',
      'Your current paid-period AI allowance is now used. Browsing and deal workflows remain available.',
      '/' || analysis_record.account_perspective::text || '/subscription',
      jsonb_build_object('analysis_id', target_analysis_id, 'usage_bucket', 'PAID'));
  end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (analysis_record.requested_by, 'AI_EVALUATION_COMPLETED', 'deal_analysis', target_analysis_id,
    jsonb_build_object('model', provider_model, 'usage_bucket', analysis_record.usage_bucket));
end;
$$;

create or replace function public.fail_deal_analysis(
  target_analysis_id uuid,
  failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_record public.deal_analyses%rowtype;
begin
  select * into analysis_record from public.deal_analyses da
  where da.id = target_analysis_id for update;
  if not found then return; end if;
  if analysis_record.status = 'FAILED' then return; end if;
  if analysis_record.status <> 'PENDING' then raise exception 'Completed analysis cannot be failed'; end if;
  update public.deal_analyses set status = 'FAILED', ai_verdict = null,
    provider_error_code = left(coalesce(nullif(trim(failure_code), ''), 'PROVIDER_UNAVAILABLE'), 80),
    completed_at = now(), usage_consumed = false where id = target_analysis_id;
  if analysis_record.usage_consumed and analysis_record.usage_bucket = 'FREE' then
    update public.usage_limits set free_evaluations_used = greatest(free_evaluations_used - 1, 0)
    where user_id = analysis_record.requested_by;
  elsif analysis_record.usage_consumed and analysis_record.usage_bucket = 'PAID' then
    update public.usage_limits set paid_period_evaluations_used = greatest(paid_period_evaluations_used - 1, 0)
    where user_id = analysis_record.requested_by
      and period_started_at is not distinct from analysis_record.usage_period_start
      and period_ends_at is not distinct from analysis_record.usage_period_end;
  end if;
  insert into public.analysis_usage_ledger (analysis_id, user_id, event_type, usage_bucket, reason_code)
  values (target_analysis_id, analysis_record.requested_by, 'RELEASED', analysis_record.usage_bucket,
    left(coalesce(nullif(trim(failure_code), ''), 'PROVIDER_UNAVAILABLE'), 80))
  on conflict (analysis_id, event_type) do nothing;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (analysis_record.requested_by, 'AI_EVALUATION_FAILED', 'deal_analysis', target_analysis_id,
    jsonb_build_object('failure_code', left(coalesce(nullif(trim(failure_code), ''), 'PROVIDER_UNAVAILABLE'), 80),
      'usage_released', analysis_record.usage_consumed));
end;
$$;

create or replace function public.expire_stale_deal_analyses(batch_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale_record record;
  expired_count integer := 0;
begin
  -- A single sweep owns analysis and usage locks in one transaction. Serializing
  -- sweepers avoids opposite-user lock ordering when schedulers overlap.
  if not pg_catalog.pg_try_advisory_xact_lock(734223960119337001::bigint) then
    return 0;
  end if;

  for stale_record in
    select da.id from public.deal_analyses da
    where da.status = 'PENDING' and da.usage_consumed
      and da.created_at < now() - interval '15 minutes'
    order by da.created_at
    limit least(greatest(coalesce(batch_limit, 100), 1), 500)
    for update skip locked
  loop
    perform public.fail_deal_analysis(stale_record.id, 'REQUEST_TIMEOUT');
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on function public.reserve_deal_analysis(uuid, uuid, text, uuid, integer, jsonb, jsonb, uuid[]) from public, anon, authenticated;
revoke all on function public.complete_deal_analysis(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_deal_analysis(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_stale_deal_analyses(integer) from public, anon, authenticated;
grant execute on function public.reserve_deal_analysis(uuid, uuid, text, uuid, integer, jsonb, jsonb, uuid[]) to service_role;
grant execute on function public.complete_deal_analysis(uuid, text, jsonb) to service_role;
grant execute on function public.fail_deal_analysis(uuid, text) to service_role;
grant execute on function public.expire_stale_deal_analyses(integer) to service_role;
