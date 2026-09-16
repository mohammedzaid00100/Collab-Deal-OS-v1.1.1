-- Remove the abandoned internal Developer Tool / manual payout prototype.
-- Wallet and creator payments remain browser-only demo flows until the Razorpay-backed MVP.

-- Remove developer-only read policies added to normal product tables.
drop policy if exists users_select_developer_admin on public.users;
drop policy if exists creator_profiles_select_developer_admin on public.creator_profiles;
drop policy if exists brand_profiles_select_developer_admin on public.brand_profiles;
drop policy if exists campaigns_select_developer_admin on public.campaigns;
drop policy if exists campaign_comments_select_developer_admin on public.campaign_comments;
drop policy if exists conversations_select_developer_admin on public.conversations;
drop policy if exists conversation_messages_select_developer_admin on public.conversation_messages;
drop policy if exists offers_select_developer_admin on public.offers;

-- Drop prototype tables first because their RLS policies reference is_developer_admin().
drop table if exists public.prototype_deal_events cascade;
drop table if exists public.prototype_withdrawal_requests cascade;
drop table if exists public.developer_admins cascade;

-- Remove the internal admin helper after its dependent prototype policies are gone.
drop function if exists public.is_developer_admin();
