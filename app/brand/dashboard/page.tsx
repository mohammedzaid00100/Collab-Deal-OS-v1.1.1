import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, FilePlus2, Handshake, Search, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand dashboard' };

interface BrandProfileRow { id: string; brand_name: string; industry: string; location: string }

export default async function BrandDashboardPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;

  const supabase = await createSupabaseServerClient();
  const { data: profileData, error: profileError } = await supabase!.from('brand_profiles').select('id,brand_name,industry,location').eq('user_id', account.id).maybeSingle();
  if (profileError) throw new Error('Brand dashboard data is temporarily unavailable.');
  const profile = profileData as BrandProfileRow | null;
  if (profile) {
    const { error: expiryError } = await supabase!.rpc('offers_feed', { target_offer_id: null, result_limit: 1, result_offset: 0 });
    if (expiryError) throw new Error('Offer summary is temporarily unavailable.');
  }
  const [campaigns, matches, offers] = profile ? await Promise.all([
    supabase!.from('campaigns').select('*', { count: 'exact', head: true }).eq('brand_profile_id', profile.id).eq('status', 'PUBLISHED'),
    supabase!.from('campaign_matches').select('campaigns!inner(brand_profile_id)', { count: 'exact', head: true }).eq('campaigns.brand_profile_id', profile.id),
    supabase!.from('offers').select('*', { count: 'exact', head: true }).eq('brand_profile_id', profile.id).in('status', ['SENT', 'UNDER_REVIEW', 'REVISED']),
  ]) : [{ count: 0 }, { count: 0 }, { count: 0 }];
  if ('error' in campaigns && campaigns.error) throw new Error('Campaign summary is temporarily unavailable.');
  if ('error' in matches && matches.error) throw new Error('Creator match summary is temporarily unavailable.');
  if ('error' in offers && offers.error) throw new Error('Offer summary is temporarily unavailable.');
  const name = profile?.brand_name ?? account.displayName ?? 'Brand';

  return <AppShell role="brand" displayName={name} email={account.email} plan={account.plan}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#4F46E5] dark:text-[#818CF8]">Brand workspace</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">Welcome back, {name}</h1>
        <p className="mt-2 text-sm font-medium text-[#5A5870] dark:text-[#9CA1BA]">Build campaigns, compare creator fit, and keep every offer structured.</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white px-4 text-sm font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]" href="/brand/offers">Review offers</Link>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-sm font-bold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-[#383E5E] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]" href="/brand/campaigns/new"><FilePlus2 className="size-4" />Create campaign</Link>
      </div>
    </div>

    <section className="mt-7 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Brand summary">
      <BrandMetric icon={BriefcaseBusiness} label="Active campaigns" value={campaigns.count ?? 0} detail="Published campaigns" />
      <BrandMetric icon={UsersRound} label="Creator matches" value={matches.count ?? 0} detail="Explainable weighted matches" />
      <BrandMetric icon={Handshake} label="Pending offers" value={offers.count ?? 0} detail="Awaiting structured action" />
      <BrandMetric icon={Search} label="Campaign activity" value={0} detail="No unreviewed activity" />
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#D97706] dark:text-[#FBBF24]">Creator matches</p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#0D0C1D] dark:text-[#F3F4F8]">Strongest creator fit</h2>
          </div>
          <Link className="rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] px-2.5 py-1 text-xs font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]" href="/brand/creators">Discover creators →</Link>
        </div>
        <div className="mt-5">
          <EmptyState icon={UsersRound} title="No creator matches yet" description="Create and publish a campaign. The matching engine will score niche, audience, size, engagement, budget, and platform fit." actionLabel="Create your first campaign" actionHref="/brand/campaigns/new" />
        </div>
      </section>
      <aside className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#4F46E5] dark:text-[#818CF8]">Campaign activity</p>
        <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#0D0C1D] dark:text-[#F3F4F8]">Next best action</h2>
        <div className="mt-5 rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] p-5 shadow-[3px_3px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1B1E32] dark:shadow-[3px_3px_0_#000000]">
          <span className="flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#121422] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]"><BriefcaseBusiness className="size-5" /></span>
          <h3 className="mt-4 font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Create a structured campaign</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-[#5A5870] dark:text-[#9CA1BA]">Clear deliverables, rights, budget, and audience criteria produce better matches and cleaner offers.</p>
          <Link className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3.5 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]" href="/brand/campaigns/new">Start campaign<ArrowRight className="size-4" /></Link>
        </div>
      </aside>
    </div>
  </AppShell>;
}

function BrandMetric({ icon: Icon, label, value, detail }: { icon: typeof BriefcaseBusiness; label: string; value: number; detail: string }) {
  return (
    <div className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#5A5870] dark:text-[#A5ADC6]">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E213B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
          <Icon className="size-4" />
        </span>
      </div>
      <strong className="mt-3 block text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">{value}</strong>
      <span className="mt-1 block text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">{detail}</span>
    </div>
  );
}

