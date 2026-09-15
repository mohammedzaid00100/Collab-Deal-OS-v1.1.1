-- Phase 3: transactional structured offers. Negotiation is represented only
-- as versioned term changes and explicit decisions; there is no chat model.

alter table public.offers
add column pending_with public.account_type;

create index offers_pending_with_idx on public.offers (pending_with, status, updated_at desc);

create or replace function public.validate_offer_terms(terms_data jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  selected_deal_type public.deal_type;
  selected_cash bigint;
  selected_product_value bigint;
begin
  if jsonb_typeof(terms_data) <> 'object' then raise exception 'Invalid offer terms'; end if;
  selected_deal_type := (terms_data ->> 'deal_type')::public.deal_type;
  selected_cash := coalesce((terms_data ->> 'cash_payment')::bigint, 0);
  selected_product_value := coalesce((terms_data ->> 'product_value')::bigint, 0);

  if selected_cash not between 0 and 1000000000
     or selected_product_value not between 0 and 1000000000
     or coalesce(nullif(terms_data ->> 'usage_duration_days', '')::integer, 0) not between 0 and 3650
     or coalesce(nullif(terms_data ->> 'exclusivity_duration_days', '')::integer, 0) not between 0 and 3650
     or char_length(trim(coalesce(terms_data ->> 'product_name', ''))) > 120
     or char_length(trim(coalesce(terms_data ->> 'usage_rights', ''))) > 1000
     or char_length(trim(coalesce(terms_data ->> 'territory', ''))) > 160
     or char_length(trim(coalesce(terms_data ->> 'notes', ''))) > 2000 then
    raise exception 'Offer fields are invalid';
  end if;
  if (selected_deal_type = 'PAID' and selected_cash <= 0)
     or (selected_deal_type = 'PRODUCT_ONLY' and selected_product_value <= 0)
     or (selected_deal_type = 'HYBRID' and (selected_cash <= 0 or selected_product_value <= 0)) then
    raise exception 'Deal value does not match the selected deal type';
  end if;
  if selected_product_value > 0 and char_length(trim(coalesce(terms_data ->> 'product_name', ''))) not between 2 and 120 then
    raise exception 'Product name is required when product value is included';
  end if;
  if jsonb_typeof(terms_data -> 'deliverables') <> 'array'
     or jsonb_array_length(terms_data -> 'deliverables') not between 1 and 20 then
    raise exception 'Add between 1 and 20 deliverables';
  end if;
  if exists (
    select 1 from jsonb_array_elements(terms_data -> 'deliverables') item
    where char_length(trim(coalesce(item ->> 'type', ''))) not between 2 and 80
       or coalesce((item ->> 'quantity')::integer, 0) not between 1 and 100
       or char_length(trim(coalesce(item ->> 'notes', ''))) > 300
  ) then raise exception 'Invalid deliverable data'; end if;
  if coalesce((terms_data ->> 'exclusivity')::boolean, false)
     and coalesce(nullif(terms_data ->> 'exclusivity_duration_days', '')::integer, 0) <= 0 then
    raise exception 'Exclusivity duration is required';
  end if;
  if nullif(terms_data ->> 'deadline', '')::timestamptz <= now() then
    raise exception 'Offer deadline must be in the future';
  end if;
end;
$$;

create or replace function public.create_structured_offer(
  target_creator_profile_id uuid,
  target_campaign_id uuid,
  terms_data jsonb,
  send_now boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_brand_id uuid;
  target_creator_user_id uuid;
  new_offer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.validate_offer_terms(terms_data);

  select bp.id into owner_brand_id
  from public.brand_profiles bp
  join public.users u on u.id = bp.user_id and u.account_type = 'brand'
  where bp.user_id = auth.uid() and bp.onboarding_complete;
  if owner_brand_id is null then raise exception 'Completed brand profile required'; end if;

  select cp.user_id into target_creator_user_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id and u.account_type = 'creator'
  where cp.id = target_creator_profile_id and cp.onboarding_complete and cp.is_discoverable;
  if target_creator_user_id is null then raise exception 'Creator profile is unavailable'; end if;

  if target_campaign_id is not null and not exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id and c.brand_profile_id = owner_brand_id and c.status = 'PUBLISHED'
  ) then raise exception 'Offer campaign must be an owned, published campaign'; end if;

  insert into public.offers (
    campaign_id, brand_profile_id, creator_profile_id, cash_payment, currency,
    product_name, product_value, deal_type, deliverables, usage_rights,
    usage_duration_days, paid_ad_rights, exclusivity,
    exclusivity_duration_days, deadline, territory, notes, status, version,
    created_by, sent_at, pending_with
  ) values (
    target_campaign_id, owner_brand_id, target_creator_profile_id,
    (terms_data ->> 'cash_payment')::bigint, 'INR',
    nullif(trim(terms_data ->> 'product_name'), ''),
    (terms_data ->> 'product_value')::bigint,
    (terms_data ->> 'deal_type')::public.deal_type,
    terms_data -> 'deliverables', nullif(trim(terms_data ->> 'usage_rights'), ''),
    nullif(terms_data ->> 'usage_duration_days', '')::integer,
    coalesce((terms_data ->> 'paid_ad_rights')::boolean, false),
    coalesce((terms_data ->> 'exclusivity')::boolean, false),
    nullif(terms_data ->> 'exclusivity_duration_days', '')::integer,
    nullif(terms_data ->> 'deadline', '')::timestamptz,
    nullif(trim(terms_data ->> 'territory'), ''),
    nullif(trim(terms_data ->> 'notes'), ''),
    case when send_now then 'SENT'::public.offer_status else 'DRAFT'::public.offer_status end,
    1, auth.uid(), case when send_now then now() else null end,
    case when send_now then 'creator'::public.account_type else 'brand'::public.account_type end
  ) returning id into new_offer_id;

  if send_now then
    insert into public.notifications (user_id, type, title, body, action_url, metadata)
    values (
      target_creator_user_id, 'NEW_OFFER', 'New structured offer',
      'A brand sent an offer with explicit value, deliverables, rights, and timing.',
      '/creator/offers/' || new_offer_id::text,
      jsonb_build_object('offer_id', new_offer_id, 'version', 1)
    );
  end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), case when send_now then 'OFFER_SENT' else 'OFFER_DRAFT_CREATED' end, 'offer', new_offer_id, jsonb_build_object('version', 1));
  return new_offer_id;
end;
$$;

create or replace function public.send_structured_offer(target_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_creator_user_id uuid;
  current_version integer;
begin
  update public.offers o
  set status = 'SENT', pending_with = 'creator', sent_at = now()
  from public.brand_profiles bp, public.creator_profiles cp
  where o.id = target_offer_id
    and bp.id = o.brand_profile_id and bp.user_id = auth.uid()
    and cp.id = o.creator_profile_id
    and o.status = 'DRAFT'
  returning cp.user_id, o.version into target_creator_user_id, current_version;
  if not found then raise exception 'Only an owned draft offer can be sent'; end if;

  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (
    target_creator_user_id, 'NEW_OFFER', 'New structured offer',
    'A brand sent an offer with explicit value, deliverables, rights, and timing.',
    '/creator/offers/' || target_offer_id::text,
    jsonb_build_object('offer_id', target_offer_id, 'version', current_version)
  );
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_SENT', 'offer', target_offer_id, jsonb_build_object('version', current_version));
end;
$$;

create or replace function public.revise_structured_offer(
  target_offer_id uuid,
  terms_data jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_record public.offers%rowtype;
  brand_user_id uuid;
  creator_user_id uuid;
  actor_role public.account_type;
  recipient_user_id uuid;
  old_snapshot jsonb;
  new_snapshot jsonb;
  changed_fields text[];
  next_version integer;
  next_pending public.account_type;
  next_status public.offer_status;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.validate_offer_terms(terms_data);
  select o.* into offer_record from public.offers o where o.id = target_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  select user_id into brand_user_id from public.brand_profiles where id = offer_record.brand_profile_id;
  select user_id into creator_user_id from public.creator_profiles where id = offer_record.creator_profile_id;
  if auth.uid() = brand_user_id then actor_role := 'brand'; recipient_user_id := creator_user_id;
  elsif auth.uid() = creator_user_id then actor_role := 'creator'; recipient_user_id := brand_user_id;
  else raise exception 'Offer participant required'; end if;

  if offer_record.status = 'DRAFT' then
    if actor_role <> 'brand' then raise exception 'Only the brand can edit a draft offer'; end if;
    next_pending := 'brand'; next_status := 'DRAFT';
  elsif offer_record.status in ('SENT', 'UNDER_REVIEW', 'REVISED') then
    if offer_record.pending_with is distinct from actor_role then raise exception 'Offer is awaiting the other participant'; end if;
    next_pending := case when actor_role = 'brand' then 'creator' else 'brand' end;
    next_status := 'REVISED';
  else raise exception 'This offer can no longer be revised'; end if;

  old_snapshot := jsonb_build_object(
    'cash_payment', offer_record.cash_payment, 'currency', offer_record.currency,
    'product_name', offer_record.product_name, 'product_value', offer_record.product_value,
    'deal_type', offer_record.deal_type, 'deliverables', offer_record.deliverables,
    'usage_rights', offer_record.usage_rights, 'usage_duration_days', offer_record.usage_duration_days,
    'paid_ad_rights', offer_record.paid_ad_rights, 'exclusivity', offer_record.exclusivity,
    'exclusivity_duration_days', offer_record.exclusivity_duration_days,
    'deadline', offer_record.deadline, 'territory', offer_record.territory, 'notes', offer_record.notes
  );
  new_snapshot := jsonb_build_object(
    'cash_payment', (terms_data ->> 'cash_payment')::bigint, 'currency', 'INR',
    'product_name', nullif(trim(terms_data ->> 'product_name'), ''),
    'product_value', (terms_data ->> 'product_value')::bigint,
    'deal_type', (terms_data ->> 'deal_type')::public.deal_type,
    'deliverables', terms_data -> 'deliverables',
    'usage_rights', nullif(trim(terms_data ->> 'usage_rights'), ''),
    'usage_duration_days', nullif(terms_data ->> 'usage_duration_days', '')::integer,
    'paid_ad_rights', coalesce((terms_data ->> 'paid_ad_rights')::boolean, false),
    'exclusivity', coalesce((terms_data ->> 'exclusivity')::boolean, false),
    'exclusivity_duration_days', nullif(terms_data ->> 'exclusivity_duration_days', '')::integer,
    'deadline', nullif(terms_data ->> 'deadline', '')::timestamptz,
    'territory', nullif(trim(terms_data ->> 'territory'), ''),
    'notes', nullif(trim(terms_data ->> 'notes'), '')
  );
  select coalesce(array_agg(entry.key order by entry.key), '{}'::text[]) into changed_fields
  from jsonb_each(new_snapshot) entry
  where entry.value is distinct from old_snapshot -> entry.key;
  if cardinality(changed_fields) = 0 then raise exception 'Change at least one structured term'; end if;
  next_version := offer_record.version + 1;

  update public.offers set
    cash_payment = (new_snapshot ->> 'cash_payment')::bigint,
    product_name = new_snapshot ->> 'product_name',
    product_value = (new_snapshot ->> 'product_value')::bigint,
    deal_type = (new_snapshot ->> 'deal_type')::public.deal_type,
    deliverables = new_snapshot -> 'deliverables', usage_rights = new_snapshot ->> 'usage_rights',
    usage_duration_days = nullif(new_snapshot ->> 'usage_duration_days', '')::integer,
    paid_ad_rights = (new_snapshot ->> 'paid_ad_rights')::boolean,
    exclusivity = (new_snapshot ->> 'exclusivity')::boolean,
    exclusivity_duration_days = nullif(new_snapshot ->> 'exclusivity_duration_days', '')::integer,
    deadline = nullif(new_snapshot ->> 'deadline', '')::timestamptz,
    territory = new_snapshot ->> 'territory', notes = new_snapshot ->> 'notes',
    status = next_status, pending_with = next_pending, version = next_version,
    responded_at = case when next_status = 'DRAFT' then responded_at else now() end
  where id = target_offer_id;

  insert into public.offer_revisions (
    offer_id, from_version, to_version, old_values, new_values, changed_fields, changed_by
  ) values (
    target_offer_id, offer_record.version, next_version, old_snapshot, new_snapshot, changed_fields, auth.uid()
  );

  if next_status <> 'DRAFT' then
    insert into public.notifications (user_id, type, title, body, action_url, metadata)
    values (
      recipient_user_id, 'OFFER_REVISED', 'Offer terms revised',
      'The other participant submitted a structured revision for your decision.',
      case when next_pending = 'creator' then '/creator/offers/' else '/brand/offers/' end || target_offer_id::text,
      jsonb_build_object('offer_id', target_offer_id, 'version', next_version, 'changed_fields', changed_fields)
    );
  end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), case when next_status = 'DRAFT' then 'OFFER_DRAFT_EDITED' else 'OFFER_REVISED' end, 'offer', target_offer_id, jsonb_build_object('version', next_version, 'changed_fields', changed_fields));
  return next_version;
end;
$$;

create or replace function public.mark_offer_under_review(target_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.offers o set status = 'UNDER_REVIEW'
  from public.creator_profiles cp
  where o.id = target_offer_id and cp.id = o.creator_profile_id
    and cp.user_id = auth.uid() and o.pending_with = 'creator'
    and o.status in ('SENT', 'REVISED');
  if not found then raise exception 'Offer is not awaiting creator review'; end if;
end;
$$;

create or replace function public.decide_structured_offer(
  target_offer_id uuid,
  decision text
)
returns public.offer_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_record public.offers%rowtype;
  brand_user_id uuid;
  creator_user_id uuid;
  actor_role public.account_type;
  recipient_user_id uuid;
  next_status public.offer_status;
begin
  if upper(decision) not in ('ACCEPT', 'REJECT') then raise exception 'Decision must be ACCEPT or REJECT'; end if;
  select o.* into offer_record from public.offers o where o.id = target_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  select user_id into brand_user_id from public.brand_profiles where id = offer_record.brand_profile_id;
  select user_id into creator_user_id from public.creator_profiles where id = offer_record.creator_profile_id;
  if auth.uid() = brand_user_id then actor_role := 'brand'; recipient_user_id := creator_user_id;
  elsif auth.uid() = creator_user_id then actor_role := 'creator'; recipient_user_id := brand_user_id;
  else raise exception 'Offer participant required'; end if;
  if offer_record.status not in ('SENT', 'UNDER_REVIEW', 'REVISED')
     or offer_record.pending_with is distinct from actor_role then
    raise exception 'Offer is not awaiting your decision';
  end if;
  next_status := case when upper(decision) = 'ACCEPT' then 'ACCEPTED' else 'REJECTED' end;
  update public.offers set status = next_status, pending_with = null,
    responded_at = now() where id = target_offer_id;
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (
    recipient_user_id,
    case when next_status = 'ACCEPTED' then 'OFFER_ACCEPTED'::public.notification_type else 'OFFER_REJECTED'::public.notification_type end,
    case when next_status = 'ACCEPTED' then 'Offer accepted' else 'Offer rejected' end,
    case when next_status = 'ACCEPTED' then 'The current structured offer was accepted.' else 'The current structured offer was rejected.' end,
    case when actor_role = 'creator' then '/brand/offers/' else '/creator/offers/' end || target_offer_id::text,
    jsonb_build_object('offer_id', target_offer_id, 'version', offer_record.version)
  );
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_' || next_status::text, 'offer', target_offer_id, jsonb_build_object('version', offer_record.version));
  return next_status;
end;
$$;

create or replace function public.complete_structured_offer(target_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.offers o set status = 'COMPLETED', responded_at = now()
  from public.brand_profiles bp
  where o.id = target_offer_id and bp.id = o.brand_profile_id
    and bp.user_id = auth.uid() and o.status = 'ACCEPTED';
  if not found then raise exception 'Only the brand can close an accepted offer'; end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'OFFER_COMPLETED', 'offer', target_offer_id);
end;
$$;

create or replace function public.offers_feed(
  target_offer_id uuid default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  offer_id uuid,
  campaign_id uuid,
  campaign_title text,
  brand_id uuid,
  brand_name text,
  brand_logo_path text,
  creator_id uuid,
  creator_name text,
  creator_username text,
  creator_niche text,
  creator_avatar_path text,
  cash_payment bigint,
  currency char(3),
  product_name text,
  product_value bigint,
  deal_type public.deal_type,
  deliverables jsonb,
  usage_rights text,
  usage_duration_days integer,
  paid_ad_rights boolean,
  exclusivity boolean,
  exclusivity_duration_days integer,
  deadline timestamptz,
  territory text,
  notes text,
  status public.offer_status,
  pending_with public.account_type,
  version integer,
  created_by uuid,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  latest_analysis_score numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select
    o.id, o.campaign_id, c.title, bp.id, bp.brand_name, bp.logo_path,
    cp.id, cp.full_name, cp.username, cp.niche, cp.avatar_path,
    o.cash_payment, o.currency, o.product_name, o.product_value, o.deal_type,
    o.deliverables, o.usage_rights, o.usage_duration_days, o.paid_ad_rights,
    o.exclusivity, o.exclusivity_duration_days, o.deadline, o.territory,
    o.notes, o.status, o.pending_with, o.version, o.created_by, o.sent_at,
    o.responded_at, o.created_at, o.updated_at, analysis.deal_score
  from public.offers o
  join public.brand_profiles bp on bp.id = o.brand_profile_id
  join public.creator_profiles cp on cp.id = o.creator_profile_id
  left join public.campaigns c on c.id = o.campaign_id
  left join lateral (
    select da.deal_score from public.deal_analyses da
    where da.offer_id = o.id and da.requested_by = auth.uid() and da.status = 'COMPLETED'
    order by da.created_at desc limit 1
  ) analysis on true
  where (bp.user_id = auth.uid() or cp.user_id = auth.uid())
    and (target_offer_id is null or o.id = target_offer_id)
  order by o.updated_at desc, o.id
  limit least(greatest(coalesce(result_limit, 50), 1), 100)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;

revoke all on function public.validate_offer_terms(jsonb) from public;
revoke all on function public.create_structured_offer(uuid, uuid, jsonb, boolean) from public;
revoke all on function public.send_structured_offer(uuid) from public;
revoke all on function public.revise_structured_offer(uuid, jsonb) from public;
revoke all on function public.mark_offer_under_review(uuid) from public;
revoke all on function public.decide_structured_offer(uuid, text) from public;
revoke all on function public.complete_structured_offer(uuid) from public;
revoke all on function public.offers_feed(uuid, integer, integer) from public;
grant execute on function public.create_structured_offer(uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.send_structured_offer(uuid) to authenticated;
grant execute on function public.revise_structured_offer(uuid, jsonb) to authenticated;
grant execute on function public.mark_offer_under_review(uuid) to authenticated;
grant execute on function public.decide_structured_offer(uuid, text) to authenticated;
grant execute on function public.complete_structured_offer(uuid) to authenticated;
grant execute on function public.offers_feed(uuid, integer, integer) to authenticated;

revoke insert, update, delete on public.offers, public.offer_revisions from authenticated;
