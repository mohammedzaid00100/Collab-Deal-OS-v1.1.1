import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeIndianRupee, CalendarDays, FileImage, ListChecks, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { CampaignLifecycleActions } from '@/components/campaigns/campaign-lifecycle-actions';
import { CampaignStatus } from '@/components/campaigns/campaign-status';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createPrivateAssetUrl } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCompactNumber, formatInr } from '@/lib/utils';
import type { CreatorSocialMetric } from '@/types/marketplace';

export const metadata: Metadata = { title: 'Campaign details' };

interface CampaignRow {
  id: string; title: string; description: string; status: string; platform: string;
  target_creator_niche: string; target_location: string | null; target_followers_min: number;
  target_followers_max: number | null; target_engagement_min: number | null; target_engagement_max: number | null;
  budget: number; product_name: string | null; product_value: number; deal_type: string; objective: string;
  starts_at: string | null; ends_at: string | null; submission_deadline: string | null; usage_rights: string | null;
  usage_duration_days: number | null; paid_ad_rights: boolean; exclusivity: boolean;
  exclusivity_duration_days: number | null; territory: string | null; additional_requirements: string | null;
  asset_path: string | null; created_at: string;
}

interface DeliverableRow { deliverable_type: string; quantity: number; notes: string | null; position: number }
interface MatchRow {
  creator_id: string; full_name: string; username: string; niche: string; location: string;
  average_views: number; engagement_rate: number; expected_rate_low: number; expected_rate_high: number;
  currency: string; avatar_path: string | null; social_accounts: CreatorSocialMetric[];
  match_score: number; score_components: Record<string, number>; match_explanation: string;
}

export default async function CampaignDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Campaign details are temporarily unavailable.');
  if (!data) notFound();
  const campaign = data as CampaignRow;
  const [{ data: deliverableData, error: deliverableError }, { data: matchData, error: matchError }, assetUrl] = await Promise.all([
    supabase!.from('campaign_deliverables').select('deliverable_type,quantity,notes,position').eq('campaign_id', id).order('position'),
    supabase!.rpc('brand_campaign_matches', { target_campaign_id: id }),
    createPrivateAssetUrl('campaign-assets', campaign.asset_path),
  ]);
  if (deliverableError || matchError) throw new Error('Campaign scope or match data is temporarily unavailable.');
  const deliverables = (deliverableData ?? []) as DeliverableRow[];
  const rawMatches = (matchData ?? []) as MatchRow[];
  const matches = await Promise.all(rawMatches.map(async (match) => ({ ...match, avatarUrl: await createPrivateAssetUrl('avatars', match.avatar_path) })));

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950" href="/brand/campaigns"><ArrowLeft className="size-4" />Campaigns</Link>
    {notice ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">The campaign was saved, but its thumbnail could not be attached. The campaign terms and matches are safe.</div> : null}
    <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="max-w-3xl"><div className="flex flex-wrap items-center gap-2"><CampaignStatus status={campaign.status} /><span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{campaign.platform} · {campaign.deal_type.replaceAll('_', ' ')}</span></div><h1 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">{campaign.title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{campaign.description}</p></div><CampaignLifecycleActions campaignId={campaign.id} status={campaign.status} /></div>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Campaign terms summary">
      <Metric icon={BadgeIndianRupee} label="Total deal value" value={formatInr(Number(campaign.budget) + Number(campaign.product_value))} detail={`${formatInr(Number(campaign.budget))} cash`} />
      <Metric icon={UsersRound} label="Creator matches" value={`${matches.length}`} detail="Weighted score of 40+" />
      <Metric icon={ListChecks} label="Deliverables" value={`${deliverables.reduce((sum, item) => sum + item.quantity, 0)}`} detail={`${deliverables.length} content type${deliverables.length === 1 ? '' : 's'}`} />
      <Metric icon={CalendarDays} label="Submission deadline" value={campaign.submission_deadline ? formatDate(campaign.submission_deadline) : 'Not set'} detail={campaign.ends_at ? `Campaign ends ${formatDate(campaign.ends_at)}` : 'No campaign end date'} />
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <div className="grid gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-h-52 sm:grid-cols-[240px_minmax(0,1fr)]"><div className="flex min-h-48 items-center justify-center bg-gradient-to-br from-violet-100 via-slate-50 to-blue-100 bg-cover bg-center" style={assetUrl ? { backgroundImage: `url(${JSON.stringify(assetUrl).slice(1, -1)})` } : undefined}>{!assetUrl ? <FileImage className="size-10 text-violet-300" /> : null}</div><div className="p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Creator criteria</p><dl className="mt-4 grid gap-4 sm:grid-cols-2"><Detail label="Niche" value={campaign.target_creator_niche} /><Detail label="Location / audience" value={campaign.target_location ?? 'Open'} /><Detail label="Follower range" value={`${formatCompactNumber(Number(campaign.target_followers_min))}${campaign.target_followers_max ? ` – ${formatCompactNumber(Number(campaign.target_followers_max))}` : '+'}`} /><Detail label="Engagement" value={campaign.target_engagement_min != null ? `${campaign.target_engagement_min}%${campaign.target_engagement_max != null ? ` – ${campaign.target_engagement_max}%` : '+'}` : 'Open'} /><Detail label="Objective" value={campaign.objective} /><Detail label="Territory" value={campaign.territory ?? 'Not specified'} /></dl></div></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ListChecks className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Campaign scope</p><h2 className="mt-1 text-lg font-bold text-slate-950">Deliverables</h2></div></div><div className="mt-5 grid gap-3">{deliverables.map((item, index) => <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4" key={`${item.deliverable_type}-${index}`}><div><strong className="text-sm text-slate-900">{item.deliverable_type}</strong>{item.notes ? <p className="mt-1 text-xs leading-5 text-slate-500">{item.notes}</p> : null}</div><span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">×{item.quantity}</span></div>)}</div></section>
      </div>

      <aside className="grid content-start gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" /><h2 className="text-sm font-bold text-slate-950">Rights & conditions</h2></div><dl className="mt-4 grid gap-4"><Detail label="Usage rights" value={campaign.usage_rights ?? 'Not specified'} /><Detail label="Usage duration" value={campaign.usage_duration_days != null ? `${campaign.usage_duration_days} days` : 'Not specified'} /><Detail label="Paid advertising" value={campaign.paid_ad_rights ? 'Included' : 'Not included'} /><Detail label="Exclusivity" value={campaign.exclusivity ? `${campaign.exclusivity_duration_days ?? '—'} days` : 'Not included'} /></dl>{campaign.additional_requirements ? <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Additional requirements</p><p className="mt-2 text-xs leading-5 text-slate-600">{campaign.additional_requirements}</p></div> : null}</section>
      </aside>
    </div>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Explainable matching</p><h2 className="mt-1 text-lg font-bold text-slate-950">Creators matched to this campaign</h2><p className="mt-1 text-xs text-slate-500">Niche 30% · audience/location 20% · size 15% · engagement 15% · budget 10% · platform 10%</p></div><Link className="text-sm font-semibold text-violet-700" href="/brand/creators">Open creator discovery</Link></div>
      {matches.length ? <div className="mt-5 grid gap-4 lg:grid-cols-2">{matches.map((match) => <article className="rounded-2xl border border-slate-200 p-4" key={match.creator_id}><div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 bg-cover bg-center text-sm font-bold text-violet-700" style={match.avatarUrl ? { backgroundImage: `url(${JSON.stringify(match.avatarUrl).slice(1, -1)})` } : undefined}>{!match.avatarUrl ? match.full_name.slice(0, 1).toUpperCase() : null}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-950">{match.full_name}</h3><p className="mt-0.5 text-xs text-slate-500">{match.niche} · {match.location}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{Number(match.match_score)}%</span></div></div></div><p className="mt-3 text-xs leading-5 text-slate-600">{match.match_explanation}</p><div className="mt-4 flex flex-wrap gap-2">{match.social_accounts.slice(0, 2).map((social) => <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700" key={social.platform}>{pretty(social.platform)} · {formatCompactNumber(Number(social.audience_count))}</span>)}</div><div className="mt-4 flex flex-wrap gap-2"><Link className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800" href={`/brand/creators/${match.creator_id}`}>View creator</Link><Link className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white" href={`/brand/offers/new?creator=${match.creator_id}&campaign=${campaign.id}`}><Sparkles className="size-3.5" />Create offer</Link></div></article>)}</div> : <div className="mt-5"><EmptyState icon={UsersRound} title={campaign.status === 'PUBLISHED' ? 'No strong matches yet' : 'Publish to generate matches'} description={campaign.status === 'PUBLISHED' ? 'No eligible creator currently meets the 40-point threshold and required niche/platform gates.' : 'Publishing runs the weighted engine against eligible creator profiles.'} /></div>}
    </section>
  </AppShell>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof BadgeIndianRupee; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{label}</span><Icon className="size-4 text-violet-600" /></div><strong className="mt-3 block text-xl font-bold tracking-[-0.03em] text-slate-950">{value}</strong><span className="mt-1 block text-[11px] text-slate-400">{detail}</span></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1 text-xs font-semibold leading-5 text-slate-700">{value}</dd></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
function pretty(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
