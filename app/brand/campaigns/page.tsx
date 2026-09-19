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

  return (
    <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Brand workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
            Campaigns
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5A5870] dark:text-[#9CA1BA]">
            Structure every collaboration clearly, then publish it to generate creator matches.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-sm font-semibold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]"
          style={{ color: '#fff' }}
          href="/brand/campaigns/new"
        >
          <FilePlus2 className="size-4" />
          Create campaign
        </Link>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Campaign summary">
        <Summary icon={BriefcaseBusiness} label="All campaigns" value={campaigns.length} detail="Total collaborations created" />
        <Summary icon={Layers3} label="Published" value={campaigns.filter((item) => item.status === 'PUBLISHED').length} detail="Active in marketplace" />
        <Summary icon={UsersRound} label="Creator matches" value={Object.values(matchCounts).reduce((sum, count) => sum + count, 0)} detail="Algorithmic matches found" />
      </section>

      {campaigns.length ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Campaign list">
          {campaigns.map((campaign) => (
            <article
              className="group rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:bg-[#FBF9F5] hover:shadow-[6px_6px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] dark:hover:border-[#6366F1] dark:hover:bg-[#1C1E30]"
              key={campaign.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CampaignStatus status={campaign.status} />
                    <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                      {campaign.platform}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold tracking-[-0.03em] text-[#0D0C1D] transition-colors group-hover:text-[#4F46E5] dark:text-[#F3F4F8] dark:group-hover:text-[#818CF8]">
                    {campaign.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5A5870] dark:text-[#9CA1BA]">
                    {campaign.description}
                  </p>
                </div>
                <Link
                  className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all group-hover:bg-[#4F46E5] group-hover:text-white dark:border-[#262A3D] dark:bg-[#11131E] dark:text-slate-300 dark:shadow-[2px_2px_0_#000000] dark:group-hover:bg-[#6366F1] dark:group-hover:text-white"
                  href={`/brand/campaigns/${campaign.id}`}
                  aria-label={`Open ${campaign.title}`}
                >
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t-2 border-[#0D0C1D]/10 pt-4 dark:border-[#262A3D] sm:grid-cols-4">
                <CampaignDatum label="Total value" value={formatInr(Number(campaign.budget) + Number(campaign.product_value))} />
                <CampaignDatum label="Creator niche" value={campaign.target_creator_niche} />
                <CampaignDatum label="Deliverables" value={`${deliverableCounts[campaign.id] ?? 0}`} />
                <CampaignDatum label="Matches" value={`${matchCounts[campaign.id] ?? 0}`} />
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#5A5870] dark:text-[#9CA1BA]">
                <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.05em] text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                  {campaign.deal_type.replaceAll('_', ' ')}
                </span>
                <span className="font-medium">
                  {campaign.submission_deadline ? `Due ${formatDate(campaign.submission_deadline)}` : `Created ${formatDate(campaign.created_at)}`}
                </span>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <EmptyState
            icon={BriefcaseBusiness}
            title="No campaigns yet"
            description="Create your first structured campaign to define terms and find suitable creators."
            actionLabel="Create your first campaign"
            actionHref="/brand/campaigns/new"
          />
        </section>
      )}
    </AppShell>
  );
}

function countByCampaign(rows: Array<{ campaign_id: string }>) {
  return rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.campaign_id]: (counts[row.campaign_id] ?? 0) + 1 }), {});
}

function Summary({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <strong className="mt-2 block text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
        {value}
      </strong>
      {detail ? (
        <span className="mt-1 block text-xs text-[#5A5870] dark:text-[#9CA1BA]">{detail}</span>
      ) : null}
    </div>
  );
}

function CampaignDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">{label}</dt>
      <dd className="mt-1 truncate text-xs font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
