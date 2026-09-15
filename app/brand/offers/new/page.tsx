import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { OfferTermsForm, type OfferCampaignOption } from '@/components/offers/offer-terms-form';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getCreatorDiscovery } from '@/lib/marketplace/feeds';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCompactNumber } from '@/lib/utils';
import type { OfferInput } from '@/lib/validation/offer';

export const metadata: Metadata = { title: 'Create offer' };

interface CampaignRow {
  id: string; title: string; budget: number; product_name: string | null; product_value: number; deal_type: OfferInput['dealType'];
  usage_rights: string | null; usage_duration_days: number | null; paid_ad_rights: boolean; exclusivity: boolean;
  exclusivity_duration_days: number | null; submission_deadline: string | null; territory: string | null; additional_requirements: string | null;
}
interface DeliverableRow { campaign_id: string; deliverable_type: string; quantity: number; notes: string | null }

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ creator?: string; campaign?: string }> }) {
  const { creator: creatorId, campaign: requestedCampaignId } = await searchParams;
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();

  if (!creatorId) {
    const creators = await getCreatorDiscovery(supabase!);
    return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500" href="/brand/offers"><ArrowLeft className="size-4" />Offers</Link><div className="mt-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Structured offer</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Choose a creator</h1><p className="mt-2 text-sm text-slate-500">Offers start from an explicit creator profile—never a conversation thread.</p></div>
      {creators.length ? <section className="mt-7 grid gap-4 lg:grid-cols-2">{creators.map((creator) => <Link className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md" href={`/brand/offers/new?creator=${creator.creatorId}${creator.bestCampaignId ? `&campaign=${creator.bestCampaignId}` : ''}`} key={creator.creatorId}><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 bg-cover bg-center font-bold text-violet-700" style={creator.avatarUrl ? { backgroundImage: `url(${JSON.stringify(creator.avatarUrl).slice(1, -1)})` } : undefined}>{!creator.avatarUrl ? creator.fullName.slice(0, 1) : null}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-950">{creator.fullName}</strong><span className="mt-1 block truncate text-xs text-slate-500">{creator.niche} · {creator.location} · {formatCompactNumber(Math.max(0, ...creator.socialAccounts.map((item) => Number(item.audience_count))))} top audience</span></span><ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-700" /></Link>)}</section> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><EmptyState icon={Search} title="No creators are available" description="Discoverable, completed creator profiles will appear here." /></section>}
    </AppShell>;
  }

  const creators = await getCreatorDiscovery(supabase!, creatorId);
  const creator = creators[0];
  if (!creator) return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}><section className="rounded-2xl border border-slate-200 bg-white p-5"><EmptyState icon={Search} title="Creator unavailable" description="This creator profile is not currently available for discovery." actionLabel="Choose another creator" actionHref="/brand/offers/new" /></section></AppShell>;

  const { data: profile, error: profileError } = await supabase!.from('brand_profiles').select('id').eq('user_id', account.id).single();
  if (profileError || !profile) throw new Error('Brand profile is temporarily unavailable.');
  const { data: campaignData, error: campaignError } = await supabase!.from('campaigns').select('id,title,budget,product_name,product_value,deal_type,usage_rights,usage_duration_days,paid_ad_rights,exclusivity,exclusivity_duration_days,submission_deadline,territory,additional_requirements').eq('brand_profile_id', profile.id).eq('status', 'PUBLISHED').order('created_at', { ascending: false });
  if (campaignError) throw new Error('Campaign options are temporarily unavailable.');
  const activeCampaigns = (campaignData ?? []) as CampaignRow[];
  const ids = activeCampaigns.map((campaign) => campaign.id);
  const { data: deliverableData, error: deliverableError } = ids.length
    ? await supabase!.from('campaign_deliverables').select('campaign_id,deliverable_type,quantity,notes').in('campaign_id', ids).order('position')
    : { data: [], error: null };
  if (deliverableError) throw new Error('Campaign deliverables are temporarily unavailable.');
  const deliverables = (deliverableData ?? []) as DeliverableRow[];
  const fallback = blankOffer();
  const options: OfferCampaignOption[] = activeCampaigns.map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    defaults: {
      cashPayment: Number(campaign.budget),
      productName: campaign.product_name ?? '',
      productValue: Number(campaign.product_value),
      dealType: campaign.deal_type,
      deliverables: deliverables.filter((item) => item.campaign_id === campaign.id).map((item) => ({ type: item.deliverable_type, quantity: item.quantity, notes: item.notes ?? '' })),
      usageRights: campaign.usage_rights ?? '',
      usageDurationDays: campaign.usage_duration_days ?? undefined,
      paidAdRights: campaign.paid_ad_rights,
      exclusivity: campaign.exclusivity,
      exclusivityDurationDays: campaign.exclusivity_duration_days ?? undefined,
      deadline: campaign.submission_deadline ? localDateTime(campaign.submission_deadline) : '',
      territory: campaign.territory ?? 'India',
      notes: campaign.additional_requirements ?? '',
    },
  })).filter((campaign) => campaign.defaults.deliverables.length > 0);
  const initialCampaign = options.find((campaign) => campaign.id === requestedCampaignId);

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950" href="/brand/offers"><ArrowLeft className="size-4" />Offers</Link>
    <div className="mt-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Structured offer</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Create offer for {creator.fullName}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Define the complete deal now. If either party changes a term later, Collab Deal OS records a new immutable version.</p></div>
    <section className="mt-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 bg-cover bg-center font-bold text-violet-700" style={creator.avatarUrl ? { backgroundImage: `url(${JSON.stringify(creator.avatarUrl).slice(1, -1)})` } : undefined}>{!creator.avatarUrl ? creator.fullName.slice(0, 1) : null}</span><span><strong className="block text-sm text-slate-950">{creator.fullName}</strong><span className="mt-1 block text-xs text-slate-500">@{creator.username} · {creator.niche} · expected {creator.expectedRateLow.toLocaleString('en-IN')}–{creator.expectedRateHigh.toLocaleString('en-IN')} INR</span></span></section>
    <div className="mt-6"><OfferTermsForm role="brand" mode="create" creatorId={creator.creatorId} campaigns={options} initialCampaignId={initialCampaign?.id ?? null} initialValues={initialCampaign?.defaults ?? fallback} /></div>
  </AppShell>;
}

function blankOffer(): OfferInput { return { cashPayment: 0, productName: '', productValue: 0, dealType: 'PAID', deliverables: [{ type: 'Instagram Reel', quantity: 1, notes: '' }], usageRights: '', usageDurationDays: undefined, paidAdRights: false, exclusivity: false, exclusivityDurationDays: undefined, deadline: '', territory: 'India', notes: '' }; }
function localDateTime(value: string) { return new Date(value).toISOString().slice(0, 16); }
