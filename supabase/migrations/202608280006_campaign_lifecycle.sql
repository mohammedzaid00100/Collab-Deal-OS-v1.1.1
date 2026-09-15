-- Campaign lifecycle and private asset references are server-owned. Published
-- campaign terms remain immutable so persisted match scores stay explainable.

create or replace function public.set_campaign_asset_path(
  target_campaign_id uuid,
  target_asset_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_asset_path not like auth.uid()::text || '/' || target_campaign_id::text || '/%' then
    raise exception 'Invalid campaign asset path';
  end if;

  update public.campaigns c
  set asset_path = target_asset_path
  from public.brand_profiles bp
  where c.id = target_campaign_id
    and bp.id = c.brand_profile_id
    and bp.user_id = auth.uid()
    and c.status <> 'ARCHIVED';
  if not found then raise exception 'Campaign not found or cannot be updated'; end if;
end;
$$;

create or replace function public.set_campaign_lifecycle(
  target_campaign_id uuid,
  next_status public.campaign_status
)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.campaign_status;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select c.status into current_status
  from public.campaigns c
  join public.brand_profiles bp on bp.id = c.brand_profile_id
  where c.id = target_campaign_id and bp.user_id = auth.uid()
  for update of c;
  if not found then raise exception 'Campaign not found or not owned by account'; end if;

  if next_status = 'PAUSED' and current_status = 'PUBLISHED' then
    update public.campaigns set status = 'PAUSED' where id = target_campaign_id;
  elsif next_status = 'CLOSED' and current_status in ('PUBLISHED', 'PAUSED') then
    update public.campaigns set status = 'CLOSED' where id = target_campaign_id;
  elsif next_status = 'ARCHIVED' and current_status in ('DRAFT', 'CLOSED') then
    update public.campaigns set status = 'ARCHIVED' where id = target_campaign_id;
  else
    raise exception 'Invalid campaign status transition';
  end if;

  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'CAMPAIGN_STATUS_CHANGED', 'campaign', target_campaign_id,
    jsonb_build_object('from', current_status, 'to', next_status)
  );
  return next_status;
end;
$$;

create or replace function public.delete_draft_campaign(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.campaigns c
  using public.brand_profiles bp
  where c.id = target_campaign_id
    and bp.id = c.brand_profile_id
    and bp.user_id = auth.uid()
    and c.status = 'DRAFT';
  if not found then raise exception 'Only an owned draft campaign can be deleted'; end if;
  insert into public.activity_log (actor_user_id, event_type, entity_type, entity_id)
  values (auth.uid(), 'CAMPAIGN_DRAFT_DELETED', 'campaign', target_campaign_id);
end;
$$;

revoke all on function public.set_campaign_asset_path(uuid, text) from public;
revoke all on function public.set_campaign_lifecycle(uuid, public.campaign_status) from public;
revoke all on function public.delete_draft_campaign(uuid) from public;
grant execute on function public.set_campaign_asset_path(uuid, text) to authenticated;
grant execute on function public.set_campaign_lifecycle(uuid, public.campaign_status) to authenticated;
grant execute on function public.delete_draft_campaign(uuid) to authenticated;

revoke update, delete on public.campaigns from authenticated;
