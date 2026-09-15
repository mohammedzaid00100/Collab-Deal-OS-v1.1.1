'use client';

import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  CircleAlert,
  FileImage,
  IndianRupee,
  ListChecks,
  Plus,
  Rocket,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, SelectInput, TextArea, TextInput } from '@/components/ui/form-field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { campaignDeliverableTypes, campaignSchema, type CampaignInput } from '@/lib/validation/campaign';
import { creatorNiches, socialPlatforms } from '@/lib/validation/onboarding';

const defaults: CampaignInput = {
  title: '',
  description: '',
  platform: '',
  targetCreatorNiche: '',
  targetLocation: '',
  targetFollowersMin: 0,
  targetFollowersMax: undefined,
  targetEngagementMin: undefined,
  targetEngagementMax: undefined,
  budget: 0,
  dealType: 'PAID',
  productName: '',
  productValue: 0,
  deliverables: [{ type: 'Instagram Reel', quantity: 1, notes: '' }],
  objective: '',
  startsAt: '',
  endsAt: '',
  submissionDeadline: '',
  usageRights: '',
  usageDurationDays: undefined,
  paidAdRights: false,
  exclusivity: false,
  exclusivityDurationDays: undefined,
  territory: 'India',
  additionalRequirements: '',
};

export function CampaignBuilderForm() {
  const router = useRouter();
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savingAs, setSavingAs] = useState<'draft' | 'published' | null>(null);
  const form = useForm<CampaignInput>({ resolver: zodResolver(campaignSchema), defaultValues: defaults, mode: 'onTouched' });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'deliverables' });
  const dealType = useWatch({ control: form.control, name: 'dealType' });
  const exclusivity = useWatch({ control: form.control, name: 'exclusivity' });

  function selectThumbnail(file?: File) {
    setSubmitError(null);
    if (!file) return setThumbnail(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSubmitError('Choose a PNG, JPG, or WebP campaign image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSubmitError('Campaign image must be smaller than 8 MB.');
      return;
    }
    setThumbnail(file);
  }

  const submit = (publishNow: boolean) => form.handleSubmit(async (data) => {
    setSubmitError(null);
    setSavingAs(publishNow ? 'published' : 'draft');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSubmitError('Campaign storage is not configured yet. Connect Supabase before saving.');
      setSavingAs(null);
      return;
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setSubmitError('Your session has expired. Sign in again to continue.');
      setSavingAs(null);
      return;
    }

    const { data: result, error } = await supabase.rpc('create_campaign_with_deliverables', {
      campaign_data: {
        title: data.title,
        description: data.description,
        platform: data.platform,
        target_creator_niche: data.targetCreatorNiche,
        target_location: data.targetLocation || null,
        target_followers_min: data.targetFollowersMin,
        target_followers_max: data.targetFollowersMax ?? null,
        target_engagement_min: data.targetEngagementMin ?? null,
        target_engagement_max: data.targetEngagementMax ?? null,
        budget: data.budget,
        deal_type: data.dealType,
        product_name: data.productName || null,
        product_value: data.productValue,
        objective: data.objective,
        starts_at: data.startsAt || null,
        ends_at: data.endsAt || null,
        submission_deadline: data.submissionDeadline ? new Date(data.submissionDeadline).toISOString() : null,
        usage_rights: data.usageRights || null,
        usage_duration_days: data.usageDurationDays ?? null,
        paid_ad_rights: data.paidAdRights,
        exclusivity: data.exclusivity,
        exclusivity_duration_days: data.exclusivityDurationDays ?? null,
        territory: data.territory || null,
        additional_requirements: data.additionalRequirements || null,
      },
      deliverables_data: data.deliverables,
      publish_now: publishNow,
    });

    if (error) {
      setSubmitError(error.message);
      setSavingAs(null);
      return;
    }

    const campaignId = (result as { campaign_id?: string } | null)?.campaign_id;
    if (!campaignId) {
      setSubmitError('The campaign was not saved. Please try again.');
      setSavingAs(null);
      return;
    }

    let notice = '';
    if (thumbnail) {
      const extension = thumbnail.name.split('.').pop()?.toLowerCase() || 'jpg';
      const assetPath = `${userResult.user.id}/${campaignId}/cover.${extension}`;
      const { error: uploadError } = await supabase.storage.from('campaign-assets').upload(assetPath, thumbnail, {
        contentType: thumbnail.type,
        upsert: true,
      });
      if (uploadError) {
        notice = '?notice=asset-upload-failed';
      } else {
        const { error: assetError } = await supabase.rpc('set_campaign_asset_path', {
          target_campaign_id: campaignId,
          target_asset_path: assetPath,
        });
        if (assetError) notice = '?notice=asset-save-failed';
      }
    }

    router.push(`/brand/campaigns/${campaignId}${notice}`);
    router.refresh();
  }, () => {
    setSubmitError('Review the highlighted campaign fields before saving.');
  })();

  const { errors } = form.formState;
  const number = { valueAsNumber: true } as const;

  return (
    <form className="mt-7 grid gap-6" noValidate onSubmit={(event) => event.preventDefault()}>
      <FormSection icon={ListChecks} eyebrow="Campaign brief" title="What are you launching?" description="Clear context helps creators evaluate fit before an offer is created.">
        <FieldShell label="Campaign title" name="title" error={errors.title?.message}><TextInput id="title" placeholder="Summer skin reset with short-form creators" {...form.register('title')} /></FieldShell>
        <FieldShell label="Campaign description" name="description" error={errors.description?.message}><TextArea id="description" placeholder="Describe the campaign, the product, the creative direction, and what success looks like." {...form.register('description')} /></FieldShell>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell label="Primary platform" name="platform" error={errors.platform?.message}><SelectInput id="platform" {...form.register('platform')}><option value="">Select a platform</option>{socialPlatforms.map((value) => <option key={value}>{value}</option>)}</SelectInput></FieldShell>
          <FieldShell label="Campaign objective" name="objective" error={errors.objective?.message}><SelectInput id="objective" {...form.register('objective')}><option value="">Select an objective</option>{['Awareness', 'Product launch', 'Conversions', 'UGC production', 'App installs', 'Event promotion', 'Community growth'].map((value) => <option key={value}>{value}</option>)}</SelectInput></FieldShell>
        </div>
      </FormSection>

      <FormSection icon={UsersRound} eyebrow="Creator fit" title="Who should see this opportunity?" description="These inputs power the transparent weighted match score.">
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell label="Target creator niche" name="targetCreatorNiche" error={errors.targetCreatorNiche?.message}><SelectInput id="targetCreatorNiche" {...form.register('targetCreatorNiche')}><option value="">Select a niche</option>{creatorNiches.map((value) => <option key={value}>{value}</option>)}</SelectInput></FieldShell>
          <FieldShell label="Target location" name="targetLocation" optional error={errors.targetLocation?.message}><TextInput id="targetLocation" placeholder="India or Mumbai" {...form.register('targetLocation')} /></FieldShell>
          <FieldShell label="Minimum followers" name="targetFollowersMin" error={errors.targetFollowersMin?.message}><TextInput id="targetFollowersMin" type="number" min="0" {...form.register('targetFollowersMin', number)} /></FieldShell>
          <FieldShell label="Maximum followers" name="targetFollowersMax" optional error={errors.targetFollowersMax?.message}><TextInput id="targetFollowersMax" type="number" min="0" placeholder="No maximum" {...form.register('targetFollowersMax', number)} /></FieldShell>
          <FieldShell label="Minimum engagement (%)" name="targetEngagementMin" optional error={errors.targetEngagementMin?.message}><TextInput id="targetEngagementMin" type="number" min="0" max="100" step="0.01" {...form.register('targetEngagementMin', number)} /></FieldShell>
          <FieldShell label="Maximum engagement (%)" name="targetEngagementMax" optional error={errors.targetEngagementMax?.message}><TextInput id="targetEngagementMax" type="number" min="0" max="100" step="0.01" {...form.register('targetEngagementMax', number)} /></FieldShell>
        </div>
      </FormSection>

      <FormSection icon={IndianRupee} eyebrow="Value & scope" title="Define the commercial terms" description="Cash, products, and deliverables stay explicit throughout every revision.">
        <div className="grid gap-5 sm:grid-cols-3">
          <FieldShell label="Deal type" name="dealType" error={errors.dealType?.message}><SelectInput id="dealType" {...form.register('dealType')}><option value="PAID">Paid</option><option value="PRODUCT_ONLY">Product only</option><option value="HYBRID">Hybrid</option></SelectInput></FieldShell>
          <FieldShell label="Cash budget (₹)" name="budget" error={errors.budget?.message}><TextInput id="budget" type="number" min="0" disabled={dealType === 'PRODUCT_ONLY'} {...form.register('budget', number)} /></FieldShell>
          <FieldShell label="Product value (₹)" name="productValue" error={errors.productValue?.message}><TextInput id="productValue" type="number" min="0" disabled={dealType === 'PAID'} {...form.register('productValue', number)} /></FieldShell>
        </div>
        {dealType !== 'PAID' ? <FieldShell label="Product name" name="productName" error={errors.productName?.message}><TextInput id="productName" placeholder="Product or perk the creator keeps" {...form.register('productName')} /></FieldShell> : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Deliverables</h3><p className="mt-1 text-xs text-slate-500">Add each content format and quantity separately.</p></div><Button type="button" variant="secondary" onClick={() => append({ type: 'Instagram Reel', quantity: 1, notes: '' })}><Plus className="size-4" />Add</Button></div>
          <div className="mt-4 grid gap-3">
            {fields.map((field, index) => <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(180px,1fr)_110px_minmax(180px,1fr)_44px]" key={field.id}>
              <FieldShell label="Type" name={`deliverables.${index}.type`} error={errors.deliverables?.[index]?.type?.message}><SelectInput id={`deliverables.${index}.type`} {...form.register(`deliverables.${index}.type`)}>{campaignDeliverableTypes.map((value) => <option key={value}>{value}</option>)}</SelectInput></FieldShell>
              <FieldShell label="Quantity" name={`deliverables.${index}.quantity`} error={errors.deliverables?.[index]?.quantity?.message}><TextInput id={`deliverables.${index}.quantity`} type="number" min="1" {...form.register(`deliverables.${index}.quantity`, number)} /></FieldShell>
              <FieldShell label="Notes" name={`deliverables.${index}.notes`} optional error={errors.deliverables?.[index]?.notes?.message}><TextInput id={`deliverables.${index}.notes`} placeholder="Length, format, CTA…" {...form.register(`deliverables.${index}.notes`)} /></FieldShell>
              <button className="mt-7 flex size-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30" type="button" disabled={fields.length === 1} onClick={() => remove(index)} aria-label={`Remove deliverable ${index + 1}`}><Trash2 className="size-4" /></button>
            </div>)}
          </div>
          {errors.deliverables?.root?.message ? <p className="mt-2 text-xs font-medium text-red-600">{errors.deliverables.root.message}</p> : null}
        </div>
      </FormSection>

      <FormSection icon={CalendarDays} eyebrow="Timeline & rights" title="Remove ambiguity before publishing" description="Usage, paid media, exclusivity, and deadlines directly affect deal value.">
        <div className="grid gap-5 sm:grid-cols-3">
          <FieldShell label="Start date" name="startsAt" optional error={errors.startsAt?.message}><TextInput id="startsAt" type="date" {...form.register('startsAt')} /></FieldShell>
          <FieldShell label="End date" name="endsAt" optional error={errors.endsAt?.message}><TextInput id="endsAt" type="date" {...form.register('endsAt')} /></FieldShell>
          <FieldShell label="Submission deadline" name="submissionDeadline" optional error={errors.submissionDeadline?.message}><TextInput id="submissionDeadline" type="datetime-local" {...form.register('submissionDeadline')} /></FieldShell>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell label="Usage rights" name="usageRights" optional error={errors.usageRights?.message}><TextArea id="usageRights" placeholder="Where and how the brand may use the content" {...form.register('usageRights')} /></FieldShell>
          <div className="grid content-start gap-5">
            <FieldShell label="Usage duration (days)" name="usageDurationDays" optional error={errors.usageDurationDays?.message}><TextInput id="usageDurationDays" type="number" min="0" {...form.register('usageDurationDays', number)} /></FieldShell>
            <FieldShell label="Territory" name="territory" optional error={errors.territory?.message}><TextInput id="territory" placeholder="India, global, or a defined market" {...form.register('territory')} /></FieldShell>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Paid advertising rights" description="Brand may use the content in paid media." registration={form.register('paidAdRights')} />
          <Toggle label="Category exclusivity" description="Creator cannot promote named competitors during the term." registration={form.register('exclusivity')} />
        </div>
        {exclusivity ? <FieldShell label="Exclusivity duration (days)" name="exclusivityDurationDays" error={errors.exclusivityDurationDays?.message}><TextInput id="exclusivityDurationDays" type="number" min="1" {...form.register('exclusivityDurationDays', number)} /></FieldShell> : null}
        <FieldShell label="Additional requirements" name="additionalRequirements" optional error={errors.additionalRequirements?.message}><TextArea id="additionalRequirements" placeholder="Mandatory claims, approvals, disclosure requirements, or content constraints" {...form.register('additionalRequirements')} /></FieldShell>
      </FormSection>

      <FormSection icon={FileImage} eyebrow="Campaign visual" title="Add a recognisable thumbnail" description="Assets remain private and are delivered to authorized users with short-lived links.">
        <label className="flex min-h-28 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-blue-300 hover:bg-blue-50/50">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><FileImage className="size-5" /></span>
          <span className="min-w-0"><strong className="block text-sm text-slate-900">Campaign thumbnail</strong><span className="mt-1 block truncate text-xs text-slate-500">{thumbnail?.name ?? 'PNG, JPG, or WebP up to 8 MB'}</span></span>
          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectThumbnail(event.target.files?.[0])} />
        </label>
      </FormSection>

      {submitError ? <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-700" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" /><span>{submitError}</span></div> : null}

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_14px_45px_rgb(15_23_42/12%)] backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-emerald-600" />Publishing immediately generates explainable creator matches.</div>
        <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="secondary" loading={savingAs === 'draft'} disabled={Boolean(savingAs)} onClick={() => submit(false)}><Save className="size-4" />Save draft</Button><Button type="button" loading={savingAs === 'published'} disabled={Boolean(savingAs)} onClick={() => submit(true)}><Rocket className="size-4" />Publish campaign</Button></div>
      </div>
    </form>
  );
}

function FormSection({ icon: Icon, eyebrow, title, description, children }: { icon: typeof ListChecks; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-6 flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 text-violet-700"><Icon className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">{eyebrow}</p><h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div></div><div className="grid gap-5">{children}</div></section>;
}

function Toggle({ label, description, registration }: { label: string; description: string; registration: ReturnType<typeof useForm<CampaignInput>>['register'] extends (name: infer _Name) => infer R ? R : never }) {
  return <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input className="mt-1 size-4 accent-violet-600" type="checkbox" {...registration} /><span><strong className="block text-sm text-slate-900">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span></label>;
}
