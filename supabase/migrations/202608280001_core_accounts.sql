-- Collab Deal OS: identity, onboarding, usage, and account isolation.
-- All private provider credentials remain outside the database schema and client bundle.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.sha256_text(input_value text)
returns text
language plpgsql
immutable
strict
security definer
set search_path = ''
as $$
declare
  digest_schema text;
  result_value text;
begin
  select n.nspname into digest_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if digest_schema is null then raise exception 'pgcrypto extension is unavailable'; end if;
  execute pg_catalog.format(
    'select pg_catalog.encode(%I.digest($1, ''sha256''), ''hex'')', digest_schema
  ) into result_value using input_value;
  return result_value;
end;
$$;
revoke all on function public.sha256_text(text) from public, anon, authenticated;

create type public.account_type as enum ('creator', 'brand');
create type public.plan_tier as enum ('FREE', 'PRO', 'PREMIUM');
create type public.metric_status as enum ('CREATOR_DECLARED', 'API_VERIFIED', 'UNAVAILABLE');
create type public.subscription_status as enum ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
create type public.notification_type as enum (
  'NEW_OFFER', 'OFFER_REVISED', 'OFFER_ACCEPTED', 'OFFER_REJECTED',
  'AI_ANALYSIS_READY', 'CAMPAIGN_MATCH', 'DEADLINE_APPROACHING',
  'USAGE_WARNING', 'USAGE_EXHAUSTED', 'SUBSCRIPTION_ACTIVATED',
  'PAYMENT_FAILED', 'ACCOUNT_ALERT'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  account_type public.account_type,
  plan public.plan_tier not null default 'FREE',
  evaluation_count integer not null default 0 check (evaluation_count >= 0),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email))
);

create unique index users_email_unique_idx on public.users (lower(email));
create index users_account_type_idx on public.users (account_type);
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  username text not null check (username ~ '^[a-z0-9_]{3,30}$'),
  bio text not null check (char_length(bio) between 20 and 500),
  avatar_path text,
  niche text not null,
  location text not null,
  primary_audience_region text not null,
  primary_content_format text not null,
  average_views bigint not null default 0 check (average_views >= 0),
  average_views_status public.metric_status not null default 'CREATOR_DECLARED',
  engagement_rate numeric(6,3) not null default 0 check (engagement_rate between 0 and 100),
  engagement_rate_status public.metric_status not null default 'CREATOR_DECLARED',
  expected_rate_low bigint not null default 0 check (expected_rate_low >= 0),
  expected_rate_high bigint not null default 0 check (expected_rate_high >= expected_rate_low),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  portfolio_url text,
  media_kit_url text,
  onboarding_complete boolean not null default false,
  is_discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index creator_profiles_username_unique_idx on public.creator_profiles (lower(username));
create index creator_profiles_niche_location_idx on public.creator_profiles (niche, location);
create trigger creator_profiles_set_updated_at before update on public.creator_profiles
for each row execute function public.set_updated_at();

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  brand_name text not null check (char_length(brand_name) between 2 and 120),
  logo_path text,
  website text not null,
  industry text not null,
  description text not null check (char_length(description) between 20 and 800),
  location text not null,
  target_audience text not null,
  typical_campaign_budget bigint not null check (typical_campaign_budget >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  target_creator_niche text not null,
  target_creator_location text not null,
  preferred_platforms text[] not null default '{}',
  campaign_objectives text[] not null default '{}',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_profiles_industry_location_idx on public.brand_profiles (industry, location);
create trigger brand_profiles_set_updated_at before update on public.brand_profiles
for each row execute function public.set_updated_at();

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  platform text not null check (char_length(platform) between 2 and 50),
  profile_url text,
  audience_count bigint not null default 0 check (audience_count >= 0),
  metric_label text not null default 'followers',
  metric_status public.metric_status not null default 'CREATOR_DECLARED',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_profile_id, platform),
  constraint verified_metric_has_timestamp check (
    metric_status <> 'API_VERIFIED' or verified_at is not null
  )
);

create index social_accounts_platform_audience_idx on public.social_accounts (platform, audience_count);
create trigger social_accounts_set_updated_at before update on public.social_accounts
for each row execute function public.set_updated_at();

create table public.usage_limits (
  user_id uuid primary key references public.users(id) on delete cascade,
  free_evaluations_total smallint not null default 5 check (free_evaluations_total >= 0),
  free_evaluations_used smallint not null default 0 check (
    free_evaluations_used >= 0 and free_evaluations_used <= free_evaluations_total
  ),
  paid_period_evaluations_used integer not null default 0 check (paid_period_evaluations_used >= 0),
  period_started_at timestamptz,
  period_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger usage_limits_set_updated_at before update on public.usage_limits
for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  plan public.plan_tier not null default 'FREE',
  status public.subscription_status not null default 'INACTIVE',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create index subscriptions_status_idx on public.subscriptions (status);
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.sync_subscription_account_cache()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.users set plan = new.plan where id = new.user_id;
  return new;
end;
$$;

create trigger subscriptions_sync_account_cache
after insert or update of plan on public.subscriptions
for each row execute function public.sync_subscription_account_cache();

create or replace function public.sync_usage_account_cache()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.users
  set evaluation_count = new.free_evaluations_used + new.paid_period_evaluations_used
  where id = new.user_id;
  return new;
end;
$$;

create trigger usage_limits_sync_account_cache
after insert or update of free_evaluations_used, paid_period_evaluations_used on public.usage_limits
for each row execute function public.sync_usage_account_cache();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 1000),
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_action_internal check (action_url is null or action_url ~ '^/[^/]')
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
where read_at is null;

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index activity_log_actor_created_idx on public.activity_log (actor_user_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.account_type;
begin
  if new.raw_user_meta_data ->> 'account_type' in ('creator', 'brand') then
    requested_role := (new.raw_user_meta_data ->> 'account_type')::public.account_type;
  else
    requested_role := null;
  end if;

  insert into public.users (id, email, account_type)
  values (new.id, lower(coalesce(new.email, '')), requested_role)
  on conflict (id) do update set email = excluded.email;

  insert into public.usage_limits (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.claim_account_role(desired_role public.account_type)
returns public.account_type
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_account_role public.account_type;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select account_type into existing_account_role
  from public.users
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Account record not found';
  end if;

  if existing_account_role is null then
    update public.users set account_type = desired_role where id = auth.uid();
    existing_account_role := desired_role;
  end if;

  return existing_account_role;
end;
$$;

create or replace function public.complete_creator_onboarding(
  profile_data jsonb,
  social_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  social_row jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if (select account_type from public.users where id = auth.uid() for update) is distinct from 'creator' then
    raise exception 'Creator account required';
  end if;
  if nullif(profile_data ->> 'avatar_path', '') is not null
     and profile_data ->> 'avatar_path' not like auth.uid()::text || '/%' then
    raise exception 'Invalid creator asset path';
  end if;
  if char_length(trim(coalesce(profile_data ->> 'full_name', ''))) not between 2 and 80
     or lower(trim(coalesce(profile_data ->> 'username', ''))) !~ '^[a-z0-9_]{3,30}$'
     or char_length(trim(coalesce(profile_data ->> 'bio', ''))) not between 20 and 500
     or char_length(trim(coalesce(profile_data ->> 'niche', ''))) not between 2 and 80
     or char_length(trim(coalesce(profile_data ->> 'location', ''))) not between 2 and 100
     or char_length(trim(coalesce(profile_data ->> 'primary_audience_region', ''))) not between 2 and 100
     or char_length(trim(coalesce(profile_data ->> 'primary_content_format', ''))) not between 2 and 80
     or coalesce((profile_data ->> 'average_views')::numeric, -1) not between 0 and 1000000000
     or coalesce((profile_data ->> 'engagement_rate')::numeric, -1) not between 0 and 100
     or coalesce((profile_data ->> 'expected_rate_low')::numeric, -1) not between 0 and 1000000000
     or coalesce((profile_data ->> 'expected_rate_high')::numeric, -1) not between
       coalesce((profile_data ->> 'expected_rate_low')::numeric, 1000000001) and 1000000000
     or (nullif(profile_data ->> 'portfolio_url', '') is not null and profile_data ->> 'portfolio_url' !~* '^https://')
     or (nullif(profile_data ->> 'media_kit_url', '') is not null and profile_data ->> 'media_kit_url' !~* '^https://') then
    raise exception 'Required creator profile fields are missing';
  end if;
  if jsonb_typeof(social_data) <> 'array'
     or jsonb_array_length(social_data) not between 1 and 5
     or not exists (
       select 1 from jsonb_array_elements(social_data) entry
       where upper(trim(entry ->> 'platform')) = 'INSTAGRAM'
         and coalesce(entry ->> 'profile_url', '') ~* '^https://([^/]+\.)?instagram\.com/[^/?#]+'
     ) then
    raise exception 'A valid Instagram profile URL is required';
  end if;
  if exists (
    select upper(trim(entry ->> 'platform'))
    from jsonb_array_elements(social_data) entry
    group by upper(trim(entry ->> 'platform'))
    having count(*) > 1
  ) then
    raise exception 'Duplicate social platform entries are not allowed';
  end if;
  if exists (
    select 1 from jsonb_array_elements(social_data) entry
    where char_length(trim(coalesce(entry ->> 'platform', ''))) not between 2 and 50
      or coalesce((entry ->> 'audience_count')::numeric, -1) not between 0 and 1000000000
      or (nullif(entry ->> 'profile_url', '') is not null and entry ->> 'profile_url' !~* '^https://')
      or (upper(trim(entry ->> 'platform')) = 'FACEBOOK' and coalesce(entry ->> 'profile_url', '') <> '' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?(facebook|fb)\.com/')
      or (upper(trim(entry ->> 'platform')) = 'YOUTUBE' and coalesce(entry ->> 'profile_url', '') <> '' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?(youtube\.com|youtu\.be)/')
      or (upper(trim(entry ->> 'platform')) = 'TIKTOK' and coalesce(entry ->> 'profile_url', '') <> '' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?tiktok\.com/')
  ) then
    raise exception 'Invalid social account data';
  end if;

  insert into public.creator_profiles (
    user_id, full_name, username, bio, avatar_path, niche, location,
    primary_audience_region, primary_content_format, average_views, average_views_status,
    engagement_rate, engagement_rate_status, expected_rate_low, expected_rate_high, currency,
    portfolio_url, media_kit_url, onboarding_complete
  ) values (
    auth.uid(), trim(profile_data ->> 'full_name'), lower(trim(profile_data ->> 'username')),
    trim(profile_data ->> 'bio'), profile_data ->> 'avatar_path', profile_data ->> 'niche',
    profile_data ->> 'location', profile_data ->> 'primary_audience_region',
    profile_data ->> 'primary_content_format', (profile_data ->> 'average_views')::bigint,
    'CREATOR_DECLARED', (profile_data ->> 'engagement_rate')::numeric, 'CREATOR_DECLARED',
    (profile_data ->> 'expected_rate_low')::bigint,
    (profile_data ->> 'expected_rate_high')::bigint, coalesce(profile_data ->> 'currency', 'INR'),
    nullif(profile_data ->> 'portfolio_url', ''), nullif(profile_data ->> 'media_kit_url', ''), true
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name, username = excluded.username, bio = excluded.bio,
    avatar_path = coalesce(excluded.avatar_path, creator_profiles.avatar_path), niche = excluded.niche,
    location = excluded.location, primary_audience_region = excluded.primary_audience_region,
    primary_content_format = excluded.primary_content_format, average_views = excluded.average_views,
    average_views_status = 'CREATOR_DECLARED', engagement_rate = excluded.engagement_rate,
    engagement_rate_status = 'CREATOR_DECLARED', expected_rate_low = excluded.expected_rate_low,
    expected_rate_high = excluded.expected_rate_high, currency = excluded.currency,
    portfolio_url = excluded.portfolio_url, media_kit_url = excluded.media_kit_url,
    onboarding_complete = true
  returning id into profile_id;

  for social_row in select value from jsonb_array_elements(social_data)
  loop
    insert into public.social_accounts (
      creator_profile_id, platform, profile_url, audience_count, metric_label, metric_status
    ) values (
      profile_id, upper(trim(social_row ->> 'platform')), nullif(social_row ->> 'profile_url', ''),
      greatest(coalesce((social_row ->> 'audience_count')::bigint, 0), 0),
      coalesce(social_row ->> 'metric_label', 'followers'),
      case
        when greatest(coalesce((social_row ->> 'audience_count')::bigint, 0), 0) > 0
          or nullif(social_row ->> 'profile_url', '') is not null
        then 'CREATOR_DECLARED'::public.metric_status
        else 'UNAVAILABLE'::public.metric_status
      end
    )
    on conflict (creator_profile_id, platform) do update set
      profile_url = excluded.profile_url,
      audience_count = case when social_accounts.metric_status = 'API_VERIFIED'
        then social_accounts.audience_count else excluded.audience_count end,
      metric_label = excluded.metric_label,
      metric_status = case when social_accounts.metric_status = 'API_VERIFIED'
        then social_accounts.metric_status else excluded.metric_status end,
      verified_at = case when social_accounts.metric_status = 'API_VERIFIED'
        then social_accounts.verified_at else null end;
  end loop;

  update public.users set onboarding_completed_at = now() where id = auth.uid();
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'ONBOARDING_COMPLETED', 'creator_profile', profile_id);
  return profile_id;
end;
$$;

create or replace function public.complete_brand_onboarding(profile_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if (select account_type from public.users where id = auth.uid() for update) is distinct from 'brand' then
    raise exception 'Brand account required';
  end if;
  if nullif(profile_data ->> 'logo_path', '') is not null
     and profile_data ->> 'logo_path' not like auth.uid()::text || '/%' then
    raise exception 'Invalid brand asset path';
  end if;
  if char_length(trim(coalesce(profile_data ->> 'brand_name', ''))) not between 2 and 120
     or coalesce(profile_data ->> 'website', '') !~* '^https://'
     or char_length(trim(coalesce(profile_data ->> 'industry', ''))) not between 2 and 100
     or char_length(trim(coalesce(profile_data ->> 'description', ''))) not between 20 and 800
     or char_length(trim(coalesce(profile_data ->> 'location', ''))) not between 2 and 100
     or char_length(trim(coalesce(profile_data ->> 'target_audience', ''))) not between 10 and 500
     or coalesce((profile_data ->> 'typical_campaign_budget')::numeric, -1) not between 1000 and 1000000000
     or char_length(trim(coalesce(profile_data ->> 'target_creator_niche', ''))) not between 2 and 80
     or char_length(trim(coalesce(profile_data ->> 'target_creator_location', ''))) not between 2 and 100
     or jsonb_typeof(coalesce(profile_data -> 'preferred_platforms', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(profile_data -> 'preferred_platforms', '[]'::jsonb)) not between 1 and 4
     or jsonb_typeof(coalesce(profile_data -> 'campaign_objectives', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(profile_data -> 'campaign_objectives', '[]'::jsonb)) not between 1 and 8 then
    raise exception 'Required brand profile fields are missing';
  end if;

  insert into public.brand_profiles (
    user_id, brand_name, logo_path, website, industry, description, location,
    target_audience, typical_campaign_budget, currency, target_creator_niche,
    target_creator_location, preferred_platforms, campaign_objectives, onboarding_complete
  ) values (
    auth.uid(), trim(profile_data ->> 'brand_name'), profile_data ->> 'logo_path',
    profile_data ->> 'website', profile_data ->> 'industry', trim(profile_data ->> 'description'),
    profile_data ->> 'location', profile_data ->> 'target_audience',
    (profile_data ->> 'typical_campaign_budget')::bigint, coalesce(profile_data ->> 'currency', 'INR'),
    profile_data ->> 'target_creator_niche', profile_data ->> 'target_creator_location',
    array(select jsonb_array_elements_text(coalesce(profile_data -> 'preferred_platforms', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(profile_data -> 'campaign_objectives', '[]'::jsonb))), true
  )
  on conflict (user_id) do update set
    brand_name = excluded.brand_name, logo_path = coalesce(excluded.logo_path, brand_profiles.logo_path),
    website = excluded.website, industry = excluded.industry, description = excluded.description,
    location = excluded.location, target_audience = excluded.target_audience,
    typical_campaign_budget = excluded.typical_campaign_budget, currency = excluded.currency,
    target_creator_niche = excluded.target_creator_niche,
    target_creator_location = excluded.target_creator_location,
    preferred_platforms = excluded.preferred_platforms,
    campaign_objectives = excluded.campaign_objectives, onboarding_complete = true
  returning id into profile_id;

  update public.users set onboarding_completed_at = now() where id = auth.uid();
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'ONBOARDING_COMPLETED', 'brand_profile', profile_id);
  return profile_id;
end;
$$;

create or replace view public.account_state
with (security_invoker = true)
as
select
  u.id,
  u.email,
  u.account_type,
  coalesce(s.plan, 'FREE') as plan,
  coalesce(ul.free_evaluations_used + ul.paid_period_evaluations_used, 0) as evaluation_count,
  case
    when u.account_type = 'creator' then coalesce(cp.onboarding_complete, false)
    when u.account_type = 'brand' then coalesce(bp.onboarding_complete, false)
    else false
  end as onboarding_complete,
  case
    when u.account_type = 'creator' then cp.full_name
    when u.account_type = 'brand' then bp.brand_name
    else null
  end as display_name,
  ul.free_evaluations_total,
  ul.free_evaluations_used,
  s.status as subscription_status
from public.users u
left join public.creator_profiles cp on cp.user_id = u.id
left join public.brand_profiles bp on bp.user_id = u.id
left join public.usage_limits ul on ul.user_id = u.id
left join public.subscriptions s on s.user_id = u.id;

alter table public.users enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.social_accounts enable row level security;
alter table public.usage_limits enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;

create policy users_select_self on public.users for select to authenticated
using (id = auth.uid());
create policy creator_profiles_select_self on public.creator_profiles for select to authenticated
using (user_id = auth.uid());
create policy brand_profiles_select_self on public.brand_profiles for select to authenticated
using (user_id = auth.uid());
create policy social_accounts_select_self on public.social_accounts for select to authenticated
using (exists (
  select 1 from public.creator_profiles cp
  where cp.id = creator_profile_id and cp.user_id = auth.uid()
));
create policy usage_limits_select_self on public.usage_limits for select to authenticated
using (user_id = auth.uid());
create policy subscriptions_select_self on public.subscriptions for select to authenticated
using (user_id = auth.uid());
create policy notifications_select_self on public.notifications for select to authenticated
using (user_id = auth.uid());
create policy notifications_mark_read_self on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activity_log_select_self on public.activity_log for select to authenticated
using (actor_user_id = auth.uid());

revoke all on public.users, public.creator_profiles, public.brand_profiles,
  public.social_accounts, public.usage_limits, public.subscriptions,
  public.notifications, public.activity_log from anon, authenticated;
grant select on public.users, public.creator_profiles, public.brand_profiles,
  public.social_accounts, public.usage_limits, public.subscriptions,
  public.notifications, public.activity_log to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.account_state to authenticated;

revoke all on function public.claim_account_role(public.account_type) from public;
revoke all on function public.complete_creator_onboarding(jsonb, jsonb) from public;
revoke all on function public.complete_brand_onboarding(jsonb) from public;
grant execute on function public.claim_account_role(public.account_type) to authenticated;
grant execute on function public.complete_creator_onboarding(jsonb, jsonb) to authenticated;
grant execute on function public.complete_brand_onboarding(jsonb) to authenticated;
