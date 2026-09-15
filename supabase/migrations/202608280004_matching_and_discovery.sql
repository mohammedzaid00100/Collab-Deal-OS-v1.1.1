-- Phase 2: validated publishing, explainable matching, and column-limited
-- discovery feeds. These RPCs expose only the fields required by each role.

create or replace function public.publish_campaign_and_generate_matches(target_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_record public.campaigns%rowtype;
  generated_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select c.* into campaign_record
  from public.campaigns c
  join public.brand_profiles bp on bp.id = c.brand_profile_id
  where c.id = target_campaign_id and bp.user_id = auth.uid()
  for update of c;

  if not found then raise exception 'Campaign not found or not owned by account'; end if;
  if campaign_record.status not in ('DRAFT', 'PAUSED') then
    raise exception 'Only draft or paused campaigns can be published';
  end if;
  if not exists (select 1 from public.campaign_deliverables d where d.campaign_id = target_campaign_id) then
    raise exception 'Add at least one deliverable before publishing';
  end if;
  if campaign_record.submission_deadline is not null and campaign_record.submission_deadline <= now() then
    raise exception 'Submission deadline must be in the future';
  end if;

  update public.campaigns
  set status = 'PUBLISHED'
  where id = target_campaign_id;

  delete from public.campaign_matches where campaign_id = target_campaign_id;

  with creator_inputs as (
    select
      cp.id as creator_profile_id,
      cp.full_name,
      cp.niche,
      cp.location,
      cp.primary_audience_region,
      cp.engagement_rate,
      cp.expected_rate_low,
      cp.expected_rate_high,
      coalesce(sa.audience_count, 0) as platform_audience,
      (sa.id is not null and sa.metric_status <> 'UNAVAILABLE') as platform_present
    from public.creator_profiles cp
    left join lateral (
      select account.id, account.audience_count, account.metric_status
      from public.social_accounts account
      where account.creator_profile_id = cp.id
        and upper(account.platform) = upper(campaign_record.platform)
      order by account.audience_count desc
      limit 1
    ) sa on true
    where cp.onboarding_complete
  ), component_scores as (
    select
      input.*,
      case
        when lower(trim(input.niche)) = lower(trim(campaign_record.target_creator_niche)) then 30.0
        when position(lower(trim(input.niche)) in lower(trim(campaign_record.target_creator_niche))) > 0
          or position(lower(trim(campaign_record.target_creator_niche)) in lower(trim(input.niche))) > 0 then 15.0
        else 0.0
      end as niche_score,
      case
        when nullif(trim(campaign_record.target_location), '') is null then 20.0
        when position(lower(trim(input.location)) in lower(trim(campaign_record.target_location))) > 0
          or position(lower(trim(campaign_record.target_location)) in lower(trim(input.location))) > 0
          or position(lower(trim(input.primary_audience_region)) in lower(trim(campaign_record.target_location))) > 0
          or position(lower(trim(campaign_record.target_location)) in lower(trim(input.primary_audience_region))) > 0 then 20.0
        else 0.0
      end as location_score,
      case
        when input.platform_audience >= campaign_record.target_followers_min
          and (campaign_record.target_followers_max is null or input.platform_audience <= campaign_record.target_followers_max) then 15.0
        when input.platform_audience >= campaign_record.target_followers_min * 0.8
          and (campaign_record.target_followers_max is null or input.platform_audience <= campaign_record.target_followers_max * 1.2) then 7.5
        else 0.0
      end as size_score,
      case
        when campaign_record.target_engagement_min is null and campaign_record.target_engagement_max is null then 15.0
        when input.engagement_rate >= coalesce(campaign_record.target_engagement_min, 0)
          and input.engagement_rate <= coalesce(campaign_record.target_engagement_max, 100) then 15.0
        when input.engagement_rate >= greatest(coalesce(campaign_record.target_engagement_min, 0) - 1, 0)
          and input.engagement_rate <= least(coalesce(campaign_record.target_engagement_max, 100) + 1, 100) then 7.5
        else 0.0
      end as engagement_score,
      case
        when campaign_record.budget::numeric + campaign_record.product_value::numeric between input.expected_rate_low and input.expected_rate_high then 10.0
        when campaign_record.budget::numeric + campaign_record.product_value::numeric between input.expected_rate_low * 0.75 and input.expected_rate_high * 1.25 then 5.0
        else 0.0
      end as budget_score,
      case when input.platform_present then 10.0 else 0.0 end as platform_score
    from creator_inputs input
  ), scored as (
    select
      scores.*,
      round((scores.niche_score + scores.location_score + scores.size_score + scores.engagement_score + scores.budget_score + scores.platform_score)::numeric, 2) as total_score
    from component_scores scores
  )
  insert into public.campaign_matches (
    campaign_id, creator_profile_id, match_score, score_components,
    match_explanation, engine_version
  )
  select
    target_campaign_id,
    scored.creator_profile_id,
    scored.total_score,
    jsonb_build_object(
      'niche', scored.niche_score,
      'audienceLocation', scored.location_score,
      'creatorSize', scored.size_score,
      'engagement', scored.engagement_score,
      'budget', scored.budget_score,
      'platform', scored.platform_score
    ),
    concat(
      'Match based on ',
      case when scored.niche_score = 30 then 'strong niche fit, ' when scored.niche_score = 15 then 'partial niche fit, ' else 'no niche fit, ' end,
      case when scored.location_score = 20 then 'audience/location alignment, ' else 'limited location alignment, ' end,
      case when scored.platform_score = 10 then 'active platform presence' else 'limited platform data' end,
      '. Budget, creator size, and engagement are included in the score.'
    ),
    'match-v1.0.0'
  from scored
  where scored.total_score >= 40
    and scored.platform_present
    and scored.niche_score > 0;

  get diagnostics generated_count = row_count;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'CAMPAIGN_PUBLISHED', 'campaign', target_campaign_id, jsonb_build_object('matches', generated_count));
  return generated_count;
end;
$$;

create or replace function public.creator_opportunities_feed(
  target_campaign_id uuid default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  campaign_id uuid,
  title text,
  description text,
  platform text,
  niche text,
  target_location text,
  target_followers_min bigint,
  target_followers_max bigint,
  target_engagement_min numeric,
  target_engagement_max numeric,
  budget bigint,
  currency char(3),
  deal_type public.deal_type,
  product_name text,
  product_value bigint,
  deadline timestamptz,
  asset_path text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  match_score numeric,
  match_explanation text,
  deliverables jsonb,
  objective text,
  starts_at date,
  ends_at date,
  usage_rights text,
  usage_duration_days integer,
  paid_ad_rights boolean,
  exclusivity boolean,
  exclusivity_duration_days integer,
  territory text,
  additional_requirements text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  creator_id uuid;
begin
  select cp.id into creator_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id and u.account_type = 'creator'
  where cp.user_id = auth.uid() and cp.onboarding_complete;
  if creator_id is null then raise exception 'Completed creator profile required'; end if;

  return query
  select
    c.id, c.title, c.description, c.platform, c.target_creator_niche,
    c.target_location, c.target_followers_min, c.target_followers_max,
    c.target_engagement_min, c.target_engagement_max,
    c.budget, c.currency, c.deal_type, c.product_name,
    c.product_value, c.submission_deadline, c.asset_path, bp.id, bp.brand_name,
    bp.logo_path, cm.match_score, cm.match_explanation,
    coalesce((
      select jsonb_agg(jsonb_build_object('type', d.deliverable_type, 'quantity', d.quantity, 'notes', d.notes) order by d.position)
      from public.campaign_deliverables d where d.campaign_id = c.id
    ), '[]'::jsonb),
    c.objective, c.starts_at, c.ends_at, c.usage_rights,
    c.usage_duration_days, c.paid_ad_rights, c.exclusivity,
    c.exclusivity_duration_days, c.territory, c.additional_requirements,
    c.created_at
  from public.campaign_matches cm
  join public.campaigns c on c.id = cm.campaign_id and c.status = 'PUBLISHED'
  join public.brand_profiles bp on bp.id = c.brand_profile_id and bp.onboarding_complete
  where cm.creator_profile_id = creator_id
    and (target_campaign_id is null or c.id = target_campaign_id)
    and cm.engine_version = 'match-v1.0.0'
    and (c.submission_deadline is null or c.submission_deadline > now())
  order by cm.match_score desc, c.created_at desc
  limit least(greatest(coalesce(result_limit, 50), 1), 100)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;

create or replace function public.creator_discovery_feed(
  target_creator_id uuid default null,
  filter_niche text default null,
  filter_platform text default null,
  filter_location text default null,
  minimum_followers bigint default null,
  maximum_followers bigint default null,
  minimum_engagement numeric default null,
  minimum_average_views bigint default null,
  minimum_match_score numeric default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  creator_id uuid,
  full_name text,
  username text,
  bio text,
  niche text,
  location text,
  primary_audience_region text,
  primary_content_format text,
  average_views bigint,
  average_views_status public.metric_status,
  engagement_rate numeric,
  engagement_rate_status public.metric_status,
  expected_rate_low bigint,
  expected_rate_high bigint,
  currency char(3),
  avatar_path text,
  portfolio_url text,
  media_kit_url text,
  social_accounts jsonb,
  best_match_score numeric,
  best_campaign_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users u
    join public.brand_profiles bp on bp.user_id = u.id and bp.onboarding_complete
    where u.id = auth.uid() and u.account_type = 'brand'
  ) then raise exception 'Completed brand profile required'; end if;

  return query
  select
    cp.id, cp.full_name, cp.username, cp.bio, cp.niche, cp.location,
    cp.primary_audience_region, cp.primary_content_format, cp.average_views,
    cp.average_views_status, cp.engagement_rate, cp.engagement_rate_status,
    cp.expected_rate_low, cp.expected_rate_high, cp.currency, cp.avatar_path,
    cp.portfolio_url, cp.media_kit_url,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', sa.platform,
        'profile_url', sa.profile_url,
        'audience_count', sa.audience_count,
        'metric_label', sa.metric_label,
        'metric_status', sa.metric_status
      ) order by sa.audience_count desc)
      from public.social_accounts sa
      where sa.creator_profile_id = cp.id and sa.metric_status <> 'UNAVAILABLE'
    ), '[]'::jsonb),
    best_match.match_score,
    best_match.campaign_id
  from public.creator_profiles cp
  left join lateral (
    select cm.match_score, cm.campaign_id
    from public.campaign_matches cm
    join public.campaigns c on c.id = cm.campaign_id
    join public.brand_profiles bp on bp.id = c.brand_profile_id
    where cm.creator_profile_id = cp.id and bp.user_id = auth.uid()
      and c.status = 'PUBLISHED'
      and cm.engine_version = 'match-v1.0.0'
      and (c.submission_deadline is null or c.submission_deadline > now())
    order by cm.match_score desc, cm.campaign_id
    limit 1
  ) best_match on true
  where cp.onboarding_complete and cp.is_discoverable
    and (target_creator_id is null or cp.id = target_creator_id)
    and (nullif(trim(filter_niche), '') is null or lower(trim(cp.niche)) = lower(trim(filter_niche)))
    and (nullif(trim(filter_location), '') is null
      or position(lower(trim(filter_location)) in lower(trim(cp.location))) > 0
      or position(lower(trim(filter_location)) in lower(trim(cp.primary_audience_region))) > 0)
    and (
      (nullif(trim(filter_platform), '') is null and minimum_followers is null and maximum_followers is null)
      or exists (
      select 1 from public.social_accounts platform_account
      where platform_account.creator_profile_id = cp.id
        and (nullif(trim(filter_platform), '') is null
          or upper(trim(platform_account.platform)) = upper(trim(filter_platform)))
        and platform_account.metric_status <> 'UNAVAILABLE'
        and (minimum_followers is null or platform_account.audience_count >= minimum_followers)
        and (maximum_followers is null or platform_account.audience_count <= maximum_followers)
      )
    )
    and (minimum_engagement is null or cp.engagement_rate >= minimum_engagement)
    and (minimum_average_views is null or cp.average_views >= minimum_average_views)
    and (minimum_match_score is null or best_match.match_score >= minimum_match_score)
  order by best_match.match_score desc nulls last, cp.engagement_rate desc, cp.id
  limit least(greatest(coalesce(result_limit, 50), 1), 100)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;

create or replace function public.brand_campaign_matches(target_campaign_id uuid)
returns table (
  creator_id uuid,
  full_name text,
  username text,
  niche text,
  location text,
  average_views bigint,
  engagement_rate numeric,
  expected_rate_low bigint,
  expected_rate_high bigint,
  currency char(3),
  avatar_path text,
  social_accounts jsonb,
  match_score numeric,
  score_components jsonb,
  match_explanation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.campaigns c
    join public.brand_profiles bp on bp.id = c.brand_profile_id
    where c.id = target_campaign_id and bp.user_id = auth.uid()
  ) then raise exception 'Campaign not found or not owned by account'; end if;

  return query
  select
    cp.id, cp.full_name, cp.username, cp.niche, cp.location,
    cp.average_views, cp.engagement_rate, cp.expected_rate_low,
    cp.expected_rate_high, cp.currency, cp.avatar_path,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', sa.platform,
        'audience_count', sa.audience_count,
        'metric_label', sa.metric_label,
        'metric_status', sa.metric_status
      ) order by sa.audience_count desc)
      from public.social_accounts sa
      where sa.creator_profile_id = cp.id and sa.metric_status <> 'UNAVAILABLE'
    ), '[]'::jsonb),
    cm.match_score, cm.score_components, cm.match_explanation
  from public.campaign_matches cm
  join public.creator_profiles cp on cp.id = cm.creator_profile_id and cp.onboarding_complete
  where cm.campaign_id = target_campaign_id
  order by cm.match_score desc;
end;
$$;

revoke all on function public.publish_campaign_and_generate_matches(uuid) from public;
revoke all on function public.creator_opportunities_feed(uuid, integer, integer) from public;
revoke all on function public.creator_discovery_feed(uuid, text, text, text, bigint, bigint, numeric, bigint, numeric, integer, integer) from public;
revoke all on function public.brand_campaign_matches(uuid) from public;
grant execute on function public.publish_campaign_and_generate_matches(uuid) to authenticated;
grant execute on function public.creator_opportunities_feed(uuid, integer, integer) to authenticated;
grant execute on function public.creator_discovery_feed(uuid, text, text, text, bigint, bigint, numeric, bigint, numeric, integer, integer) to authenticated;
grant execute on function public.brand_campaign_matches(uuid) to authenticated;

-- Campaign terms and deliverables are mutated only through validated RPCs.
-- The owner may attach a private asset after the atomic campaign insert.
revoke update on public.campaigns from authenticated;
revoke insert, update, delete on public.campaign_deliverables from authenticated;
revoke delete on public.campaigns from authenticated;

drop policy if exists campaigns_select_participants on public.campaigns;
create policy campaigns_select_authorized on public.campaigns for select to authenticated
using (
  exists (select 1 from public.brand_profiles bp where bp.id = public.campaigns.brand_profile_id and bp.user_id = auth.uid())
  or exists (
    select 1 from public.campaign_matches cm
    join public.creator_profiles cp on cp.id = cm.creator_profile_id
    where cm.campaign_id = public.campaigns.id
      and cp.user_id = auth.uid()
      and public.campaigns.status = 'PUBLISHED'
  )
);

create or replace function public.invalidate_creator_profile_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.campaign_matches where creator_profile_id = new.id;
  return new;
end;
$$;

create or replace function public.invalidate_social_account_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_creator_id uuid;
begin
  affected_creator_id := coalesce(new.creator_profile_id, old.creator_profile_id);
  delete from public.campaign_matches where creator_profile_id = affected_creator_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger creator_profile_matches_invalidate
after update of niche, location, primary_audience_region, engagement_rate,
  expected_rate_low, expected_rate_high, is_discoverable on public.creator_profiles
for each row execute function public.invalidate_creator_profile_matches();

create trigger social_account_matches_invalidate
after insert or update of platform, audience_count, metric_status or delete on public.social_accounts
for each row execute function public.invalidate_social_account_matches();
