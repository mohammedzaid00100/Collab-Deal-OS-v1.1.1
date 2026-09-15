-- Freeze email content and recipient before the first provider request. Retries
-- with the same idempotency key must never pick up a changed address or sender.
alter table public.delivery_outbox add column provider_request jsonb;

create or replace function public.prepare_email_delivery(job_id uuid, job_token uuid, request_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.delivery_outbox;
begin
  select * into job from public.delivery_outbox where id = job_id for update;
  if not found or job.channel <> 'EMAIL' or job.status <> 'PROCESSING'
    or job.lease_token is distinct from job_token or job.leased_until <= now() then
    raise exception 'Delivery lease is not active';
  end if;
  if job.provider_request is not null then return job.provider_request; end if;
  if request_body is null or jsonb_typeof(request_body) <> 'object'
    or octet_length(request_body::text) > 64000 then raise exception 'Invalid email request'; end if;
  update public.delivery_outbox set provider_request = request_body where id = job_id;
  return request_body;
end;
$$;
revoke all on function public.prepare_email_delivery(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_email_delivery(uuid, uuid, jsonb) to service_role;
