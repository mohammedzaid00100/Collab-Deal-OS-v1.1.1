-- Transactional notifications and product analytics are queued in the same
-- transaction as the source event. Only the server delivery worker can send.
create table public.account_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  email_notifications boolean not null default true,
  product_analytics boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.account_preferences enable row level security;
create policy preferences_self_read on public.account_preferences for select to authenticated using (user_id = auth.uid());
create policy preferences_self_update on public.account_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.account_preferences from public, anon, authenticated;
grant select, update (email_notifications, product_analytics) on public.account_preferences to authenticated;
create trigger account_preferences_updated before update on public.account_preferences
for each row execute function public.set_updated_at();
insert into public.account_preferences(user_id) select id from public.users on conflict do nothing;

create table public.delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  channel text not null check (channel in ('EMAIL', 'ANALYTICS')),
  event_name text not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  leased_until timestamptz,
  provider_id text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index delivery_outbox_pending_idx on public.delivery_outbox(status, next_attempt_at);
alter table public.delivery_outbox enable row level security;
revoke all on public.delivery_outbox from public, anon, authenticated;

create or replace function public.queue_notification_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
  values(new.user_id, 'EMAIL', new.type::text, 'notification:' || new.id,
    jsonb_build_object('subject', new.title, 'body', new.body, 'action_path', new.action_url))
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;
create trigger notifications_queue_delivery after insert on public.notifications
for each row execute function public.queue_notification_delivery();

create or replace function public.initialize_account_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_preferences(user_id) values(new.id) on conflict do nothing;
  insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
  values(new.id, 'EMAIL', 'WELCOME', 'welcome:' || new.id,
    jsonb_build_object('subject', 'Welcome to Collab Deal OS',
      'body', 'Your next collaboration starts with clear terms. Complete your profile to discover opportunities and evaluate your first deal.', 'action_path', '/login'))
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;
create trigger users_initialize_delivery after insert on public.users
for each row execute function public.initialize_account_delivery();

create or replace function public.queue_activity_analytics()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  name text;
  role_value public.account_type;
begin
  if new.actor_user_id is null then return new; end if;
  if not exists(select 1 from public.account_preferences p where p.user_id = new.actor_user_id and p.product_analytics) then return new; end if;
  name := case new.event_type
    when 'ONBOARDING_COMPLETED' then 'onboarding complete'
    when 'CAMPAIGN_CREATED' then 'campaign created'
    when 'OFFER_SENT' then 'offer created'
    when 'OFFER_REVISED' then 'offer revised'
    when 'OFFER_ACCEPTED' then 'offer accepted'
    when 'OFFER_REJECTED' then 'offer rejected'
    when 'AI_EVALUATION_RESERVED' then 'AI evaluation started'
    when 'AI_EVALUATION_COMPLETED' then 'AI evaluation completed'
    else null end;
  if new.event_type = 'SUBSCRIPTION_WEBHOOK_APPLIED' then
    if new.metadata ->> 'subscription_status' = 'ACTIVE' and new.metadata ->> 'previous_status' is distinct from 'ACTIVE' then name := 'subscription started';
    elsif new.metadata ->> 'subscription_status' = 'CANCELLED' and new.metadata ->> 'previous_status' is distinct from 'CANCELLED' then name := 'subscription cancelled'; end if;
  end if;
  if name is null then return new; end if;
  select account_type into role_value from public.users where id = new.actor_user_id;
  insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
  values(new.actor_user_id, 'ANALYTICS', name, 'activity:' || new.id,
    jsonb_build_object('account_type', role_value, 'entity_type', new.entity_type)) on conflict do nothing;
  if name = 'AI evaluation completed' and new.metadata ->> 'usage_bucket' = 'FREE' then
    insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
    values(new.actor_user_id, 'ANALYTICS', 'free evaluation consumed', 'free-evaluation:' || new.entity_id,
      jsonb_build_object('account_type', role_value)) on conflict do nothing;
  end if;
  if name = 'subscription started' then
    insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
    values(new.actor_user_id, 'ANALYTICS', 'free-to-paid conversion', 'conversion:' || new.actor_user_id,
      jsonb_build_object('account_type', role_value)) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger activity_queue_analytics after insert on public.activity_log
for each row execute function public.queue_activity_analytics();

-- Consent grants permission for these account lifecycle events; no analytics
-- delivery is attempted before opt-in or after opt-out.
create or replace function public.queue_analytics_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare role_value public.account_type;
begin
  if new.product_analytics and not old.product_analytics then
    select account_type into role_value from public.users where id = new.user_id;
    insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
    values(new.user_id, 'ANALYTICS', 'signup', 'signup:' || new.user_id, '{}'::jsonb) on conflict do nothing;
    if role_value is not null then
      insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
      values(new.user_id, 'ANALYTICS', role_value::text || ' signup', 'role-signup:' || new.user_id,
        jsonb_build_object('account_type', role_value)) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger preferences_queue_consent after update on public.account_preferences
for each row execute function public.queue_analytics_consent();

create or replace function public.record_product_view(view_event text)
returns void language plpgsql security definer set search_path = '' as $$
declare role_value public.account_type;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if view_event is null or view_event not in ('opportunity viewed', 'creator viewed', 'upgrade page viewed') then raise exception 'Unsupported view event'; end if;
  if not exists(select 1 from public.account_preferences p where p.user_id = auth.uid() and p.product_analytics) then return; end if;
  select account_type into role_value from public.users where id = auth.uid();
  insert into public.delivery_outbox(user_id, channel, event_name, dedupe_key, payload)
  values(auth.uid(), 'ANALYTICS', view_event,
    'view:' || auth.uid() || ':' || view_event || ':' || date_trunc('minute', now())::text,
    jsonb_build_object('account_type', role_value)) on conflict do nothing;
end;
$$;

create or replace function public.claim_delivery_jobs(delivery_channel text, batch_limit integer default 5)
returns setof public.delivery_outbox language plpgsql security definer set search_path = '' as $$
begin
  -- Stop automatic retries before the provider's 24-hour idempotency window.
  update public.delivery_outbox set status = 'FAILED', error_code = 'RETRY_WINDOW_EXHAUSTED'
  where channel = delivery_channel and status in ('PENDING', 'PROCESSING')
    and (attempts >= 8 or first_attempt_at < now() - interval '22 hours')
    and (leased_until is null or leased_until < now());
  return query
  with candidates as (
    select d.id from public.delivery_outbox d where d.channel = delivery_channel
      and ((d.status = 'PENDING' and d.next_attempt_at <= now()) or (d.status = 'PROCESSING' and d.leased_until < now()))
    order by d.created_at limit least(greatest(coalesce(batch_limit, 5), 1), 10) for update skip locked
  )
  update public.delivery_outbox d set status = 'PROCESSING', attempts = attempts + 1,
    first_attempt_at = coalesce(first_attempt_at, now()), lease_token = gen_random_uuid(),
    leased_until = now() + interval '5 minutes'
  from candidates c where d.id = c.id returning d.*;
end;
$$;

create or replace function public.finish_delivery_job(job_id uuid, job_token uuid, result_status text, result_code text default null, result_provider_id text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if result_status is null or result_status not in ('SENT', 'SKIPPED', 'PENDING', 'FAILED') then raise exception 'Invalid result'; end if;
  update public.delivery_outbox set status = result_status,
    provider_id = left(result_provider_id, 200), error_code = left(result_code, 80),
    completed_at = case when result_status in ('SENT', 'SKIPPED', 'FAILED') then now() else null end,
    next_attempt_at = now() + (least(3600, 30 * power(2, attempts))::integer * interval '1 second'),
    leased_until = null, lease_token = null
  where id = job_id and lease_token = job_token and status = 'PROCESSING';
end;
$$;

revoke all on function public.queue_notification_delivery(), public.initialize_account_delivery(), public.queue_activity_analytics(), public.queue_analytics_consent() from public, anon, authenticated;
revoke all on function public.record_product_view(text) from public, anon;
grant execute on function public.record_product_view(text) to authenticated;
revoke all on function public.claim_delivery_jobs(text, integer), public.finish_delivery_job(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_delivery_jobs(text, integer), public.finish_delivery_job(uuid, uuid, text, text, text) to service_role;
