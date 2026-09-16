-- Shared prototype deal completion events.
-- These are NOT real payment records. They let the internal developer tool
-- report when the investor-demo Pay Creator flow has been completed.

create table if not exists public.prototype_deal_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  brand_user_id uuid not null references public.users(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  creator_amount_inr numeric(14,2) not null check (creator_amount_inr > 0),
  commission_rate numeric(6,5) not null default 0.08 check (commission_rate >= 0 and commission_rate <= 1),
  platform_fee_inr numeric(14,2) not null check (platform_fee_inr >= 0),
  brand_total_inr numeric(14,2) not null check (brand_total_inr > 0),
  status text not null default 'COMPLETED' check (status = 'COMPLETED'),
  created_at timestamptz not null default now()
);

create index if not exists prototype_deal_events_created_idx
on public.prototype_deal_events (created_at desc);
create index if not exists prototype_deal_events_conversation_idx
on public.prototype_deal_events (conversation_id, created_at desc);

alter table public.prototype_deal_events enable row level security;

drop policy if exists prototype_deal_events_insert_brand on public.prototype_deal_events;
create policy prototype_deal_events_insert_brand
on public.prototype_deal_events for insert to authenticated
with check (
  brand_user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    join public.brand_profiles bp on bp.id = c.brand_profile_id
    where c.id = conversation_id
      and c.campaign_id = campaign_id
      and c.creator_profile_id = creator_profile_id
      and bp.user_id = auth.uid()
  )
);

drop policy if exists prototype_deal_events_select_developer_admin on public.prototype_deal_events;
create policy prototype_deal_events_select_developer_admin
on public.prototype_deal_events for select to authenticated
using (public.is_developer_admin());

revoke all on public.prototype_deal_events from anon, authenticated;
grant insert, select on public.prototype_deal_events to authenticated;
