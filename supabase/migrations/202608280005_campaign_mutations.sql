-- Phase 2: atomic, validated campaign creation. Authenticated clients cannot
-- insert a campaign or its deliverables outside this contract.

create or replace function public.create_campaign_with_deliverables(
  campaign_data jsonb,
  deliverables_data jsonb,
  publish_now boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_brand_id uuid;
  new_campaign_id uuid;
  deliverable jsonb;
  generated_matches integer := 0;
  selected_deal_type public.deal_type;
  selected_budget bigint;
  selected_product_value bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select bp.id into owner_brand_id
  from public.brand_profiles bp
  where bp.user_id = auth.uid() and bp.onboarding_complete
  for update;
  if owner_brand_id is null then raise exception 'Completed brand profile required'; end if;

  if jsonb_typeof(campaign_data) <> 'object' then raise exception 'Invalid campaign data'; end if;
  if jsonb_typeof(deliverables_data) <> 'array'
     or jsonb_array_length(deliverables_data) not between 1 and 20 then
    raise exception 'Add between 1 and 20 deliverables';
  end if;
  if char_length(trim(coalesce(campaign_data ->> 'title', ''))) not between 3 and 160
     or char_length(trim(coalesce(campaign_data ->> 'description', ''))) not between 20 and 3000
     or char_length(trim(coalesce(campaign_data ->> 'platform', ''))) not between 2 and 50
     or char_length(trim(coalesce(campaign_data ->> 'target_creator_niche', ''))) not between 2 and 80
     or char_length(trim(coalesce(campaign_data ->> 'objective', ''))) not between 3 and 300
     or char_length(trim(coalesce(campaign_data ->> 'target_location', ''))) > 100
     or char_length(trim(coalesce(campaign_data ->> 'usage_rights', ''))) > 1000
     or char_length(trim(coalesce(campaign_data ->> 'territory', ''))) > 160
     or char_length(trim(coalesce(campaign_data ->> 'additional_requirements', ''))) > 2000 then
    raise exception 'Campaign fields are incomplete or too long';
  end if;

  selected_deal_type := (campaign_data ->> 'deal_type')::public.deal_type;
  selected_budget := coalesce((campaign_data ->> 'budget')::bigint, 0);
  selected_product_value := coalesce((campaign_data ->> 'product_value')::bigint, 0);
  if selected_budget not between 0 and 1000000000
     or selected_product_value not between 0 and 1000000000
     or coalesce((campaign_data ->> 'target_followers_min')::bigint, -1) not between 0 and 1000000000
     or nullif(campaign_data ->> 'target_followers_max', '')::bigint < coalesce((campaign_data ->> 'target_followers_min')::bigint, 0)
     or nullif(campaign_data ->> 'target_engagement_min', '')::numeric not between 0 and 100
     or nullif(campaign_data ->> 'target_engagement_max', '')::numeric not between coalesce(nullif(campaign_data ->> 'target_engagement_min', '')::numeric, 0) and 100
     or coalesce(nullif(campaign_data ->> 'usage_duration_days', '')::integer, 0) not between 0 and 3650
     or coalesce(nullif(campaign_data ->> 'exclusivity_duration_days', '')::integer, 0) not between 0 and 3650 then
    raise exception 'Campaign numeric fields are invalid';
  end if;
  if (selected_deal_type = 'PAID' and selected_budget <= 0)
     or (selected_deal_type = 'PRODUCT_ONLY' and selected_product_value <= 0)
     or (selected_deal_type = 'HYBRID' and (selected_budget <= 0 or selected_product_value <= 0)) then
    raise exception 'Deal value does not match the selected deal type';
  end if;
  if selected_product_value > 0 and char_length(trim(coalesce(campaign_data ->> 'product_name', ''))) not between 2 and 120 then
    raise exception 'A product name is required when product value is included';
  end if;
  if coalesce((campaign_data ->> 'exclusivity')::boolean, false)
     and coalesce(nullif(campaign_data ->> 'exclusivity_duration_days', '')::integer, 0) <= 0 then
    raise exception 'Exclusivity duration is required';
  end if;

  if exists (
    select 1 from jsonb_array_elements(deliverables_data) item
    where char_length(trim(coalesce(item ->> 'type', ''))) not between 2 and 80
       or coalesce((item ->> 'quantity')::integer, 0) not between 1 and 100
       or char_length(trim(coalesce(item ->> 'notes', ''))) > 300
  ) then raise exception 'Invalid deliverable data'; end if;

  insert into public.campaigns (
    brand_profile_id, title, description, platform, target_creator_niche,
    target_location, target_followers_min, target_followers_max,
    target_engagement_min, target_engagement_max, budget, currency, deal_type,
    product_name, product_value, objective, starts_at, ends_at,
    submission_deadline, usage_rights, usage_duration_days, paid_ad_rights,
    exclusivity, exclusivity_duration_days, territory, additional_requirements
  ) values (
    owner_brand_id, trim(campaign_data ->> 'title'), trim(campaign_data ->> 'description'),
    trim(campaign_data ->> 'platform'), trim(campaign_data ->> 'target_creator_niche'),
    nullif(trim(campaign_data ->> 'target_location'), ''),
    (campaign_data ->> 'target_followers_min')::bigint,
    nullif(campaign_data ->> 'target_followers_max', '')::bigint,
    nullif(campaign_data ->> 'target_engagement_min', '')::numeric,
    nullif(campaign_data ->> 'target_engagement_max', '')::numeric,
    selected_budget, 'INR', selected_deal_type,
    nullif(trim(campaign_data ->> 'product_name'), ''), selected_product_value,
    trim(campaign_data ->> 'objective'), nullif(campaign_data ->> 'starts_at', '')::date,
    nullif(campaign_data ->> 'ends_at', '')::date,
    nullif(campaign_data ->> 'submission_deadline', '')::timestamptz,
    nullif(trim(campaign_data ->> 'usage_rights'), ''),
    nullif(campaign_data ->> 'usage_duration_days', '')::integer,
    coalesce((campaign_data ->> 'paid_ad_rights')::boolean, false),
    coalesce((campaign_data ->> 'exclusivity')::boolean, false),
    nullif(campaign_data ->> 'exclusivity_duration_days', '')::integer,
    nullif(trim(campaign_data ->> 'territory'), ''),
    nullif(trim(campaign_data ->> 'additional_requirements'), '')
  ) returning id into new_campaign_id;

  for deliverable in select value from jsonb_array_elements(deliverables_data)
  loop
    insert into public.campaign_deliverables (campaign_id, deliverable_type, quantity, notes, position)
    values (
      new_campaign_id, trim(deliverable ->> 'type'), (deliverable ->> 'quantity')::smallint,
      nullif(trim(deliverable ->> 'notes'), ''),
      (select count(*) from public.campaign_deliverables where campaign_id = new_campaign_id)
    );
  end loop;

  if publish_now then
    generated_matches := public.publish_campaign_and_generate_matches(new_campaign_id);
  end if;

  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'CAMPAIGN_CREATED', 'campaign', new_campaign_id,
    jsonb_build_object('published', publish_now, 'deliverables', jsonb_array_length(deliverables_data))
  );

  return jsonb_build_object(
    'campaign_id', new_campaign_id,
    'status', case when publish_now then 'PUBLISHED' else 'DRAFT' end,
    'matches', generated_matches
  );
end;
$$;

revoke all on function public.create_campaign_with_deliverables(jsonb, jsonb, boolean) from public;
grant execute on function public.create_campaign_with_deliverables(jsonb, jsonb, boolean) to authenticated;
revoke insert on public.campaigns, public.campaign_deliverables from authenticated;
