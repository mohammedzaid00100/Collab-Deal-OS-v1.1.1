import type { Metadata } from 'next';
import { ProductView } from '@/components/analytics/product-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeIndianRupee, FileImage, ListChecks, MapPin, ShieldCheck, Sparkles, Target, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { SaveOpportunityButton } from '@/components/opportunities/save-opportunity-button';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getCreatorOpportunities } from '@/lib/marketplace/feeds';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCompactNumber, formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Opportunity details' };

export default async function OpportunityDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase!.from('creator_profiles').select('id').eq('user_id', account.id).single();
  if (profileError || !profile) throw new Error('Creator profile is temporarily unavailable.');
  const [opportunities, savedResult] = await Promise.all([
    getCreatorOpportunities(supabase!, id),
    supabase!.from('saved_opportunities').select('campaign_id').eq('creator_profile_id', profile.id).eq('campaign_id', id).maybeSingle(),
  ]);
  if (savedResult.error) throw new Error('Saved opportunity state is temporarily unavailable.');
  const opportunity = opportunities[0];
  if (!opportunity) notFound();

  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
    <ProductView event="opportunity viewed" />
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950" href="/creator/opportunities"><ArrowLeft className="size-4" />Opportunities</Link>
    <div className="mt-3 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <div className="min-w-0">
        <div className="relative flex min-h-64 items-end overflow-hidden rounded-2xl bg-gradient-to-br from-violet-100 via-slate-50 to-blue-100 bg-cover bg-center p-5 sm:min-h-80 sm:p-7" style={opportunity.assetUrl ? { backgroundImage: `linear-gradient(transparent 20%, rgb(15 23 42 / 78%)), url(${JSON.stringify(opportunity.assetUrl).slice(1, -1)})` } : undefined}>
          {!opportunity.assetUrl ? <FileImage className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-violet-300" /> : null}
          <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-emerald-700 shadow-sm">{opportunity.matchScore}% match</span>
          <div className={opportunity.assetUrl ? 'relative text-white' : 'relative text-slate-950'}><div className="flex flex-wrap gap-2"><Pill>{opportunity.platform}</Pill><Pill>{opportunity.niche}</Pill><Pill>{opportunity.dealType.replaceAll('_', ' ')}</Pill></div><p className="mt-4 text-xs font-bold uppercase tracking-[0.11em] opacity-75">{opportunity.brandName}</p><h1 className="mt-1 max-w-3xl text-2xl font-bold tracking-[-0.04em] sm:text-4xl">{opportunity.title}</h1></div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Campaign brief</p><h2 className="mt-1 text-lg font-bold text-slate-950">What the brand is looking for</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{opportunity.description}</p><dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Objective" value={opportunity.objective} /><Detail label="Target location" value={opportunity.targetLocation ?? 'Open'} /><Detail label="Creator size" value={`${formatCompactNumber(opportunity.targetFollowersMin)}${opportunity.targetFollowersMax ? ` – ${formatCompactNumber(opportunity.targetFollowersMax)}` : '+'}`} /><Detail label="Engagement target" value={opportunity.targetEngagementMin != null ? `${opportunity.targetEngagementMin}%${opportunity.targetEngagementMax != null ? ` – ${opportunity.targetEngagementMax}%` : '+'}` : 'Open'} /><Detail label="Campaign timeline" value={formatRange(opportunity.startsAt, opportunity.endsAt)} /><Detail label="Submission deadline" value={opportunity.deadline ? formatDate(opportunity.deadline) : 'Not set'} /></dl></section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ListChecks className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Scope</p><h2 className="mt-1 text-lg font-bold text-slate-950">Required deliverables</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{opportunity.deliverables.map((deliverable, index) => <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4" key={`${deliverable.type}-${index}`}><div><strong className="text-sm text-slate-900">{deliverable.type}</strong>{deliverable.notes ? <p className="mt-1 text-xs leading-5 text-slate-500">{deliverable.notes}</p> : null}</div><span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">×{deliverable.quantity}</span></div>)}</div></section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-950">Rights and conditions</h2></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Detail label="Usage rights" value={opportunity.usageRights ?? 'Not specified'} /><Detail label="Usage duration" value={opportunity.usageDurationDays != null ? `${opportunity.usageDurationDays} days` : 'Not specified'} /><Detail label="Paid advertising" value={opportunity.paidAdRights ? 'Included' : 'Not included'} /><Detail label="Exclusivity" value={opportunity.exclusivity ? `${opportunity.exclusivityDurationDays ?? '—'} days` : 'Not included'} /><Detail label="Territory" value={opportunity.territory ?? 'Not specified'} /></dl>{opportunity.additionalRequirements ? <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Additional requirements</p><p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.additionalRequirements}</p></div> : null}</section>
      </div>

      <aside className="grid content-start gap-5 xl:sticky xl:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Deal value</p><div className="mt-4 grid gap-4"><Value icon={BadgeIndianRupee} label="Cash payment" value={formatInr(opportunity.budget)} /><Value icon={Target} label="Product / perk" value={opportunity.productName ?? 'None'} /><Value icon={BadgeIndianRupee} label="Product value" value={opportunity.productValue ? formatInr(opportunity.productValue) : 'None'} /></div><div className="mt-5 rounded-xl bg-slate-950 p-4 text-white"><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Combined value</span><strong className="mt-1 block text-2xl font-bold">{formatInr(opportunity.budget + opportunity.productValue)}</strong><span className="mt-1 block text-xs text-slate-400">Before scope and rights evaluation</span></div></section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Why this appeared</p><h2 className="mt-1 text-lg font-bold text-emerald-950">{opportunity.matchScore}% match</h2></div><UsersRound className="size-6 text-emerald-600" /></div><p className="mt-3 text-xs leading-5 text-emerald-900/75">{opportunity.matchExplanation}</p></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MapPin className="size-5" /></span><div><span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">Brand</span><strong className="block text-sm text-slate-950">{opportunity.brandName}</strong></div></div><div className="mt-5 grid gap-2"><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-semibold text-white" href={`/creator/ai-advisor?campaign=${opportunity.campaignId}`}><Sparkles className="size-4" />Analyze deal value</Link><SaveOpportunityButton creatorProfileId={profile.id} campaignId={opportunity.campaignId} initiallySaved={Boolean(savedResult.data)} /></div><p className="mt-4 text-[11px] leading-5 text-slate-400">Analysis estimates value from deterministic inputs. It does not apply to the campaign or start a chat.</p></section>
      </aside>
    </div>
  </AppShell>;
}

function Pill({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-700 shadow-sm">{children}</span>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold leading-6 text-slate-700">{value}</dd></div>; }
function Value({ icon: Icon, label, value }: { icon: typeof BadgeIndianRupee; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-slate-50 text-violet-700"><Icon className="size-4" /></span><span><span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</span><strong className="mt-0.5 block text-sm text-slate-900">{value}</strong></span></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
function formatRange(start: string | null, end: string | null) { if (!start && !end) return 'Not specified'; if (start && end) return `${formatDate(start)} – ${formatDate(end)}`; return formatDate(start ?? end!); }
