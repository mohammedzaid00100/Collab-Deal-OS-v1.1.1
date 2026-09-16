import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  BadgeIndianRupee,
  BriefcaseBusiness,
  Clock3,
  MessageCircle,
  MessagesSquare,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { WithdrawalActions } from '@/components/developer/withdrawal-actions';
import { requireDeveloperAccess } from '@/lib/developer/access';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Developer Tool' };
export const dynamic = 'force-dynamic';

type AppUser = { id: string; email: string; account_type: 'creator' | 'brand' | null; created_at: string };
type Creator = { id: string; user_id: string; full_name: string; username: string; niche: string };
type Brand = { id: string; user_id: string; brand_name: string; industry: string };
type Campaign = { id: string; brand_profile_id: string; title: string; status: string; budget: number; currency: string; created_at: string; published_at: string | null };
type Comment = { id: string; campaign_id: string; creator_profile_id: string; body: string; created_at: string };
type Conversation = { id: string; campaign_id: string; brand_profile_id: string; creator_profile_id: string; created_at: string; updated_at: string };
type Message = { id: string; conversation_id: string; sender_user_id: string; body: string; created_at: string };
type Withdrawal = { id: string; user_id: string; account_type: 'creator' | 'brand'; amount_inr: number; upi_id: string; status: 'PENDING' | 'COMPLETED' | 'REJECTED'; created_at: string; completed_at: string | null; rejected_at: string | null };
type DealEvent = { id: string; conversation_id: string; campaign_id: string; creator_profile_id: string; creator_amount_inr: number | string; platform_fee_inr: number | string; brand_total_inr: number | string; created_at: string };

export default async function DeveloperPage() {
  const developerUser = await requireDeveloperAccess();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <DeveloperFrame>
      <section className="mx-auto max-w-2xl rounded-3xl border border-red-900/40 bg-red-950/30 p-8 text-center">
        <ShieldAlert className="mx-auto size-10 text-red-400" />
        <h1 className="mt-4 text-2xl font-bold text-white">Developer data access is unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">The Collab Deal OS Supabase connection is not configured for this server.</p>
      </section>
    </DeveloperFrame>;
  }

  const dayStart = startOfIndiaDayIso();
  const [
    usersResult,
    creatorsResult,
    brandsResult,
    campaignsResult,
    commentsResult,
    conversationsResult,
    messagesResult,
    withdrawalsResult,
    dealEventsResult,
    completedTodayResult,
  ] = await Promise.all([
    supabase.from('users').select('id,email,account_type,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('creator_profiles').select('id,user_id,full_name,username,niche').limit(200),
    supabase.from('brand_profiles').select('id,user_id,brand_name,industry').limit(200),
    supabase.from('campaigns').select('id,brand_profile_id,title,status,budget,currency,created_at,published_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('campaign_comments').select('id,campaign_id,creator_profile_id,body,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('conversations').select('id,campaign_id,brand_profile_id,creator_profile_id,created_at,updated_at').order('updated_at', { ascending: false }).limit(100),
    supabase.from('conversation_messages').select('id,conversation_id,sender_user_id,body,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('prototype_withdrawal_requests').select('id,user_id,account_type,amount_inr,upi_id,status,created_at,completed_at,rejected_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('prototype_deal_events').select('id,conversation_id,campaign_id,creator_profile_id,creator_amount_inr,platform_fee_inr,brand_total_inr,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('prototype_deal_events').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
  ]);

  const users = (usersResult.data ?? []) as AppUser[];
  const creators = (creatorsResult.data ?? []) as Creator[];
  const brands = (brandsResult.data ?? []) as Brand[];
  const campaigns = (campaignsResult.data ?? []) as Campaign[];
  const comments = (commentsResult.data ?? []) as Comment[];
  const conversations = (conversationsResult.data ?? []) as Conversation[];
  const messages = (messagesResult.data ?? []) as Message[];
  const withdrawals = (withdrawalsResult.data ?? []) as Withdrawal[];
  const dealEvents = (dealEventsResult.data ?? []) as DealEvent[];

  const creatorById = new Map(creators.map((item) => [item.id, item]));
  const brandById = new Map(brands.map((item) => [item.id, item]));
  const campaignById = new Map(campaigns.map((item) => [item.id, item]));
  const userById = new Map(users.map((item) => [item.id, item]));
  const conversationById = new Map(conversations.map((item) => [item.id, item]));
  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'PENDING');
  const campaignsToday = campaigns.filter((item) => item.created_at >= dayStart).length;
  const commentsToday = comments.filter((item) => item.created_at >= dayStart).length;
  const messagesToday = messages.filter((item) => item.created_at >= dayStart).length;

  return <DeveloperFrame>
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-400">Collab Deal OS · Internal operations</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] text-white">Developer Tool</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Live prototype visibility across marketplace activity, creator interest, private deal conversations, completed demo deals and manual withdrawal operations.</p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">Signed in as <strong className="text-slate-200">{developerUser.email ?? 'developer'}</strong></div>
    </div>

    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={BadgeIndianRupee} label="Completed deals today" value={completedTodayResult.count ?? 0} detail="Investor-prototype Pay Creator completions" />
      <Metric icon={BriefcaseBusiness} label="Deals uploaded today" value={campaignsToday} detail={`${campaigns.length} recent campaign records loaded`} />
      <Metric icon={MessageCircle} label="Creator comments today" value={commentsToday} detail={`${comments.length} recent comments loaded`} />
      <Metric icon={MessagesSquare} label="DM messages today" value={messagesToday} detail={`${conversations.length} recent conversations`} />
    </section>

    <section className="mt-8 overflow-hidden rounded-3xl border border-amber-900/40 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-400">Manual payout queue</p><h2 className="mt-1 text-xl font-bold text-white">Pending withdrawals</h2></div>
        <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">{pendingWithdrawals.length} pending</span>
      </div>
      <div className="grid gap-3 p-4 sm:p-5">
        {pendingWithdrawals.length ? pendingWithdrawals.map((item) => {
          const user = userById.get(item.user_id);
          const profile = item.account_type === 'creator'
            ? creators.find((creator) => creator.user_id === item.user_id)?.full_name
            : brands.find((brand) => brand.user_id === item.user_id)?.brand_name;
          return <article className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:grid-cols-[1.2fr_0.8fr_0.7fr_auto] lg:items-center" key={item.id}>
            <div><p className="text-sm font-bold text-white">{profile ?? user?.email ?? 'Account'}</p><p className="mt-1 text-xs text-slate-500">{item.account_type} · {user?.email ?? item.user_id}</p><p className="mt-2 text-xs text-slate-400">Requested {formatDate(item.created_at)}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">UPI destination</p><p className="mt-1 break-all font-mono text-sm text-slate-200">{item.upi_id}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Amount</p><p className="mt-1 text-xl font-bold text-white">₹{item.amount_inr.toLocaleString('en-IN')}</p></div>
            <WithdrawalActions withdrawalId={item.id} />
          </article>;
        }) : <Empty text="No withdrawal requests are waiting for manual payout." />}
      </div>
    </section>

    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <Panel title="Completed prototype deals" eyebrow="Deal completions" icon={BadgeIndianRupee}>
        {dealEvents.length ? dealEvents.slice(0, 12).map((event) => {
          const conversation = conversationById.get(event.conversation_id);
          const brand = conversation ? brandById.get(conversation.brand_profile_id) : undefined;
          const creator = creatorById.get(event.creator_profile_id);
          const campaign = campaignById.get(event.campaign_id);
          return <Link className="block rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 transition hover:border-violet-700" href={`/developer/conversations/${event.conversation_id}`} key={event.id}><p className="text-sm font-bold text-white">{brand?.brand_name ?? 'Brand'} → {creator?.full_name ?? 'Creator'}</p><p className="mt-1 text-xs text-slate-500">{campaign?.title ?? 'Deal'} · Creator ₹{Number(event.creator_amount_inr).toLocaleString('en-IN')} · Fee ₹{Number(event.platform_fee_inr).toLocaleString('en-IN')} · Total ₹{Number(event.brand_total_inr).toLocaleString('en-IN')}</p><p className="mt-1.5 text-[10px] text-slate-600">{formatDate(event.created_at)}</p></Link>;
        }) : <Empty text="No prototype creator payments have been completed yet." />}
      </Panel>

      <Panel title="Recent brand deals" eyebrow="Campaign marketplace" icon={BriefcaseBusiness}>
        {campaigns.length ? campaigns.slice(0, 12).map((campaign) => <Row key={campaign.id} title={campaign.title} meta={`${brandById.get(campaign.brand_profile_id)?.brand_name ?? 'Brand'} · ${campaign.status} · ₹${campaign.budget.toLocaleString('en-IN')}`} time={campaign.created_at} />) : <Empty text="No brand campaigns have been uploaded yet." />}
      </Panel>

      <Panel title="Creator interest" eyebrow="Deal comments" icon={MessageCircle}>
        {comments.length ? comments.slice(0, 12).map((comment) => <Row key={comment.id} title={`${creatorById.get(comment.creator_profile_id)?.full_name ?? 'Creator'} → ${campaignById.get(comment.campaign_id)?.title ?? 'Deal'}`} meta={comment.body} time={comment.created_at} />) : <Empty text="No creators have commented on deals yet." />}
      </Panel>

      <Panel title="Brand ↔ creator conversations" eyebrow="Direct messages" icon={UsersRound}>
        {conversations.length ? conversations.slice(0, 12).map((conversation) => <Link className="block rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 transition hover:border-violet-700" href={`/developer/conversations/${conversation.id}`} key={conversation.id}><p className="text-sm font-bold text-white">{brandById.get(conversation.brand_profile_id)?.brand_name ?? 'Brand'} ↔ {creatorById.get(conversation.creator_profile_id)?.full_name ?? 'Creator'}</p><p className="mt-1 truncate text-xs text-slate-500">{campaignById.get(conversation.campaign_id)?.title ?? 'Campaign'} · updated {formatDate(conversation.updated_at)}</p></Link>) : <Empty text="No private deal conversations have started yet." />}
      </Panel>

      <Panel title="Latest messages" eyebrow="Message activity" icon={MessagesSquare}>
        {messages.length ? messages.slice(0, 12).map((message) => {
          const conversation = conversationById.get(message.conversation_id);
          const sender = userById.get(message.sender_user_id);
          return <Link className="block rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 transition hover:border-violet-700" href={`/developer/conversations/${message.conversation_id}`} key={message.id}><p className="truncate text-sm text-slate-200">{message.body}</p><p className="mt-1 truncate text-xs text-slate-500">{sender?.email ?? 'Participant'} · {conversation ? campaignById.get(conversation.campaign_id)?.title ?? 'Deal' : 'Conversation'} · {formatDate(message.created_at)}</p></Link>;
        }) : <Empty text="No direct messages yet." />}
      </Panel>
    </div>

    <section className="mt-8 rounded-2xl border border-violet-900/40 bg-violet-950/20 p-5">
      <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-violet-400" /><div><h2 className="text-sm font-bold text-violet-100">Internal access notice</h2><p className="mt-1 text-xs leading-5 text-violet-300/80">This prototype developer tool can display private creator-brand messages for operational review. A production version should restrict access to authorized staff, audit every access, and disclose operational message access in the product privacy terms.</p></div></div>
    </section>
  </DeveloperFrame>;
}

function DeveloperFrame({ children }: { children: React.ReactNode }) {
  return <main className="min-h-svh bg-[#070b14] text-slate-100">
    <header className="border-b border-slate-800 bg-[#090e19]/95 px-5 py-4 backdrop-blur"><div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4"><BrandLogo /><div className="flex items-center gap-3"><span className="hidden rounded-full bg-violet-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-300 sm:inline">Developer prototype</span><Link className="text-xs font-bold text-slate-400 hover:text-white" href="/">Open user app</Link></div></div></header>
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">{children}</div>
  </main>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: number; detail: string }) {
  return <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Icon className="size-5" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p><strong className="mt-1 block text-3xl font-bold text-white">{value.toLocaleString('en-IN')}</strong><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}

function Panel({ title, eyebrow, icon: Icon, children }: { title: string; eyebrow: string; icon: typeof Activity; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300"><Icon className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-400">{eyebrow}</p><h2 className="mt-0.5 font-bold text-white">{title}</h2></div></div><div className="grid gap-2">{children}</div></section>;
}

function Row({ title, meta, time }: { title: string; meta: string; time: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"><p className="text-sm font-bold text-slate-100">{title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{meta}</p><p className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-600"><Clock3 className="size-3" />{formatDate(time)}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-600">{text}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function startOfIndiaDayIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+05:30`).toISOString();
}
