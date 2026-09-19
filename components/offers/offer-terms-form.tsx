'use client';

import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { CircleAlert, IndianRupee, ListChecks, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, SelectInput, TextArea, TextInput } from '@/components/ui/form-field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { offerSchema, toOfferTerms, type OfferInput } from '@/lib/validation/offer';
import { campaignDeliverableTypes } from '@/lib/validation/campaign';

export interface OfferCampaignOption {
  id: string;
  title: string;
  defaults: OfferInput;
}

interface OfferTermsFormProps {
  role: 'brand' | 'creator';
  mode: 'create' | 'revise' | 'edit-draft';
  creatorId?: string;
  offerId?: string;
  expectedVersion?: number;
  initialValues: OfferInput;
  campaigns?: OfferCampaignOption[];
  initialCampaignId?: string | null;
}

export function OfferTermsForm({ role, mode, creatorId, offerId, expectedVersion, initialValues, campaigns = [], initialCampaignId = null }: OfferTermsFormProps) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? '');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [creationCommandId, setCreationCommandId] = useState<string | null>(null);
  const form = useForm<OfferInput>({ resolver: zodResolver(offerSchema), defaultValues: initialValues, mode: 'onTouched' });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'deliverables' });
  const dealType = useWatch({ control: form.control, name: 'dealType' });
  const exclusivity = useWatch({ control: form.control, name: 'exclusivity' });
  const number = { valueAsNumber: true } as const;

  function chooseCampaign(nextId: string) {
    setCampaignId(nextId);
    const selected = campaigns.find((campaign) => campaign.id === nextId);
    if (selected) form.reset(selected.defaults);
  }

  const submit = (sendNow = true) => form.handleSubmit(async (values) => {
    setPendingAction(mode === 'revise' ? 'revise' : mode === 'edit-draft' ? 'edit' : sendNow ? 'send' : 'draft');
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return finishWithError('Supabase is not connected.');
    if (mode === 'create') {
      if (!creatorId) return finishWithError('Choose a creator before creating an offer.');
      const commandId = creationCommandId ?? crypto.randomUUID();
      if (!creationCommandId) setCreationCommandId(commandId);
      const { data, error } = await supabase.rpc('create_structured_offer', {
        target_creator_profile_id: creatorId,
        target_campaign_id: campaignId || null,
        terms_data: toOfferTerms(values),
        send_now: sendNow,
        client_command_id: commandId,
      });
      if (error) return finishWithError(error.message);
      const createdId = data as string | null;
      if (!createdId) return finishWithError('The offer was not created. Please try again.');
      router.push(`/brand/offers/${createdId}`);
    } else {
      if (!offerId || expectedVersion == null) return finishWithError('Offer version context is missing.');
      const { error } = mode === 'edit-draft'
        ? await supabase.rpc('update_draft_structured_offer', { target_offer_id: offerId, expected_version: expectedVersion, terms_data: toOfferTerms(values) })
        : await supabase.rpc('revise_structured_offer', { target_offer_id: offerId, expected_version: expectedVersion, terms_data: toOfferTerms(values) });
      if (error) return finishWithError(error.message);
      router.push(`/${role}/offers/${offerId}`);
    }
    router.refresh();
  }, () => setSubmitError('Review the highlighted terms before continuing.'))();

  function finishWithError(message: string) {
    setSubmitError(message);
    setPendingAction(null);
  }

  const { errors } = form.formState;
  return <form className="grid gap-6" noValidate onSubmit={(event) => event.preventDefault()}>
    {mode === 'create' ? (
      <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">Offer context</p>
        <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Link a campaign</h2>
        <p className="mt-1 text-sm leading-6 text-[#5A5870] dark:text-[#9CA1BA]">Optional. Choosing a campaign pre-fills its current scope and rights.</p>
        <label className="mt-5 block">
          <span className="sr-only">Campaign</span>
          <SelectInput value={campaignId} onChange={(event) => chooseCampaign(event.target.value)}>
            <option value="">Standalone offer</option>
            {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.title}</option>)}
          </SelectInput>
        </label>
      </section>
    ) : null}

    <OfferSection icon={IndianRupee} eyebrow="Value" title="Cash and product terms" description="Keep commercial value explicit and separate.">
      <div className="grid gap-5 sm:grid-cols-3">
        <FieldShell label="Deal type" name="dealType" error={errors.dealType?.message}>
          <SelectInput id="dealType" {...form.register('dealType')}>
            <option value="PAID">Paid</option>
            <option value="PRODUCT_ONLY">Product only</option>
            <option value="HYBRID">Hybrid</option>
          </SelectInput>
        </FieldShell>
        <FieldShell label="Cash payment (₹)" name="cashPayment" error={errors.cashPayment?.message}>
          <TextInput id="cashPayment" type="number" min="0" disabled={dealType === 'PRODUCT_ONLY'} {...form.register('cashPayment', number)} />
        </FieldShell>
        <FieldShell label="Product value (₹)" name="productValue" error={errors.productValue?.message}>
          <TextInput id="productValue" type="number" min="0" disabled={dealType === 'PAID'} {...form.register('productValue', number)} />
        </FieldShell>
      </div>
      {dealType !== 'PAID' ? (
        <FieldShell label="Product name" name="productName" error={errors.productName?.message}>
          <TextInput id="productName" placeholder="Product or perk the creator keeps" {...form.register('productName')} />
        </FieldShell>
      ) : null}
    </OfferSection>

    <OfferSection icon={ListChecks} eyebrow="Scope" title="Deliverables" description="Every requested content item remains versioned.">
      <div className="grid gap-3">
        {fields.map((field, index) => (
          <div className="grid gap-3 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-3 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none sm:grid-cols-[minmax(170px,1fr)_100px_minmax(160px,1fr)_44px]" key={field.id}>
            <FieldShell label="Type" name={`deliverables.${index}.type`} error={errors.deliverables?.[index]?.type?.message}>
              <SelectInput id={`deliverables.${index}.type`} {...form.register(`deliverables.${index}.type`)}>
                {campaignDeliverableTypes.map((type) => <option key={type}>{type}</option>)}
              </SelectInput>
            </FieldShell>
            <FieldShell label="Quantity" name={`deliverables.${index}.quantity`} error={errors.deliverables?.[index]?.quantity?.message}>
              <TextInput id={`deliverables.${index}.quantity`} type="number" min="1" {...form.register(`deliverables.${index}.quantity`, number)} />
            </FieldShell>
            <FieldShell label="Notes" name={`deliverables.${index}.notes`} optional error={errors.deliverables?.[index]?.notes?.message}>
              <TextInput id={`deliverables.${index}.notes`} placeholder="Length, CTA, format…" {...form.register(`deliverables.${index}.notes`)} />
            </FieldShell>
            <button
              className="mt-7 flex size-11 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white text-[#5A5870] shadow-[2px_2px_0_#0D0C1D] transition hover:border-red-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#9CA1BA] dark:shadow-none dark:hover:border-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              type="button"
              disabled={fields.length === 1}
              onClick={() => remove(index)}
              aria-label={`Remove deliverable ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <Button className="w-fit" type="button" variant="secondary" onClick={() => append({ type: 'Instagram Reel', quantity: 1, notes: '' })}>
        <Plus className="size-4" />Add deliverable
      </Button>
    </OfferSection>

    <OfferSection icon={ShieldCheck} eyebrow="Rights & timing" title="Usage, exclusivity, and deadline" description="These terms materially affect fair value and should never be buried.">
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Usage rights" name="usageRights" optional error={errors.usageRights?.message}>
          <TextArea id="usageRights" placeholder="Where and how content may be used" {...form.register('usageRights')} />
        </FieldShell>
        <div className="grid content-start gap-5">
          <FieldShell label="Usage duration (days)" name="usageDurationDays" optional error={errors.usageDurationDays?.message}>
            <TextInput id="usageDurationDays" type="number" min="0" {...form.register('usageDurationDays', number)} />
          </FieldShell>
          <FieldShell label="Territory" name="territory" optional error={errors.territory?.message}>
            <TextInput id="territory" placeholder="India, global, or defined markets" {...form.register('territory')} />
          </FieldShell>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Paid advertising rights" description="Content may be used in paid media." registration={form.register('paidAdRights')} />
        <Toggle label="Category exclusivity" description="Creator avoids named competitors for the term." registration={form.register('exclusivity')} />
      </div>
      {exclusivity ? (
        <FieldShell label="Exclusivity duration (days)" name="exclusivityDurationDays" error={errors.exclusivityDurationDays?.message}>
          <TextInput id="exclusivityDurationDays" type="number" min="1" {...form.register('exclusivityDurationDays', number)} />
        </FieldShell>
      ) : null}
      <FieldShell label="Offer deadline" name="deadline" error={errors.deadline?.message}>
        <TextInput id="deadline" type="datetime-local" {...form.register('deadline')} />
      </FieldShell>
      <FieldShell label="Structured context" name="notes" optional hint="Use this only for requirements or context tied to the terms. Collab Deal OS does not provide chat." error={errors.notes?.message}>
        <TextArea id="notes" placeholder="Approval steps, disclosure requirements, or other deal-specific context" {...form.register('notes')} />
      </FieldShell>
    </OfferSection>

    {submitError ? (
      <div className="flex gap-2.5 rounded-[8px] border-2 border-red-500 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-[2px_2px_0_#DC2626] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />{submitError}
      </div>
    ) : null}
    <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-[10px] border-2 border-[#0D0C1D] bg-white/95 p-4 shadow-[4px_4px_0_#0D0C1D] backdrop-blur dark:border-[#262A3D] dark:bg-[#161826]/95 dark:shadow-[4px_4px_0_#000000] sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
      <p className="text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
        {mode === 'create' ? 'Sending notifies the creator and locks this version into the audit trail.' : mode === 'edit-draft' ? 'Draft edits remain private and do not create shared revisions.' : 'Submitting creates a new immutable offer revision and returns the decision to the other party.'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {mode === 'create' ? (
          <Button type="button" variant="secondary" loading={pendingAction === 'draft'} disabled={Boolean(pendingAction)} onClick={() => submit(false)}>
            Save draft
          </Button>
        ) : null}
        <Button type="button" loading={pendingAction === 'send' || pendingAction === 'revise' || pendingAction === 'edit'} disabled={Boolean(pendingAction)} onClick={() => submit(true)}>
          <Send className="size-4" />{mode === 'create' ? 'Send offer' : mode === 'edit-draft' ? 'Save draft changes' : 'Submit revised offer'}
        </Button>
      </div>
    </div>
  </form>;
}

function OfferSection({ icon: Icon, eyebrow, title, description, children }: { icon: typeof IndianRupee; eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
      <div className="mb-6 flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#5A5870] dark:text-[#9CA1BA]">{description}</p>
        </div>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function Toggle({ label, description, registration }: { label: string; description: string; registration: ReturnType<typeof useForm<OfferInput>>['register'] extends (name: infer _Name) => infer R ? R : never }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-4 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none">
      <input className="mt-1 size-4 accent-[#4F46E5]" type="checkbox" {...registration} />
      <span>
        <strong className="block text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{label}</strong>
        <span className="mt-1 block text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">{description}</span>
      </span>
    </label>
  );
}
