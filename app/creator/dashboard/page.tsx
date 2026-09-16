import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  Handshake,
  Megaphone,
  MousePointerClick,
  Percent,
  Radio,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCompactNumber, formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Creator dashboard' };

interface CreatorProfileRow {
  id: string;
  full_name: string;
  niche: string;
  location: string;
  average_views: number;
  engagement_rate: number;
}

interface SocialRow {
  platform: string;
  audience_count: number;
  metric_status: string;
}

interface OfferRow {
  id: string;
  cash_payment: number;
  product_name: string | null;
  product_value: number;
  deal_type: string;
  status: string;
}

export default async function CreatorDashboardPage() {
  const account = await requireAppAccount('creator');
  if (!account) {
    return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  }

  const supabase = await createSupabaseServerClient();
  const { data: profileData, error: profileError } = await supabase!
    .from('creator_profiles')
    .select('id,full_name,niche,location,average_views,engagement_rate')
    .eq('user_id', account.id)
    .maybeSingle();
  if (profileError) throw new Error('Creator dashboard data is temporarily unavailable.');

  const profile = profileData as CreatorProfileRow | null;
  const [{ data: socialData, error: socialError }, { data: offerData, error: offerError }] = profile ? await Promise.all([
    supabase!.from('social_accounts').select('platform,audience_count,metric_status').eq('creator_profile_id', profile.id).order('audience_count', { ascending: false }),
    supabase!.from('offers').select('id,cash_payment,product_name,product_value,deal_type,status').eq('creator_profile_id', profile.id).in('status', ['SENT', 'UNDER_REVIEW', 'REVISED']).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]) : [{ data: [], error: null }, { data: null, error: null }];
  if (socialError || offerError) throw new Error('Creator dashboard activity is temporarily unavailable.');

  const socials = (socialData ?? []) as SocialRow[];
  const topOffer = offerData as OfferRow | null;
  const primarySocial = socials[0];
  const name = profile?.full_name ?? account.displayName ?? 'Creator';

  return (
    <AppShell role="creator" displayName={name} email={account.email} plan={account.plan}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Creator workspace</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Welcome back, {firstName(name)}</h1><p className="mt-2 text-sm text-slate-500">Find real brand deals, comment your interest, and continue selected collaborations in Messages.</p></div>
        <Link className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-sm font-semibold text-white shadow-sm sm:mt-0" style={{ color: '#fff' }} href="/creator/connect"><Radio className="size-4" aria-hidden="true" />Browse live deals</Link>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Creator metrics">
        <MetricCard icon={UsersRound} label="Followers" value={primarySocial ? formatCompactNumber(primarySocial.audience_count) : 'Not added'} detail={primarySocial ? `${prettyPlatform(primarySocial.platform)} · ${statusLabel(primarySocial.metric_status)}` : 'Complete your social profile'} />
        <MetricCard icon={Percent} label="Engagement" value={profile ? `${Number(profile.engagement_rate).toFixed(1)}%` : 'Not added'} detail="Creator declared" />
        <MetricCard icon={Eye} label="Average views" value={profile ? formatCompactNumber(profile.average_views) : 'Not added'} detail="Recent representative average" />
        <MetricCard icon={MousePointerClick} label="Platform presence" value={`${socials.filter((item) => item.audience_count > 0).length}`} detail={socials.length ? socials.map((item) => prettyPlatform(item.platform)).slice(0, 3).join(' · ') : 'No platforms added'} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Active collaboration</p><h2 className="mt-1 text-lg font-bold text-slate-950">Highest-priority active offer</h2></div>{topOffer ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{topOffer.status.replaceAll('_', ' ')}</span> : null}</div>
          {topOffer ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-3"><DealValue label="Cash payment" value={formatInr(topOffer.cash_payment)} /><DealValue label="Product perk" value={topOffer.product_name ?? 'None'} /><DealValue label="Product value" value={formatInr(topOffer.product_value)} /></div><div className="mt-5 flex flex-wrap gap-2"><Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" style={{ color: '#fff' }} href={`/creator/offers/${topOffer.id}`}>View offer<ArrowRight className="size-4" /></Link></div></div> : <div className="mt-5"><EmptyState icon={Handshake} title="No active offers yet" description="Start in Connect. When a brand selects you and the collaboration progresses, your active deal information will appear here." actionLabel="Browse Connect" actionHref="/creator/connect" /></div>}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-violet-300"><WalletCards className="size-5" aria-hidden="true" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-violet-300">Wallet & earnings</p><strong className="mt-2 block text-2xl font-bold tracking-[-0.035em]">Payment flow prototype</strong><p className="mt-2 text-sm leading-6 text-slate-300">Review how creator earnings, pending payments, and the planned ₹100 minimum withdrawal will work. No real funds move yet.</p><Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white" style={{ color: '#fff' }} href="/creator/wallet">Open wallet<ArrowRight className="size-4" /></Link>
        </aside>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Marketplace</p><h2 className="mt-1 text-lg font-bold text-slate-950">Find your next brand collaboration</h2></div><Link className="text-sm font-semibold text-violet-700" href="/creator/connect">Open Connect</Link></div><div className="mt-5"><EmptyState icon={Megaphone} title="Connect is your deal marketplace" description="Published deals from registered brands appear in Connect. Open a deal, comment your interest, and wait for the brand to start a private conversation." actionLabel="Browse live deals" actionHref="/creator/connect" /></div></section>
    </AppShell>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof UsersRound; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{label}</span><Icon className="size-4 text-violet-600" aria-hidden="true" /></div><strong className="mt-3 block text-2xl font-bold tracking-[-0.035em] text-slate-950">{value}</strong><span className="mt-1 block truncate text-[11px] text-slate-400">{detail}</span></div>;
}

function DealValue({ label, value }: { label: string; value: string }) {
  return <div><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</span><strong className="mt-1 block text-sm text-slate-900">{value}</strong></div>;
}

function firstName(name: string) { return name.trim().split(/\s+/)[0] || name; }
function prettyPlatform(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
function statusLabel(value: string) { return value === 'API_VERIFIED' ? 'Verified' : value === 'CREATOR_DECLARED' ? 'Creator declared' : 'Unavailable'; }
