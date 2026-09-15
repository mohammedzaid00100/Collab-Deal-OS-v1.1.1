-- Phase 3 hardening: private drafts, optimistic concurrency, immutable shared
-- status events, mandatory live deadlines, and idempotent offer creation.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create or replace function public.sha256_text(input_value text)
returns text
language plpgsql
stable
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

alter table public.offers
  add column creation_command_id uuid not null default gen_random_uuid(),
  add column creation_request_hash text,
  add column accepted_at timestamptz,
  add column rejected_at timestamptz,
  add column completed_at timestamptz;

-- Preserve legacy timestamps while normalizing state. The standard updated_at
-- trigger would otherwise rewrite history to the migration timestamp.
alter table public.offers disable trigger offers_set_updated_at;
update public.offers set creation_request_hash = public.sha256_text(creation_command_id::text);
alter table public.offers alter column creation_request_hash set not null;
alter table public.offers add constraint offer_creation_request_hash_valid
check (creation_request_hash ~ '^[0-9a-f]{64}$');

create unique index offers_actor_creation_command_idx
on public.offers (created_by, creation_command_id);

update public.offers set pending_with = 'brand' where status = 'DRAFT';
update public.offers set pending_with = 'creator' where status in ('SENT', 'UNDER_REVIEW');
update public.offers o set pending_with = case
  when (
    select r.changed_by from public.offer_revisions r
    where r.offer_id = o.id order by r.to_version desc limit 1
  ) = (select bp.user_id from public.brand_profiles bp where bp.id = o.brand_profile_id) then 'creator'::public.account_type
  when (
    select r.changed_by from public.offer_revisions r
    where r.offer_id = o.id order by r.to_version desc limit 1
  ) = (select cp.user_id from public.creator_profiles cp where cp.id = o.creator_profile_id) then 'brand'::public.account_type
  else 'brand'::public.account_type
end where status = 'REVISED' and pending_with is null;
update public.offers set pending_with = null where status in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED');
update public.offers o set accepted_at = coalesce(
  (select max(al.created_at) from public.activity_log al where al.entity_type = 'offer' and al.entity_id = o.id and al.event_type = 'OFFER_ACCEPTED'),
  o.responded_at, o.updated_at
) where o.status in ('ACCEPTED', 'COMPLETED');
update public.offers o set rejected_at = coalesce(
  (select max(al.created_at) from public.activity_log al where al.entity_type = 'offer' and al.entity_id = o.id and al.event_type = 'OFFER_REJECTED'),
  o.responded_at, o.updated_at
) where o.status = 'REJECTED';
update public.offers o set completed_at = coalesce(
  (select max(al.created_at) from public.activity_log al where al.entity_type = 'offer' and al.entity_id = o.id and al.event_type = 'OFFER_COMPLETED'),
  o.updated_at
) where o.status = 'COMPLETED';
create temporary table offer_expiry_backfill as
select o.id, o.status as from_status, now() as quarantined_at
from public.offers o where o.status in ('DRAFT', 'SENT', 'UNDER_REVIEW', 'REVISED')
  and (o.deadline is null or o.deadline <= now());
update public.offers set status = 'EXPIRED', pending_with = null
where id in (select id from offer_expiry_backfill);
update public.offers set deadline = updated_at where deadline is null;
alter table public.offers enable trigger offers_set_updated_at;

-- Draft edits created by the superseded Phase 3 function must never become
-- visible after send. They are identifiable because they predate sent_at (or
-- belong to an offer that was never sent).
drop trigger offer_revisions_immutable on public.offer_revisions;
delete from public.offer_revisions r using public.offers o
where r.offer_id = o.id and (o.sent_at is null or r.created_at < o.sent_at);
create trigger offer_revisions_immutable
before update or delete on public.offer_revisions
for each row execute function public.prevent_immutable_record_change();

alter table public.offers
  add constraint offer_pending_state_consistent check (
    (status = 'DRAFT' and pending_with = 'brand')
    or (status in ('SENT', 'UNDER_REVIEW') and pending_with = 'creator')
    or (status = 'REVISED' and pending_with is not null)
    or (status in ('ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED') and pending_with is null)
  ),
  add constraint offer_terminal_timestamps_consistent check (
    (status not in ('ACCEPTED', 'COMPLETED') or accepted_at is not null)
    and (status <> 'REJECTED' or rejected_at is not null)
    and (status <> 'COMPLETED' or completed_at is not null)
  ),
  add constraint offer_deadline_required check (deadline is not null);

create table public.offer_events (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.offers(id) on delete restrict,
  event_type text not null check (event_type in (
    'DRAFT_CREATED', 'DRAFT_UPDATED', 'SENT', 'UNDER_REVIEW', 'REVISED',
    'ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED'
  )),
  from_status public.offer_status,
  to_status public.offer_status not null,
  actor_user_id uuid references public.users(id) on delete restrict,
  version integer not null check (version >= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index offer_events_offer_created_idx on public.offer_events (offer_id, created_at desc);
create trigger offer_events_immutable before update or delete on public.offer_events
for each row execute function public.prevent_immutable_record_change();
alter table public.offer_events enable row level security;

-- Earlier migrations did not have a status-event table. Preserve only the
-- known current state and mark it explicitly rather than fabricating actors or
-- an unobserved transition chain.
insert into public.offer_events (
  offer_id, event_type, from_status, to_status, actor_user_id, version, metadata, created_at
)
select o.id, o.status::text, q.from_status, o.status, null, o.version,
  jsonb_build_object('backfilled', true, 'history_completeness',
    case when q.id is null then 'CURRENT_STATE_ONLY' else 'MIGRATION_EXPIRY' end),
  coalesce(q.quarantined_at, o.updated_at)
from public.offers o left join offer_expiry_backfill q on q.id = o.id
where o.status <> 'DRAFT';
drop table offer_expiry_backfill;

drop policy if exists offers_select_participants on public.offers;
create policy offers_select_participants on public.offers for select to authenticated
using (
  exists (select 1 from public.brand_profiles bp where bp.id = brand_profile_id and bp.user_id = auth.uid())
  or (
    status <> 'DRAFT' and sent_at is not null
    and exists (select 1 from public.creator_profiles cp where cp.id = creator_profile_id and cp.user_id = auth.uid())
  )
);

drop policy if exists offer_revisions_select_participants on public.offer_revisions;
create policy offer_revisions_select_participants on public.offer_revisions for select to authenticated
using (exists (select 1 from public.offers o where o.id = offer_id));

create policy offer_events_select_participants on public.offer_events for select to authenticated
using (exists (select 1 from public.offers o where o.id = offer_id));

grant select on public.offer_events to authenticated;
revoke insert, update, delete on public.offer_events from authenticated;

create index deal_analyses_offer_requester_completed_idx
on public.deal_analyses (offer_id, requested_by, created_at desc)
where status = 'COMPLETED';

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
  selected_deadline timestamptz;
begin
  if jsonb_typeof(terms_data) <> 'object'
     or terms_data ->> 'deal_type' is null
     or terms_data -> 'deliverables' is null
     or nullif(terms_data ->> 'deadline', '') is null then
    raise exception 'Required offer terms are missing';
  end if;
  selected_deal_type := (terms_data ->> 'deal_type')::public.deal_type;
  selected_cash := coalesce((terms_data ->> 'cash_payment')::bigint, 0);
  selected_product_value := coalesce((terms_data ->> 'product_value')::bigint, 0);
  selected_deadline := (terms_data ->> 'deadline')::timestamptz;
  if selected_deadline <= now() then raise exception 'Offer deadline must be in the future'; end if;
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
  if not coalesce((terms_data ->> 'exclusivity')::boolean, false)
     and coalesce(nullif(terms_data ->> 'exclusivity_duration_days', '')::integer, 0) > 0 then
    raise exception 'Exclusivity duration requires exclusivity';
  end if;
end;
$$;

create or replace function public.normalized_offer_terms(terms_data jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.validate_offer_terms(terms_data);
  return jsonb_build_object(
    'cash_payment', coalesce((terms_data ->> 'cash_payment')::bigint, 0),
    'currency', 'INR', 'product_name', nullif(trim(terms_data ->> 'product_name'), ''),
    'product_value', coalesce((terms_data ->> 'product_value')::bigint, 0),
    'deal_type', (terms_data ->> 'deal_type')::public.deal_type,
    'deliverables', terms_data -> 'deliverables',
    'usage_rights', nullif(trim(terms_data ->> 'usage_rights'), ''),
    'usage_duration_days', nullif(terms_data ->> 'usage_duration_days', '')::integer,
    'paid_ad_rights', coalesce((terms_data ->> 'paid_ad_rights')::boolean, false),
    'exclusivity', coalesce((terms_data ->> 'exclusivity')::boolean, false),
    'exclusivity_duration_days', nullif(terms_data ->> 'exclusivity_duration_days', '')::integer,
    'deadline', (terms_data ->> 'deadline')::timestamptz,
    'territory', nullif(trim(terms_data ->> 'territory'), ''),
    'notes', nullif(trim(terms_data ->> 'notes'), '')
  );
end;
$$;

drop function public.create_structured_offer(uuid, uuid, jsonb, boolean);
drop function public.send_structured_offer(uuid);
drop function public.revise_structured_offer(uuid, jsonb);
drop function public.mark_offer_under_review(uuid);
drop function public.decide_structured_offer(uuid, text);
drop function public.complete_structured_offer(uuid);

create or replace function public.create_structured_offer(
  target_creator_profile_id uuid,
  target_campaign_id uuid,
  terms_data jsonb,
  send_now boolean,
  client_command_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_brand_id uuid;
  target_creator_user_id uuid;
  normalized jsonb;
  request_fingerprint jsonb;
  request_hash text;
  stored_hash text;
  new_offer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if client_command_id is null then raise exception 'Creation command ID is required'; end if;
  if send_now is null then raise exception 'Send choice is required'; end if;
  -- The idempotency identity is deliberately time-invariant. Live deadline
  -- validation runs only for a new command, so a byte-equivalent retry can
  -- still retrieve its original result after that deadline has passed.
  request_fingerprint := jsonb_build_object(
    'creator_profile_id', target_creator_profile_id,
    'campaign_id', target_campaign_id,
    'terms', terms_data,
    'send_now', send_now
  );
  request_hash := public.sha256_text(request_fingerprint::text);
  select o.id, o.creation_request_hash into new_offer_id, stored_hash from public.offers o
  where o.created_by = auth.uid() and o.creation_command_id = client_command_id;
  if new_offer_id is not null then
    if stored_hash is distinct from request_hash then
      raise exception 'Creation command was already used for different offer data';
    end if;
    return new_offer_id;
  end if;
  -- Serialize exact command IDs before time-sensitive validation. This makes
  -- an in-flight duplicate wait for and return the original result, including
  -- when the deadline crosses while that original transaction commits.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || client_command_id::text, 0)
  );
  select o.id, o.creation_request_hash into new_offer_id, stored_hash from public.offers o
  where o.created_by = auth.uid() and o.creation_command_id = client_command_id;
  if new_offer_id is not null then
    if stored_hash is distinct from request_hash then
      raise exception 'Creation command was already used for different offer data';
    end if;
    return new_offer_id;
  end if;
  normalized := public.normalized_offer_terms(terms_data);

  select bp.id into owner_brand_id
  from public.brand_profiles bp
  join public.users u on u.id = bp.user_id and u.account_type = 'brand'
  where bp.user_id = auth.uid() and bp.onboarding_complete
  for share of bp;
  if owner_brand_id is null then raise exception 'Completed brand profile required'; end if;

  select cp.user_id into target_creator_user_id
  from public.creator_profiles cp
  join public.users u on u.id = cp.user_id and u.account_type = 'creator'
  where cp.id = target_creator_profile_id and cp.onboarding_complete and cp.is_discoverable
  for share of cp;
  if target_creator_user_id is null then raise exception 'Creator profile is unavailable'; end if;

  if target_campaign_id is not null then
    perform 1 from public.campaigns c
    where c.id = target_campaign_id and c.brand_profile_id = owner_brand_id and c.status = 'PUBLISHED'
    for share of c;
    if not found then raise exception 'Offer campaign must be an owned, published campaign'; end if;
  end if;
  if send_now then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':offer-send', 0));
    -- Recheck after the per-actor lock so a concurrent retry of the same
    -- command remains idempotent instead of being mistaken for a 21st send.
    select o.id, o.creation_request_hash into new_offer_id, stored_hash from public.offers o
    where o.created_by = auth.uid() and o.creation_command_id = client_command_id;
    if new_offer_id is not null then
      if stored_hash is distinct from request_hash then
        raise exception 'Creation command was already used for different offer data';
      end if;
      return new_offer_id;
    end if;
    if (
      select count(*) from public.offers o
      where o.created_by = auth.uid() and o.sent_at > now() - interval '1 hour'
    ) >= 20 then raise exception 'Offer send rate limit reached. Try again later'; end if;
  end if;

  insert into public.offers (
    campaign_id, brand_profile_id, creator_profile_id, cash_payment, currency,
    product_name, product_value, deal_type, deliverables, usage_rights,
    usage_duration_days, paid_ad_rights, exclusivity, exclusivity_duration_days,
    deadline, territory, notes, status, version, created_by, sent_at,
    pending_with, creation_command_id, creation_request_hash
  ) values (
    target_campaign_id, owner_brand_id, target_creator_profile_id,
    (normalized ->> 'cash_payment')::bigint, 'INR', normalized ->> 'product_name',
    (normalized ->> 'product_value')::bigint,
    (normalized ->> 'deal_type')::public.deal_type, normalized -> 'deliverables',
    normalized ->> 'usage_rights', nullif(normalized ->> 'usage_duration_days', '')::integer,
    (normalized ->> 'paid_ad_rights')::boolean, (normalized ->> 'exclusivity')::boolean,
    nullif(normalized ->> 'exclusivity_duration_days', '')::integer,
    (normalized ->> 'deadline')::timestamptz, normalized ->> 'territory', normalized ->> 'notes',
    case when send_now then 'SENT'::public.offer_status else 'DRAFT'::public.offer_status end,
    1, auth.uid(), case when send_now then now() else null end,
    case when send_now then 'creator'::public.account_type else 'brand'::public.account_type end,
    client_command_id, request_hash
  ) on conflict (created_by, creation_command_id) do nothing returning id into new_offer_id;
  if new_offer_id is null then
    select id, creation_request_hash into new_offer_id, stored_hash from public.offers
    where created_by = auth.uid() and creation_command_id = client_command_id;
    if stored_hash is distinct from request_hash then
      raise exception 'Creation command was already used for different offer data';
    end if;
    return new_offer_id;
  end if;

  if send_now then
    insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
    values (new_offer_id, 'SENT', null, 'SENT', auth.uid(), 1);
    insert into public.notifications (user_id, type, title, body, action_url, metadata)
    values (target_creator_user_id, 'NEW_OFFER', 'New structured offer',
      'A brand sent an offer with explicit value, deliverables, rights, and timing.',
      '/creator/offers/' || new_offer_id::text, jsonb_build_object('offer_id', new_offer_id, 'version', 1));
  end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), case when send_now then 'OFFER_SENT' else 'OFFER_DRAFT_CREATED' end, 'offer', new_offer_id, jsonb_build_object('version', 1));
  return new_offer_id;
end;
$$;

create or replace function public.update_draft_structured_offer(
  target_offer_id uuid,
  expected_version integer,
  terms_data jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized jsonb;
  next_version integer;
begin
  normalized := public.normalized_offer_terms(terms_data);
  update public.offers o set
    cash_payment = (normalized ->> 'cash_payment')::bigint,
    product_name = normalized ->> 'product_name', product_value = (normalized ->> 'product_value')::bigint,
    deal_type = (normalized ->> 'deal_type')::public.deal_type, deliverables = normalized -> 'deliverables',
    usage_rights = normalized ->> 'usage_rights', usage_duration_days = nullif(normalized ->> 'usage_duration_days', '')::integer,
    paid_ad_rights = (normalized ->> 'paid_ad_rights')::boolean, exclusivity = (normalized ->> 'exclusivity')::boolean,
    exclusivity_duration_days = nullif(normalized ->> 'exclusivity_duration_days', '')::integer,
    deadline = (normalized ->> 'deadline')::timestamptz, territory = normalized ->> 'territory', notes = normalized ->> 'notes',
    version = o.version + 1
  from public.brand_profiles bp
  where o.id = target_offer_id and bp.id = o.brand_profile_id and bp.user_id = auth.uid()
    and o.status = 'DRAFT' and o.version = expected_version
  returning o.version into next_version;
  if not found then raise exception 'Draft is stale, unavailable, or not owned by account'; end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_DRAFT_EDITED', 'offer', target_offer_id, jsonb_build_object('version', next_version));
  return next_version;
end;
$$;

create or replace function public.send_structured_offer(target_offer_id uuid, expected_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  offer_record public.offers%rowtype;
  target_creator_user_id uuid;
begin
  select o.* into offer_record
  from public.offers o
  join public.brand_profiles bp on bp.id = o.brand_profile_id and bp.user_id = auth.uid()
  join public.creator_profiles cp on cp.id = o.creator_profile_id and cp.onboarding_complete and cp.is_discoverable
  where o.id = target_offer_id and o.status = 'DRAFT' and o.version = expected_version
  for update of o;
  if not found then raise exception 'Draft is stale, unavailable, or not owned by account'; end if;
  select cp.user_id into target_creator_user_id
  from public.creator_profiles cp where cp.id = offer_record.creator_profile_id;
  if offer_record.deadline is null or offer_record.deadline <= now() then raise exception 'Offer deadline must be in the future'; end if;
  if offer_record.campaign_id is not null then
    perform 1 from public.campaigns c where c.id = offer_record.campaign_id and c.status = 'PUBLISHED' for share of c;
    if not found then raise exception 'Linked campaign is no longer published'; end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':offer-send', 0));
  if (select count(*) from public.offers o where o.created_by = auth.uid() and o.sent_at > now() - interval '1 hour') >= 20 then
    raise exception 'Offer send rate limit reached. Try again later';
  end if;
  update public.offers set status = 'SENT', pending_with = 'creator', sent_at = now() where id = target_offer_id;
  insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
  values (target_offer_id, 'SENT', 'DRAFT', 'SENT', auth.uid(), expected_version);
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (target_creator_user_id, 'NEW_OFFER', 'New structured offer',
    'A brand sent an offer with explicit value, deliverables, rights, and timing.',
    '/creator/offers/' || target_offer_id::text, jsonb_build_object('offer_id', target_offer_id, 'version', expected_version));
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_SENT', 'offer', target_offer_id, jsonb_build_object('version', expected_version));
end;
$$;

create or replace function public.revise_structured_offer(
  target_offer_id uuid,
  expected_version integer,
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
begin
  new_snapshot := public.normalized_offer_terms(terms_data);
  select o.* into offer_record
  from public.offers o
  join public.brand_profiles bp on bp.id = o.brand_profile_id
  join public.creator_profiles cp on cp.id = o.creator_profile_id
  where o.id = target_offer_id and o.version = expected_version
    and (bp.user_id = auth.uid() or cp.user_id = auth.uid())
  for update of o;
  if not found then raise exception 'Offer is stale, unavailable, or not authorized'; end if;
  select bp.user_id into brand_user_id from public.brand_profiles bp where bp.id = offer_record.brand_profile_id;
  select cp.user_id into creator_user_id from public.creator_profiles cp where cp.id = offer_record.creator_profile_id;
  if auth.uid() = brand_user_id then actor_role := 'brand'; recipient_user_id := creator_user_id;
  else actor_role := 'creator'; recipient_user_id := brand_user_id; end if;
  if offer_record.status not in ('SENT', 'UNDER_REVIEW', 'REVISED')
     or offer_record.pending_with is distinct from actor_role then
    raise exception 'Offer is not awaiting your revision';
  end if;
  if offer_record.deadline is null or offer_record.deadline <= now() then raise exception 'Offer has expired'; end if;
  old_snapshot := jsonb_build_object(
    'cash_payment', offer_record.cash_payment, 'currency', offer_record.currency,
    'product_name', offer_record.product_name, 'product_value', offer_record.product_value,
    'deal_type', offer_record.deal_type, 'deliverables', offer_record.deliverables,
    'usage_rights', offer_record.usage_rights, 'usage_duration_days', offer_record.usage_duration_days,
    'paid_ad_rights', offer_record.paid_ad_rights, 'exclusivity', offer_record.exclusivity,
    'exclusivity_duration_days', offer_record.exclusivity_duration_days,
    'deadline', offer_record.deadline, 'territory', offer_record.territory, 'notes', offer_record.notes
  );
  select coalesce(array_agg(entry.key order by entry.key), '{}'::text[]) into changed_fields
  from jsonb_each(new_snapshot) entry where entry.value is distinct from old_snapshot -> entry.key;
  if cardinality(changed_fields) = 0 then raise exception 'Change at least one structured term'; end if;
  if changed_fields <@ array['notes']::text[] then raise exception 'A revision must change a deal term, not only free-text context'; end if;
  next_version := offer_record.version + 1;
  next_pending := case when actor_role = 'brand' then 'creator' else 'brand' end;
  update public.offers set
    cash_payment = (new_snapshot ->> 'cash_payment')::bigint,
    product_name = new_snapshot ->> 'product_name', product_value = (new_snapshot ->> 'product_value')::bigint,
    deal_type = (new_snapshot ->> 'deal_type')::public.deal_type, deliverables = new_snapshot -> 'deliverables',
    usage_rights = new_snapshot ->> 'usage_rights', usage_duration_days = nullif(new_snapshot ->> 'usage_duration_days', '')::integer,
    paid_ad_rights = (new_snapshot ->> 'paid_ad_rights')::boolean, exclusivity = (new_snapshot ->> 'exclusivity')::boolean,
    exclusivity_duration_days = nullif(new_snapshot ->> 'exclusivity_duration_days', '')::integer,
    deadline = (new_snapshot ->> 'deadline')::timestamptz, territory = new_snapshot ->> 'territory', notes = new_snapshot ->> 'notes',
    status = 'REVISED', pending_with = next_pending, version = next_version
  where id = target_offer_id;
  insert into public.offer_revisions (offer_id, from_version, to_version, old_values, new_values, changed_fields, changed_by)
  values (target_offer_id, offer_record.version, next_version, old_snapshot, new_snapshot, changed_fields, auth.uid());
  insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version, metadata)
  values (target_offer_id, 'REVISED', offer_record.status, 'REVISED', auth.uid(), next_version, jsonb_build_object('changed_fields', changed_fields));
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (recipient_user_id, 'OFFER_REVISED', 'Offer terms revised',
    'The other participant submitted a structured revision for your decision.',
    case when next_pending = 'creator' then '/creator/offers/' else '/brand/offers/' end || target_offer_id::text,
    jsonb_build_object('offer_id', target_offer_id, 'version', next_version, 'changed_fields', changed_fields));
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_REVISED', 'offer', target_offer_id, jsonb_build_object('version', next_version, 'changed_fields', changed_fields));
  return next_version;
end;
$$;

create or replace function public.mark_offer_under_review(target_offer_id uuid, expected_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.offer_status;
begin
  select o.status into old_status
  from public.offers o
  join public.creator_profiles cp on cp.id = o.creator_profile_id and cp.user_id = auth.uid()
  where o.id = target_offer_id and o.pending_with = 'creator'
    and o.status in ('SENT', 'REVISED') and o.version = expected_version
    and o.deadline > now()
  for update of o;
  if not found then raise exception 'Offer is stale or not awaiting creator review'; end if;
  update public.offers set status = 'UNDER_REVIEW' where id = target_offer_id;
  insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
  values (target_offer_id, 'UNDER_REVIEW', old_status, 'UNDER_REVIEW', auth.uid(), expected_version);
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_UNDER_REVIEW', 'offer', target_offer_id, jsonb_build_object('version', expected_version));
end;
$$;

create or replace function public.decide_structured_offer(
  target_offer_id uuid,
  expected_version integer,
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
  normalized_decision text;
  next_status public.offer_status;
begin
  normalized_decision := upper(trim(decision));
  if decision is null or normalized_decision not in ('ACCEPT', 'REJECT') then
    raise exception 'Decision must be ACCEPT or REJECT';
  end if;
  select o.* into offer_record
  from public.offers o
  join public.brand_profiles bp on bp.id = o.brand_profile_id
  join public.creator_profiles cp on cp.id = o.creator_profile_id
  where o.id = target_offer_id and o.version = expected_version
    and (bp.user_id = auth.uid() or cp.user_id = auth.uid())
  for update of o;
  if not found then raise exception 'Offer is stale, unavailable, or not authorized'; end if;
  select bp.user_id into brand_user_id from public.brand_profiles bp where bp.id = offer_record.brand_profile_id;
  select cp.user_id into creator_user_id from public.creator_profiles cp where cp.id = offer_record.creator_profile_id;
  if auth.uid() = brand_user_id then actor_role := 'brand'; recipient_user_id := creator_user_id;
  else actor_role := 'creator'; recipient_user_id := brand_user_id; end if;
  if offer_record.status not in ('SENT', 'UNDER_REVIEW', 'REVISED')
     or offer_record.pending_with is distinct from actor_role then
    raise exception 'Offer is not awaiting your decision';
  end if;
  if offer_record.deadline is null or offer_record.deadline <= now() then
    update public.offers set status = 'EXPIRED', pending_with = null where id = target_offer_id;
    insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
    values (target_offer_id, 'EXPIRED', offer_record.status, 'EXPIRED', null, offer_record.version);
    insert into public.notifications (user_id, type, title, body, action_url, metadata)
    values
      (brand_user_id, 'ACCOUNT_ALERT', 'Offer expired', 'The structured offer deadline passed before a decision was recorded.',
       '/brand/offers/' || target_offer_id::text, jsonb_build_object('offer_id', target_offer_id, 'version', offer_record.version)),
      (creator_user_id, 'ACCOUNT_ALERT', 'Offer expired', 'The structured offer deadline passed before a decision was recorded.',
       '/creator/offers/' || target_offer_id::text, jsonb_build_object('offer_id', target_offer_id, 'version', offer_record.version));
    insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (null, 'OFFER_EXPIRED', 'offer', target_offer_id, jsonb_build_object('version', offer_record.version));
    return 'EXPIRED';
  end if;
  next_status := case when normalized_decision = 'ACCEPT' then 'ACCEPTED' else 'REJECTED' end;
  update public.offers set status = next_status, pending_with = null,
    responded_at = now(),
    accepted_at = case when next_status = 'ACCEPTED' then now() else accepted_at end,
    rejected_at = case when next_status = 'REJECTED' then now() else rejected_at end
  where id = target_offer_id;
  insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
  values (target_offer_id, next_status::text, offer_record.status, next_status, auth.uid(), offer_record.version);
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (recipient_user_id,
    case when next_status = 'ACCEPTED' then 'OFFER_ACCEPTED'::public.notification_type else 'OFFER_REJECTED'::public.notification_type end,
    case when next_status = 'ACCEPTED' then 'Offer accepted' else 'Offer rejected' end,
    case when next_status = 'ACCEPTED' then 'The current structured offer was accepted.' else 'The current structured offer was rejected.' end,
    case when actor_role = 'creator' then '/brand/offers/' else '/creator/offers/' end || target_offer_id::text,
    jsonb_build_object('offer_id', target_offer_id, 'version', offer_record.version));
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_' || next_status::text, 'offer', target_offer_id, jsonb_build_object('version', offer_record.version));
  return next_status;
end;
$$;

create or replace function public.complete_structured_offer(target_offer_id uuid, expected_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_user_id uuid;
begin
  update public.offers o set status = 'COMPLETED', completed_at = now()
  from public.brand_profiles bp, public.creator_profiles cp
  where o.id = target_offer_id and bp.id = o.brand_profile_id and bp.user_id = auth.uid()
    and cp.id = o.creator_profile_id and o.status = 'ACCEPTED' and o.version = expected_version
  returning cp.user_id into creator_user_id;
  if not found then raise exception 'Accepted offer is stale, unavailable, or not owned by account'; end if;
  insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
  values (target_offer_id, 'COMPLETED', 'ACCEPTED', 'COMPLETED', auth.uid(), expected_version);
  insert into public.notifications (user_id, type, title, body, action_url, metadata)
  values (creator_user_id, 'ACCOUNT_ALERT', 'Deal marked complete',
    'The brand marked the accepted collaboration as completed.',
    '/creator/offers/' || target_offer_id::text, jsonb_build_object('offer_id', target_offer_id, 'version', expected_version));
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (auth.uid(), 'OFFER_COMPLETED', 'offer', target_offer_id, jsonb_build_object('version', expected_version));
end;
$$;

create or replace function public.expire_due_participant_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired record;
  expired_count integer := 0;
begin
  for expired in
    select o.id, o.status, o.version from public.offers o
    where o.status in ('SENT', 'UNDER_REVIEW', 'REVISED')
      and o.deadline <= now()
      and (
        exists (select 1 from public.brand_profiles bp where bp.id = o.brand_profile_id and bp.user_id = auth.uid())
        or exists (select 1 from public.creator_profiles cp where cp.id = o.creator_profile_id and cp.user_id = auth.uid())
      )
    for update of o skip locked
  loop
    update public.offers set status = 'EXPIRED', pending_with = null where id = expired.id;
    insert into public.offer_events (offer_id, event_type, from_status, to_status, actor_user_id, version)
    values (expired.id, 'EXPIRED', expired.status, 'EXPIRED', null, expired.version);
    insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
    values (null, 'OFFER_EXPIRED', 'offer', expired.id, jsonb_build_object('version', expired.version));
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

create or replace function public.offers_feed(
  target_offer_id uuid default null,
  result_limit integer default 50,
  result_offset integer default 0
)
returns table (
  offer_id uuid, campaign_id uuid, campaign_title text, brand_id uuid,
  brand_name text, brand_logo_path text, creator_id uuid, creator_name text,
  creator_username text, creator_niche text, creator_avatar_path text,
  cash_payment bigint, currency char(3), product_name text, product_value bigint,
  deal_type public.deal_type, deliverables jsonb, usage_rights text,
  usage_duration_days integer, paid_ad_rights boolean, exclusivity boolean,
  exclusivity_duration_days integer, deadline timestamptz, territory text,
  notes text, status public.offer_status, pending_with public.account_type,
  version integer, created_by uuid, sent_at timestamptz, responded_at timestamptz,
  created_at timestamptz, updated_at timestamptz, latest_analysis_score numeric
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_due_participant_offers();
  return query
  select o.id, o.campaign_id, c.title, bp.id, bp.brand_name, bp.logo_path,
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
    where da.offer_id = o.id and da.offer_version = o.version
      and da.requested_by = auth.uid() and da.status = 'COMPLETED'
    order by da.created_at desc limit 1
  ) analysis on true
  where (
    bp.user_id = auth.uid()
    or (cp.user_id = auth.uid() and o.status <> 'DRAFT' and o.sent_at is not null)
  ) and (target_offer_id is null or o.id = target_offer_id)
  order by o.updated_at desc, o.id
  limit least(greatest(coalesce(result_limit, 50), 1), 100)
  offset greatest(coalesce(result_offset, 0), 0);
end;
$$;

revoke all on function public.normalized_offer_terms(jsonb) from public, anon, authenticated;
revoke all on function public.create_structured_offer(uuid, uuid, jsonb, boolean, uuid) from public, anon;
revoke all on function public.update_draft_structured_offer(uuid, integer, jsonb) from public, anon;
revoke all on function public.send_structured_offer(uuid, integer) from public, anon;
revoke all on function public.revise_structured_offer(uuid, integer, jsonb) from public, anon;
revoke all on function public.mark_offer_under_review(uuid, integer) from public, anon;
revoke all on function public.decide_structured_offer(uuid, integer, text) from public, anon;
revoke all on function public.complete_structured_offer(uuid, integer) from public, anon;
revoke all on function public.expire_due_participant_offers() from public, anon, authenticated;
grant execute on function public.create_structured_offer(uuid, uuid, jsonb, boolean, uuid) to authenticated;
grant execute on function public.update_draft_structured_offer(uuid, integer, jsonb) to authenticated;
grant execute on function public.send_structured_offer(uuid, integer) to authenticated;
grant execute on function public.revise_structured_offer(uuid, integer, jsonb) to authenticated;
grant execute on function public.mark_offer_under_review(uuid, integer) to authenticated;
grant execute on function public.decide_structured_offer(uuid, integer, text) to authenticated;
grant execute on function public.complete_structured_offer(uuid, integer) to authenticated;

-- Upgrade-safe repair for timestamptz values created by early migrations.
-- now() is already an absolute timestamptz; converting it to a timezone-less
-- value first makes the stored instant depend on the caller's session zone.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_campaign_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
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

alter table public.users alter column created_at set default now(), alter column updated_at set default now();
alter table public.creator_profiles alter column created_at set default now(), alter column updated_at set default now();
alter table public.brand_profiles alter column created_at set default now(), alter column updated_at set default now();
alter table public.social_accounts alter column created_at set default now(), alter column updated_at set default now();
alter table public.usage_limits alter column updated_at set default now();
alter table public.subscriptions alter column created_at set default now(), alter column updated_at set default now();
alter table public.notifications alter column created_at set default now();
alter table public.activity_log alter column created_at set default now();
alter table public.campaigns alter column created_at set default now(), alter column updated_at set default now();
alter table public.campaign_deliverables alter column created_at set default now();
alter table public.campaign_matches alter column created_at set default now(), alter column updated_at set default now();
alter table public.saved_opportunities alter column created_at set default now();
alter table public.offers alter column created_at set default now(), alter column updated_at set default now();
alter table public.offer_revisions alter column created_at set default now();
alter table public.pricing_benchmarks alter column created_at set default now();
alter table public.deal_analyses alter column created_at set default now();
alter table public.payment_webhook_events alter column created_at set default now();
