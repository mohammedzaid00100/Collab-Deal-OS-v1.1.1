-- Collab Deal OS: campaigns, explainable matches, structured offers, immutable
-- revisions, analyses, subscriptions, and webhook/audit foundations.

create type public.campaign_status as enum ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED');
create type public.deal_type as enum ('PAID', 'PRODUCT_ONLY', 'HYBRID');
create type public.offer_status as enum (
  'DRAFT', 'SENT', 'UNDER_REVIEW', 'REVISED', 'ACCEPTED',
  'REJECTED', 'EXPIRED', 'COMPLETED'
);
create type public.analysis_status as enum ('PENDING', 'COMPLETED', 'FAILED');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references public.brand_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 20 and 3000),
  platform text not null,
  target_creator_niche text not null,
  target_location text,
  target_followers_min bigint not null default 0 check (target_followers_min >= 0),
  target_followers_max bigint check (target_followers_max is null or target_followers_max >= target_followers_min),
  target_engagement_min numeric(6,3) check (target_engagement_min is null or target_engagement_min between 0 and 100),
  target_engagement_max numeric(6,3) check (
    target_engagement_max is null or target_engagement_max between coalesce(target_engagement_min, 0) and 100
  ),
  budget bigint not null default 0 check (budget >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  deal_type public.deal_type not null,
  product_name text,
  product_value bigint not null default 0 check (product_value >= 0),
  objective text not null,
  starts_at date,
  ends_at date,
  submission_deadline timestamptz,
  usage_rights text,
  usage_duration_days integer check (usage_duration_days is null or usage_duration_days >= 0),
  paid_ad_rights boolean not null default false,
  exclusivity boolean not null default false,
  exclusivity_duration_days integer check (exclusivity_duration_days is null or exclusivity_duration_days >= 0),
  territory text,
  additional_requirements text,
  asset_path text,
  status public.campaign_status not null default 'DRAFT',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_dates_valid check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint campaign_deal_value_valid check (
    (deal_type = 'PAID' and budget > 0)
    or (deal_type = 'PRODUCT_ONLY' and product_value > 0)
    or (deal_type = 'HYBRID' and budget > 0 and product_value > 0)
  )
);

create index campaigns_status_created_idx on public.campaigns (status, created_at desc);
create index campaigns_brand_status_idx on public.campaigns (brand_profile_id, status);
create index campaigns_matching_idx on public.campaigns (target_creator_niche, platform, target_location);
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

create table public.campaign_deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  deliverable_type text not null,
  quantity smallint not null default 1 check (quantity between 1 and 100),
  notes text,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index campaign_deliverables_campaign_idx on public.campaign_deliverables (campaign_id, position);

create or replace function public.validate_campaign_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'DRAFT' then
    raise exception 'Campaigns must be created as drafts';
  end if;
  if tg_op = 'UPDATE' then
    if old.status in ('CLOSED', 'ARCHIVED') and new.status <> old.status then
      raise exception 'Closed or archived campaigns cannot be reopened directly';
    end if;
    if new.status = 'PUBLISHED' and old.status <> 'PUBLISHED' then
      if not exists (select 1 from public.campaign_deliverables d where d.campaign_id = new.id) then
        raise exception 'Published campaigns require at least one deliverable';
      end if;
      new.published_at := now();
    elsif new.status = 'DRAFT' then
      new.published_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger campaigns_validate_lifecycle
before insert or update of status on public.campaigns
for each row execute function public.validate_campaign_lifecycle();

create table public.campaign_matches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  match_score numeric(5,2) not null check (match_score between 0 and 100),
  score_components jsonb not null,
  match_explanation text not null,
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_profile_id)
);

create index campaign_matches_creator_score_idx on public.campaign_matches (creator_profile_id, match_score desc);
create index campaign_matches_campaign_score_idx on public.campaign_matches (campaign_id, match_score desc);
create trigger campaign_matches_set_updated_at before update on public.campaign_matches
for each row execute function public.set_updated_at();

create table public.saved_opportunities (
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_profile_id, campaign_id)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  brand_profile_id uuid not null references public.brand_profiles(id) on delete restrict,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete restrict,
  cash_payment bigint not null default 0 check (cash_payment >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  product_name text,
  product_value bigint not null default 0 check (product_value >= 0),
  deal_type public.deal_type not null,
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  usage_rights text,
  usage_duration_days integer check (usage_duration_days is null or usage_duration_days >= 0),
  paid_ad_rights boolean not null default false,
  exclusivity boolean not null default false,
  exclusivity_duration_days integer check (exclusivity_duration_days is null or exclusivity_duration_days >= 0),
  deadline timestamptz,
  territory text,
  notes text check (notes is null or char_length(notes) <= 2000),
  status public.offer_status not null default 'DRAFT',
  version integer not null default 1 check (version >= 1),
  created_by uuid not null references public.users(id) on delete restrict,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_deal_value_valid check (
    (deal_type = 'PAID' and cash_payment > 0)
    or (deal_type = 'PRODUCT_ONLY' and product_value > 0)
    or (deal_type = 'HYBRID' and cash_payment > 0 and product_value > 0)
  )
);

create or replace function public.validate_offer_participants()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  campaign_brand uuid;
  brand_user uuid;
  creator_user uuid;
begin
  if new.campaign_id is not null then
    select brand_profile_id into campaign_brand from public.campaigns where id = new.campaign_id;
    if campaign_brand is distinct from new.brand_profile_id then
      raise exception 'Offer brand must own the campaign';
    end if;
  end if;
  select user_id into brand_user from public.brand_profiles where id = new.brand_profile_id;
  select user_id into creator_user from public.creator_profiles where id = new.creator_profile_id;
  if new.created_by is distinct from brand_user and new.created_by is distinct from creator_user then
    raise exception 'Offer creator must be a deal participant';
  end if;
  return new;
end;
$$;

create trigger offers_validate_participants
before insert or update of campaign_id, brand_profile_id, creator_profile_id, created_by on public.offers
for each row execute function public.validate_offer_participants();

create index offers_creator_status_idx on public.offers (creator_profile_id, status, updated_at desc);
create index offers_brand_status_idx on public.offers (brand_profile_id, status, updated_at desc);
create index offers_campaign_idx on public.offers (campaign_id);
create trigger offers_set_updated_at before update on public.offers
for each row execute function public.set_updated_at();

create table public.offer_revisions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete restrict,
  from_version integer not null check (from_version >= 1),
  to_version integer not null check (to_version = from_version + 1),
  old_values jsonb not null,
  new_values jsonb not null,
  changed_fields text[] not null,
  changed_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (offer_id, to_version)
);

create index offer_revisions_offer_version_idx on public.offer_revisions (offer_id, to_version desc);

create or replace function public.prevent_immutable_record_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception '% records are immutable', tg_table_name;
end;
$$;

create trigger offer_revisions_immutable
before update or delete on public.offer_revisions
for each row execute function public.prevent_immutable_record_change();

create table public.pricing_benchmarks (
  id uuid primary key default gen_random_uuid(),
  benchmark_key text not null,
  niche text,
  platform text,
  region text,
  currency char(3) not null default 'INR',
  configuration jsonb not null,
  source_label text not null,
  effective_from date not null,
  effective_until date,
  engine_version text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint benchmark_dates_valid check (effective_until is null or effective_until >= effective_from)
);

create unique index pricing_benchmarks_active_key_idx
on public.pricing_benchmarks (benchmark_key, engine_version)
where is_active;

create table public.deal_analyses (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.users(id) on delete restrict,
  offer_id uuid references public.offers(id) on delete restrict,
  offer_version integer check (offer_version is null or offer_version >= 1),
  status public.analysis_status not null default 'PENDING',
  account_perspective public.account_type not null,
  offer_snapshot jsonb not null,
  creator_metrics_snapshot jsonb not null,
  pricing_inputs_snapshot jsonb not null,
  fair_low bigint check (fair_low is null or fair_low >= 0),
  fair_mid bigint check (fair_mid is null or fair_mid >= 0),
  fair_high bigint check (fair_high is null or fair_high >= 0),
  deal_score numeric(5,2) check (deal_score is null or deal_score between 0 and 100),
  confidence_score numeric(5,2) check (confidence_score is null or confidence_score between 0 and 100),
  pricing_engine_version text not null,
  ai_model text,
  ai_verdict jsonb,
  recommended_counter bigint check (recommended_counter is null or recommended_counter >= 0),
  provider_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint analysis_range_valid check (
    (fair_low is null and fair_mid is null and fair_high is null)
    or (fair_low is not null and fair_mid is not null and fair_high is not null
      and fair_low <= fair_mid and fair_mid <= fair_high)
  ),
  constraint completed_analysis_has_result check (
    status <> 'COMPLETED' or (
      fair_low is not null and fair_mid is not null and fair_high is not null
      and deal_score is not null and confidence_score is not null and ai_verdict is not null
      and completed_at is not null
    )
  ),
  constraint terminal_analysis_has_timestamp check (
    status = 'PENDING' or completed_at is not null
  )
);

create index deal_analyses_requester_created_idx on public.deal_analyses (requested_by, created_at desc);
create index deal_analyses_offer_version_idx on public.deal_analyses (offer_id, offer_version);
create trigger deal_analyses_immutable
before update or delete on public.deal_analyses
for each row when (old.status in ('COMPLETED', 'FAILED'))
execute function public.prevent_immutable_record_change();

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_verified boolean not null default false,
  payload_hash text not null,
  processing_status text not null default 'RECEIVED',
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.campaigns enable row level security;
alter table public.campaign_deliverables enable row level security;
alter table public.campaign_matches enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.offers enable row level security;
alter table public.offer_revisions enable row level security;
alter table public.pricing_benchmarks enable row level security;
alter table public.deal_analyses enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy campaigns_select_participants on public.campaigns for select to authenticated
using (
  status = 'PUBLISHED'
  or exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid())
);
create policy campaigns_insert_owner on public.campaigns for insert to authenticated
with check (exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid()));
create policy campaigns_update_owner on public.campaigns for update to authenticated
using (exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid()))
with check (exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid()));
create policy campaigns_delete_owner on public.campaigns for delete to authenticated
using (exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid()));

create policy campaign_deliverables_select_visible on public.campaign_deliverables for select to authenticated
using (exists (select 1 from public.campaigns c where c.id = campaign_id));
create policy campaign_deliverables_mutate_owner on public.campaign_deliverables for all to authenticated
using (exists (
  select 1 from public.campaigns c join public.brand_profiles bp on bp.id = c.brand_profile_id
  where c.id = campaign_id and bp.user_id = auth.uid()
)) with check (exists (
  select 1 from public.campaigns c join public.brand_profiles bp on bp.id = c.brand_profile_id
  where c.id = campaign_id and bp.user_id = auth.uid()
));

create policy campaign_matches_select_participant on public.campaign_matches for select to authenticated
using (
  exists (select 1 from public.creator_profiles cp where cp.id = creator_profile_id and cp.user_id = auth.uid())
  or exists (
    select 1 from public.campaigns c join public.brand_profiles bp on bp.id = c.brand_profile_id
    where c.id = campaign_id and bp.user_id = auth.uid()
  )
);
create policy saved_opportunities_owner on public.saved_opportunities for all to authenticated
using (
  exists (select 1 from public.creator_profiles cp where cp.id = creator_profile_id and cp.user_id = auth.uid())
  and exists (select 1 from public.campaigns c where c.id = campaign_id and c.status = 'PUBLISHED')
)
with check (
  exists (select 1 from public.creator_profiles cp where cp.id = creator_profile_id and cp.user_id = auth.uid())
  and exists (select 1 from public.campaigns c where c.id = campaign_id and c.status = 'PUBLISHED')
);

create policy offers_select_participants on public.offers for select to authenticated
using (
  exists (select 1 from public.creator_profiles cp where cp.id = creator_profile_id and cp.user_id = auth.uid())
  or exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid())
);
create policy offer_revisions_select_participants on public.offer_revisions for select to authenticated
using (exists (select 1 from public.offers o where o.id = offer_id));
create policy deal_analyses_select_requester on public.deal_analyses for select to authenticated
using (requested_by = auth.uid());
create policy pricing_benchmarks_read on public.pricing_benchmarks for select to authenticated
using (is_active and effective_from <= current_date and (effective_until is null or effective_until >= current_date));

grant select, insert, update, delete on public.campaigns, public.campaign_deliverables to authenticated;
grant select on public.campaign_matches to authenticated;
grant select, insert, delete on public.saved_opportunities to authenticated;
grant select on public.offers, public.offer_revisions, public.deal_analyses, public.pricing_benchmarks to authenticated;
revoke all on public.payment_webhook_events from anon, authenticated;
revoke insert, update, delete on public.campaign_matches, public.offers,
  public.offer_revisions, public.deal_analyses, public.pricing_benchmarks from authenticated;
