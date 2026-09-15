import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, FilePlus2, Layers3, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { CampaignStatus } from '@/components/campaigns/campaign-status';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Campaigns' };

interface CampaignRow {
  id: string;
  title: string;
  description: string;
  status: string;
  platform: string;
  target_creator_niche: string;
  budget: number;
  product_value: number;
  deal_type: string;
  submission_deadline: string | null;
  created_at: string;
}

export default async function CampaignsPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase!.from('brand_profiles').select('id').eq('user_id', account.id).maybeSingle();
  if (profileError) throw new Error('Brand profile is temporarily unavailable.');
  const { data, error } = profile
    ? await supabase!.from('campaigns').select('id,title,description,status,platform,target_creator_niche,budget,product_value,deal_type,submission_deadline,created_at').eq('brand_profile_id', profile.id).order('created_at', { ascending: false })
    : { data: [], error: null };
  if (error) throw new Error('Campaigns are temporarily unavailable.');
  const campaigns = (data ?? []) as CampaignRow[];
  const ids = campaigns.map((campaign) => campaign.id);
  const [deliverableResult, matchResult] = ids.length ? await Promise.all([
    supabase!.from('campaign_deliverables').select('campaign_id').in('campaign_id', ids),
    supabase!.from('campaign_matches').select('campaign_id').in('campaign_id', ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (deliverableResult.error || matchResult.error) throw new Error('Campaign summaries are temporarily unavailable.');
  const deliverableCounts = countByCampaign(deliverableResult.data ?? []);
  const matchCounts = countByCampaign(matchResult.data ?? []);

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Brand workspace</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Campaigns</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Structure every collaboration clearly, then publish it to generate creator matches.</p></div><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-sm font-semibold text-white shadow-sm" href="/brand/campaigns/new"><FilePlus2 className="size-4" />Create campaign</Link></div>

    <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Campaign summary">
      <Summary icon={BriefcaseBusiness} label="All campaigns" value={campaigns.length} />
      <Summary icon={Layers3} label="Published" value={campaigns.filter((item) => item.status === 'PUBLISHED').length} />
      <Summary icon={UsersRound} label="Creator matches" value={Object.values(matchCounts).reduce((sum, count) => sum + count, 0)} />
    </section>

    {campaigns.length ? <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Campaign list">{campaigns.map((campaign) => <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md" key={campaign.id}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><CampaignStatus status={campaign.status} /><span className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{campaign.platform}</span></div><h2 className="mt-3 text-lg font-bold tracking-[-0.025em] text-slate-950">{campaign.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{campaign.description}</p></div><Link className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-slate-950 group-hover:text-white" href={`/brand/campaigns/${campaign.id}`} aria-label={`Open ${campaign.title}`}><ArrowRight className="size-4" /></Link></div>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4"><CampaignDatum label="Total value" value={formatInr(Number(campaign.budget) + Number(campaign.product_value))} /><CampaignDatum label="Creator niche" value={campaign.target_creator_niche} /><CampaignDatum label="Deliverables" value={`${deliverableCounts[campaign.id] ?? 0}`} /><CampaignDatum label="Matches" value={`${matchCounts[campaign.id] ?? 0}`} /></dl>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400"><span>{campaign.deal_type.replaceAll('_', ' ')}</span><span>{campaign.submission_deadline ? `Due ${formatDate(campaign.submission_deadline)}` : `Created ${formatDate(campaign.created_at)}`}</span></div>
    </article>)}</section> : <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><EmptyState icon={BriefcaseBusiness} title="No campaigns yet" description="Create your first structured campaign to define terms and find suitable creators." actionLabel="Create your first campaign" actionHref="/brand/campaigns/new" /></section>}
  </AppShell>;
}

function countByCampaign(rows: Array<{ campaign_id: string }>) {
  return rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.campaign_id]: (counts[row.campaign_id] ?? 0) + 1 }), {});
}

function Summary({ icon: Icon, label, value }: { icon: typeof BriefcaseBusiness; label: string; value: number }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><span><strong className="block text-xl font-bold text-slate-950">{value}</strong><span className="text-xs text-slate-500">{label}</span></span></div>;
}

function CampaignDatum({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</dt><dd className="mt-1 truncate text-xs font-semibold text-slate-800">{value}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
