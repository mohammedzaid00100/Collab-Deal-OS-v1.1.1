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
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#D97706] dark:text-[#F59E0B]">Creator workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">Welcome back, {firstName(name)}</h1>
          <p className="mt-2 text-sm text-[#5A5870] dark:text-[#9CA1BA]">Find real brand deals, comment your interest, and continue selected collaborations in Messages.</p>
        </div>
        <Link
          className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-sm font-semibold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-[#2D334D] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000] sm:mt-0"
          style={{ color: '#fff' }}
          href="/creator/connect"
        >
          <Radio className="size-4" aria-hidden="true" />
          Browse live deals
        </Link>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Creator metrics">
        <MetricCard icon={UsersRound} label="Followers" value={primarySocial ? formatCompactNumber(primarySocial.audience_count) : 'Not added'} detail={primarySocial ? `${prettyPlatform(primarySocial.platform)} · ${statusLabel(primarySocial.metric_status)}` : 'Complete your social profile'} />
        <MetricCard icon={Percent} label="Engagement" value={profile ? `${Number(profile.engagement_rate).toFixed(1)}%` : 'Not added'} detail="Creator declared" />
        <MetricCard icon={Eye} label="Average views" value={profile ? formatCompactNumber(profile.average_views) : 'Not added'} detail="Recent representative average" />
        <MetricCard icon={MousePointerClick} label="Platform presence" value={`${socials.filter((item) => item.audience_count > 0).length}`} detail={socials.length ? socials.map((item) => prettyPlatform(item.platform)).slice(0, 3).join(' · ') : 'No platforms added'} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#2D334D] dark:bg-[#171927] dark:shadow-[4px_4px_0_#000000] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#D97706] dark:text-[#F59E0B]">Active collaboration</p>
              <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#0D0C1D] dark:text-[#F3F4F8]">Highest-priority active offer</h2>
            </div>
            {topOffer ? (
              <span className="rounded-[6px] border border-[#0D0C1D] bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900 shadow-[1px_1px_0_#0D0C1D] dark:border-[#2D334D] dark:bg-[#281D0D] dark:text-[#F59E0B] dark:shadow-none">
                {topOffer.status.replaceAll('_', ' ')}
              </span>
            ) : null}
          </div>
          {topOffer ? (
            <div className="mt-5 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-4 dark:border-[#2D334D] dark:bg-[#1E2134] sm:p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <DealValue label="Cash payment" value={formatInr(topOffer.cash_payment)} />
                <DealValue label="Product perk" value={topOffer.product_name ?? 'None'} />
                <DealValue label="Product value" value={formatInr(topOffer.product_value)} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#0D0C1D] px-4 text-sm font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.3)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#2D334D] dark:bg-[#F3F4F8] dark:text-[#0D0C1D]"
                  style={{ color: '#fff' }}
                  href={`/creator/offers/${topOffer.id}`}
                >
                  View offer
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={Handshake}
                title="No active offers yet"
                description="Start in Connect. When a brand selects you and the collaboration progresses, your active deal information will appear here."
                actionLabel="Browse Connect"
                actionHref="/creator/connect"
              />
            </div>
          )}
        </section>

        <aside className="rounded-[10px] border-2 border-[#0D0C1D] bg-[#1E1B4B] p-5 text-white shadow-[4px_4px_0_#0D0C1D] dark:border-[#2D334D] dark:bg-[#111326] dark:shadow-[4px_4px_0_#000000] sm:p-6">
          <span className="flex size-10 items-center justify-center rounded-[8px] border border-white/20 bg-white/10 text-[#A5B4FC]">
            <WalletCards className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.1em] text-[#A5B4FC]">Wallet & earnings</p>
          <strong className="mt-2 block text-2xl font-bold tracking-[-0.035em]">Payment flow prototype</strong>
          <p className="mt-2 text-sm leading-6 text-[#C7D2FE]">
            Review how creator earnings, pending payments, and the planned ₹100 minimum withdrawal will work. No real funds move yet.
          </p>
          <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline" style={{ color: '#fff' }} href="/creator/wallet">
            Open wallet
            <ArrowRight className="size-4" />
          </Link>
        </aside>
      </div>

      <section className="mt-6 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#2D334D] dark:bg-[#171927] dark:shadow-[4px_4px_0_#000000] sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">Marketplace</p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#0D0C1D] dark:text-[#F3F4F8]">Find your next brand collaboration</h2>
          </div>
          <Link className="text-sm font-semibold text-[#4F46E5] hover:underline dark:text-[#818CF8]" href="/creator/connect">
            Open Connect
          </Link>
        </div>
        <div className="mt-5">
          <EmptyState
            icon={Megaphone}
            title="Connect is your deal marketplace"
            description="Published deals from registered brands appear in Connect. Open a deal, comment your interest, and wait for the brand to start a private conversation."
            actionLabel="Browse live deals"
            actionHref="/creator/connect"
          />
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof UsersRound; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] dark:border-[#2D334D] dark:bg-[#171927] dark:shadow-[4px_4px_0_#000000]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">{label}</span>
        <Icon className="size-4 text-[#4F46E5] dark:text-[#818CF8]" aria-hidden="true" />
      </div>
      <strong className="mt-3 block text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</strong>
      <span className="mt-1 block truncate text-[11px] text-[#5A5870] dark:text-[#727790]">{detail}</span>
    </div>
  );
}

function DealValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#727790]">{label}</span>
      <strong className="mt-1 block text-sm text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</strong>
    </div>
  );
}


function firstName(name: string) { return name.trim().split(/\s+/)[0] || name; }
function prettyPlatform(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
function statusLabel(value: string) { return value === 'API_VERIFIED' ? 'Verified' : value === 'CREATOR_DECLARED' ? 'Creator declared' : 'Unavailable'; }
