create or replace function public.complete_creator_onboarding(profile_data jsonb, social_data jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
     or lower(trim(coalesce(profile_data ->> 'username', ''))) !~ '^[a-z0-9._]{3,30}$'
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
       select 1
       from jsonb_array_elements(social_data) entry
       where nullif(trim(entry ->> 'profile_url'), '') is not null
     ) then
    raise exception 'Add at least one social media profile URL';
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
      or nullif(entry ->> 'profile_url', '') is null
      or entry ->> 'profile_url' !~* '^https://'
      or (upper(trim(entry ->> 'platform')) = 'INSTAGRAM' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?instagram\.com/[^/?#]+')
      or (upper(trim(entry ->> 'platform')) = 'FACEBOOK' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?(facebook|fb)\.com/')
      or (upper(trim(entry ->> 'platform')) = 'YOUTUBE' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?(youtube\.com|youtu\.be)/')
      or (upper(trim(entry ->> 'platform')) = 'TIKTOK' and entry ->> 'profile_url' !~* '^https://([^/]+\.)?tiktok\.com/')
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
$function$;
