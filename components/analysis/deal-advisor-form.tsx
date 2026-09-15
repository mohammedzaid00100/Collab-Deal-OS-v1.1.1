'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Bot, CircleAlert, Gauge, IndianRupee, ListChecks, Plus, ShieldCheck, Sparkles, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, SelectInput, TextArea, TextInput } from '@/components/ui/form-field';
import { campaignDeliverableTypes } from '@/lib/validation/campaign';
import { dealAnalysisInputSchema, pricingPlatforms, type DealAnalysisFormInput } from '@/lib/validation/analysis';
import type { AccountType, MetricStatus } from '@/types/domain';

interface DealAdvisorFormProps {
  role: AccountType;
  initialValues: DealAnalysisFormInput;
  sourceLabel?: string | null;
  freeEvaluationsRemaining: number;
}

export function DealAdvisorForm({ role, initialValues, sourceLabel, freeEvaluationsRemaining }: DealAdvisorFormProps) {
  const router = useRouter();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<DealAnalysisFormInput>({ resolver: zodResolver(dealAnalysisInputSchema), defaultValues: initialValues, mode: 'onTouched' });
  const deliverables = useFieldArray({ control: form.control, name: 'deal.deliverables' });
  const productValue = useWatch({ control: form.control, name: 'deal.productValue' });
  const usageCategory = useWatch({ control: form.control, name: 'deal.usageCategory' });
  const perpetualUsage = useWatch({ control: form.control, name: 'deal.perpetualUsage' });
  const paidAds = useWatch({ control: form.control, name: 'deal.paidAdRights' });
  const exclusivity = useWatch({ control: form.control, name: 'deal.exclusivity' });
  const number = { valueAsNumber: true } as const;
  const errors = form.formState.errors;

  useEffect(() => {
    if (usageCategory === 'CREATOR_CHANNELS_ONLY' || perpetualUsage) form.setValue('deal.usageDurationDays', 0);
  }, [form, perpetualUsage, usageCategory]);
  useEffect(() => {
    if (!paidAds) form.setValue('deal.paidAdDurationDays', 0);
    else if (form.getValues('deal.paidAdDurationDays') <= 0) form.setValue('deal.paidAdDurationDays', 30);
  }, [form, paidAds]);
  useEffect(() => {
    if (!exclusivity) form.setValue('deal.exclusivityDurationDays', 0);
    else if (form.getValues('deal.exclusivityDurationDays') <= 0) form.setValue('deal.exclusivityDurationDays', 30);
  }, [exclusivity, form]);

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    setSubmitError(null);
    const commandId = requestId ?? crypto.randomUUID();
    if (!requestId) setRequestId(commandId);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: commandId, input: values }),
      });
      const payload = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok || !payload.redirectTo) {
        setRequestId(null);
        setSubmitError(payload.error ?? 'The evaluation could not be completed.');
        setPending(false);
        return;
      }
      router.push(payload.redirectTo);
      router.refresh();
    } catch {
      setSubmitError('The request may still be processing. Retry to safely check the same evaluation.');
      setPending(false);
    }
  }, () => setSubmitError('Review the highlighted inputs before running the evaluation.'));

  return <form className="grid gap-6" noValidate onSubmit={submit}>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-blue-50 p-4">
        <div className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Sparkles className="size-5" /></span><div><strong className="text-sm text-slate-950">Deterministic pricing first</strong><p className="mt-1 text-xs leading-5 text-slate-600">The backend fixes every monetary value. OpenAI explains those values for your {role} perspective but cannot replace them.</p>{sourceLabel ? <p className="mt-2 text-xs font-semibold text-violet-700">Prefilled from {sourceLabel}; the server revalidates the current offer and creator metrics.</p> : null}</div></div>
      </div>
      <div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-300">Free evaluations remaining</p><strong className="mt-2 block text-3xl font-bold">{freeEvaluationsRemaining} of 5</strong><p className="mt-1 text-xs leading-5 text-slate-300">Browsing stays available at zero.</p></div>
    </div>

    <AdvisorSection icon={UsersRound} eyebrow="Performance" title="Creator metrics" description="Followers never come from a social URL. Average views and engagement carry more pricing weight.">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FieldShell label="Platform" name="creator.platform" error={errors.creator?.platform?.message}><SelectInput id="creator.platform" {...form.register('creator.platform')}>{pricingPlatforms.map((platform) => <option key={platform}>{platform}</option>)}</SelectInput></FieldShell>
        <FieldShell label="Niche" name="creator.niche" error={errors.creator?.niche?.message}><TextInput id="creator.niche" {...form.register('creator.niche')} /></FieldShell>
        <FieldShell label="Followers / subscribers" name="creator.followers" error={errors.creator?.followers?.message}><TextInput id="creator.followers" type="number" min="0" {...form.register('creator.followers', number)} /></FieldShell>
        <FieldShell label="Follower status" name="creator.followersStatus" error={errors.creator?.followersStatus?.message}><MetricStatusSelect id="creator.followersStatus" initial={initialValues.creator.followersStatus} {...form.register('creator.followersStatus')} /></FieldShell>
        <FieldShell label="Average views" name="creator.averageViews" error={errors.creator?.averageViews?.message}><TextInput id="creator.averageViews" type="number" min="0" {...form.register('creator.averageViews', number)} /></FieldShell>
        <FieldShell label="Average-view status" name="creator.averageViewsStatus" error={errors.creator?.averageViewsStatus?.message}><MetricStatusSelect id="creator.averageViewsStatus" initial={initialValues.creator.averageViewsStatus} {...form.register('creator.averageViewsStatus')} /></FieldShell>
        <FieldShell label="Engagement rate (%)" name="creator.engagementRate" error={errors.creator?.engagementRate?.message}><TextInput id="creator.engagementRate" type="number" min="0" max="100" step="0.01" {...form.register('creator.engagementRate', number)} /></FieldShell>
        <FieldShell label="Engagement status" name="creator.engagementRateStatus" error={errors.creator?.engagementRateStatus?.message}><MetricStatusSelect id="creator.engagementRateStatus" initial={initialValues.creator.engagementRateStatus} {...form.register('creator.engagementRateStatus')} /></FieldShell>
        <FieldShell label="Audience region" name="creator.audienceRegion" error={errors.creator?.audienceRegion?.message}><TextInput id="creator.audienceRegion" {...form.register('creator.audienceRegion')} /></FieldShell>
        <FieldShell label="Creator location" name="creator.location" error={errors.creator?.location?.message}><TextInput id="creator.location" {...form.register('creator.location')} /></FieldShell>
      </div>
    </AdvisorSection>

    <AdvisorSection icon={IndianRupee} eyebrow="Current offer" title="Cash and product value" description="Product value is discounted by the configured realization rate and is never presented as cash.">
      <div className="grid gap-5 sm:grid-cols-3"><FieldShell label="Cash offer (₹)" name="deal.cashOffer" error={errors.deal?.cashOffer?.message}><TextInput id="deal.cashOffer" type="number" min="0" {...form.register('deal.cashOffer', number)} /></FieldShell><FieldShell label="Product value (₹)" name="deal.productValue" error={errors.deal?.productValue?.message}><TextInput id="deal.productValue" type="number" min="0" {...form.register('deal.productValue', number)} /></FieldShell><FieldShell label="Campaign budget (₹)" name="deal.campaignBudget" optional hint="Used only as a risk signal; budget never anchors fair value." error={errors.deal?.campaignBudget?.message}><TextInput id="deal.campaignBudget" type="number" min="0" {...form.register('deal.campaignBudget', number)} /></FieldShell></div>
      {productValue > 0 ? <Toggle label="Creator keeps the product" description="Only retained product receives a disclosed, discounted product credit." registration={form.register('deal.creatorKeepsProduct')} /> : null}
    </AdvisorSection>

    <AdvisorSection icon={ListChecks} eyebrow="Scope" title="Deliverables and turnaround" description="Each supported deliverable has an explicit multiplier and production floor.">
      <div className="grid gap-3">{deliverables.fields.map((field, index) => <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(180px,1fr)_100px_minmax(160px,1fr)_44px]" key={field.id}><FieldShell label="Deliverable" name={`deal.deliverables.${index}.type`} error={errors.deal?.deliverables?.[index]?.type?.message}><SelectInput id={`deal.deliverables.${index}.type`} {...form.register(`deal.deliverables.${index}.type`)}>{campaignDeliverableTypes.map((type) => <option key={type}>{type}</option>)}</SelectInput></FieldShell><FieldShell label="Quantity" name={`deal.deliverables.${index}.quantity`} error={errors.deal?.deliverables?.[index]?.quantity?.message}><TextInput id={`deal.deliverables.${index}.quantity`} type="number" min="1" {...form.register(`deal.deliverables.${index}.quantity`, number)} /></FieldShell><FieldShell label="Scope note" name={`deal.deliverables.${index}.notes`} optional error={errors.deal?.deliverables?.[index]?.notes?.message}><TextInput id={`deal.deliverables.${index}.notes`} {...form.register(`deal.deliverables.${index}.notes`)} /></FieldShell><button className="mt-7 flex size-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" type="button" disabled={deliverables.fields.length === 1} onClick={() => deliverables.remove(index)} aria-label={`Remove deliverable ${index + 1}`}><Trash2 className="size-4" /></button></div>)}</div>
      <div className="flex flex-wrap items-end gap-4"><Button type="button" variant="secondary" onClick={() => deliverables.append({ type: 'Instagram Reel', quantity: 1, notes: '' })}><Plus className="size-4" />Add deliverable</Button><div className="w-full max-w-xs"><FieldShell label="Content turnaround (days)" name="deal.turnaroundDays" error={errors.deal?.turnaroundDays?.message}><TextInput id="deal.turnaroundDays" type="number" min="1" {...form.register('deal.turnaroundDays', number)} /></FieldShell></div></div>
    </AdvisorSection>

    <AdvisorSection icon={ShieldCheck} eyebrow="Rights" title="Usage, ads, territory, and exclusivity" description="Normalized choices drive pricing. Free text is retained as context but never parsed into a hidden multiplier.">
      <div className="grid gap-5 sm:grid-cols-2"><FieldShell label="Usage category" name="deal.usageCategory" error={errors.deal?.usageCategory?.message}><SelectInput id="deal.usageCategory" {...form.register('deal.usageCategory')}><option value="CREATOR_CHANNELS_ONLY">Creator channels only</option><option value="BRAND_ORGANIC">Brand organic use</option><option value="MULTI_CHANNEL_ORGANIC">Multi-channel organic use</option></SelectInput></FieldShell><FieldShell label="Usage duration (days)" name="deal.usageDurationDays" error={errors.deal?.usageDurationDays?.message}><TextInput id="deal.usageDurationDays" type="number" min="0" readOnly={usageCategory === 'CREATOR_CHANNELS_ONLY' || perpetualUsage} {...form.register('deal.usageDurationDays', number)} /></FieldShell></div>
      <div className="grid gap-3 sm:grid-cols-2"><Toggle label="Perpetual usage" description="Applies the configured maximum usage premium." registration={form.register('deal.perpetualUsage')} /><Toggle label="Paid advertising rights" description="Adds a separate duration-based paid-media premium." registration={form.register('deal.paidAdRights')} /><Toggle label="Whitelisting" description="Brand may promote through the creator identity when supported." registration={form.register('deal.whitelisting')} /><Toggle label="Category exclusivity" description="Creator avoids competing brands for the selected duration." registration={form.register('deal.exclusivity')} /></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><FieldShell label="Paid-ad duration (days)" name="deal.paidAdDurationDays" error={errors.deal?.paidAdDurationDays?.message}><TextInput id="deal.paidAdDurationDays" type="number" min="0" readOnly={!paidAds} {...form.register('deal.paidAdDurationDays', number)} /></FieldShell><FieldShell label="Exclusivity duration (days)" name="deal.exclusivityDurationDays" error={errors.deal?.exclusivityDurationDays?.message}><TextInput id="deal.exclusivityDurationDays" type="number" min="0" readOnly={!exclusivity} {...form.register('deal.exclusivityDurationDays', number)} /></FieldShell><FieldShell label="Territory category" name="deal.territoryCategory" error={errors.deal?.territoryCategory?.message}><SelectInput id="deal.territoryCategory" {...form.register('deal.territoryCategory')}><option value="LOCAL">Local</option><option value="NATIONAL">National</option><option value="MULTI_COUNTRY">Multiple countries</option><option value="GLOBAL">Global</option></SelectInput></FieldShell><FieldShell label="Territory detail" name="deal.territoryText" error={errors.deal?.territoryText?.message}><TextInput id="deal.territoryText" {...form.register('deal.territoryText')} /></FieldShell></div>
      <FieldShell label="Rights wording" name="deal.usageRightsText" optional error={errors.deal?.usageRightsText?.message}><TextArea id="deal.usageRightsText" {...form.register('deal.usageRightsText')} /></FieldShell>
    </AdvisorSection>

    <AdvisorSection icon={Gauge} eyebrow="Context" title="Optional deal context" description="Context helps the explanation only. It cannot change fixed numbers."><FieldShell label="Campaign or brand context" name="deal.context" optional error={errors.deal?.context?.message}><TextArea id="deal.context" placeholder="Campaign fit, approval requirements, or relevant constraints" {...form.register('deal.context')} /></FieldShell></AdvisorSection>

    {submitError ? <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{submitError}</div> : null}
    <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_14px_45px_rgb(15_23_42/12%)] backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4"><p className="max-w-2xl text-xs leading-5 text-slate-500">This is an internal decision aid, not independently verified market research. Provider failure never produces a made-up verdict and does not consume quota.</p><Button className="shrink-0" type="submit" loading={pending}><Bot className="size-4" />Run AI evaluation</Button></div>
  </form>;
}

function AdvisorSection({ icon: Icon, eyebrow, title, description, children }: { icon: typeof Bot; eyebrow: string; title: string; description: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-6 flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 text-violet-700"><Icon className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">{eyebrow}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div></div><div className="grid gap-5">{children}</div></section>; }
function Toggle({ label, description, registration }: { label: string; description: string; registration: ReturnType<typeof useForm<DealAnalysisFormInput>>['register'] extends (name: infer _Name) => infer R ? R : never }) { return <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input className="mt-1 size-4 accent-violet-600" type="checkbox" {...registration} /><span><strong className="block text-sm text-slate-900">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span></label>; }
function MetricStatusSelect({ initial, ...props }: React.ComponentProps<typeof SelectInput> & { initial: MetricStatus }) { return <SelectInput {...props}><option value="CREATOR_DECLARED">Creator declared</option><option value="UNAVAILABLE">Unavailable</option><option value="API_VERIFIED" disabled={initial !== 'API_VERIFIED'}>API verified</option></SelectInput>; }
