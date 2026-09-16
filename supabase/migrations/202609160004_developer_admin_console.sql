-- Internal developer/operator access for the Collab Deal OS prototype.
-- Developer admins are explicitly enrolled in this table; normal users cannot
-- add themselves. The helper is SECURITY DEFINER so policies can safely test
-- membership without exposing the admin table for writes.

create table if not exists public.developer_admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.developer_admins enable row level security;

revoke all on public.developer_admins from anon, authenticated;
grant select on public.developer_admins to authenticated;

drop policy if exists developer_admins_select_self on public.developer_admins;
create policy developer_admins_select_self
on public.developer_admins for select to authenticated
using (user_id = auth.uid());

create or replace function public.is_developer_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.developer_admins da where da.user_id = auth.uid()
  );
$$;

revoke all on function public.is_developer_admin() from public;
grant execute on function public.is_developer_admin() to authenticated;

-- Read access used by the internal operator console.
drop policy if exists users_select_developer_admin on public.users;
create policy users_select_developer_admin on public.users
for select to authenticated using (public.is_developer_admin());

drop policy if exists creator_profiles_select_developer_admin on public.creator_profiles;
create policy creator_profiles_select_developer_admin on public.creator_profiles
for select to authenticated using (public.is_developer_admin());

drop policy if exists brand_profiles_select_developer_admin on public.brand_profiles;
create policy brand_profiles_select_developer_admin on public.brand_profiles
for select to authenticated using (public.is_developer_admin());

drop policy if exists campaigns_select_developer_admin on public.campaigns;
create policy campaigns_select_developer_admin on public.campaigns
for select to authenticated using (public.is_developer_admin());

drop policy if exists campaign_comments_select_developer_admin on public.campaign_comments;
create policy campaign_comments_select_developer_admin on public.campaign_comments
for select to authenticated using (public.is_developer_admin());

drop policy if exists conversations_select_developer_admin on public.conversations;
create policy conversations_select_developer_admin on public.conversations
for select to authenticated using (public.is_developer_admin());

drop policy if exists conversation_messages_select_developer_admin on public.conversation_messages;
create policy conversation_messages_select_developer_admin on public.conversation_messages
for select to authenticated using (public.is_developer_admin());

drop policy if exists offers_select_developer_admin on public.offers;
create policy offers_select_developer_admin on public.offers
for select to authenticated using (public.is_developer_admin());

drop policy if exists prototype_withdrawals_select_developer_admin on public.prototype_withdrawal_requests;
create policy prototype_withdrawals_select_developer_admin
on public.prototype_withdrawal_requests for select to authenticated
using (public.is_developer_admin());

drop policy if exists prototype_withdrawals_update_developer_admin on public.prototype_withdrawal_requests;
create policy prototype_withdrawals_update_developer_admin
on public.prototype_withdrawal_requests for update to authenticated
using (public.is_developer_admin())
with check (public.is_developer_admin());

grant update on public.prototype_withdrawal_requests to authenticated;
