'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldPath, type UseFormRegisterReturn } from 'react-hook-form';
import { BadgeCheck, ChevronLeft, ChevronRight, CircleAlert, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, SelectInput, TextArea, TextInput } from '@/components/ui/form-field';
import { OnboardingShell } from './onboarding-shell';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  brandOnboardingSchema,
  creatorNiches,
  industryOptions,
  normalizeWebsiteUrl,
  socialPlatforms,
  type BrandOnboardingInput,
} from '@/lib/validation/onboarding';

const steps = ['Brand profile', 'Creator preferences', 'Review & submit'] as const;
const stepCopy = [
  ['Set up your brand', 'Give creators the context they need to understand your company and audience.'],
  ['Define your typical creator fit', 'These preferences improve matching and can be changed for each campaign.'],
  ['Review your brand profile', 'Confirm your baseline preferences before opening your brand workspace.'],
] as const;

const stepFields: ReadonlyArray<ReadonlyArray<FieldPath<BrandOnboardingInput>>> = [
  ['brandName', 'website', 'industry', 'customIndustry', 'description', 'location', 'targetAudience'],
  ['typicalBudget', 'targetCreatorNiche', 'targetCreatorLocation', 'preferredPlatforms', 'campaignObjectives'],
  [],
];

const defaults: BrandOnboardingInput = {
  brandName: '',
  website: '',
  industry: '',
  customIndustry: '',
  description: '',
  location: '',
  targetAudience: '',
  typicalBudget: 0,
  targetCreatorNiche: '',
  targetCreatorLocation: '',
  preferredPlatforms: [],
  campaignObjectives: [],
};

export function BrandOnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [logo, setLogo] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BrandOnboardingInput>({
    resolver: zodResolver(brandOnboardingSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const values = getValues();
  const selectedIndustry = watch('industry');

  async function goNext() {
    const valid = await trigger(stepFields[step], { shouldFocus: true });
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function onLogoChange(file: File | undefined) {
    setSubmitError(null);
    if (!file) return setLogo(null);
    if (!file.type.startsWith('image/')) return setSubmitError('Choose an image file for your brand logo.');
    if (file.size > 5 * 1024 * 1024) return setSubmitError('Brand logo must be smaller than 5 MB.');
    setLogo(file);
  }

  async function onSubmit(data: BrandOnboardingInput) {
    if (step < steps.length - 1) return goNext();
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSubmitError('Profile storage is not configured yet. Connect Supabase before submitting.');
      return;
    }

    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setSubmitError('Your session has expired. Sign in again to continue.');
      return;
    }

    let logoPath: string | null = null;
    if (logo) {
      const extension = logo.name.split('.').pop()?.toLowerCase() || 'png';
      logoPath = `${userResult.user.id}/logo.${extension}`;
      const { error } = await supabase.storage.from('brand-logos').upload(logoPath, logo, {
        upsert: true,
        contentType: logo.type,
      });
      if (error) {
        setSubmitError(`Brand logo upload failed: ${error.message}`);
        return;
      }
    }

    const resolvedIndustry = data.industry === 'Other'
      ? data.customIndustry?.trim() ?? ''
      : data.industry;

    const { error } = await supabase.rpc('complete_brand_onboarding', {
      profile_data: {
        brand_name: data.brandName,
        logo_path: logoPath,
        website: normalizeWebsiteUrl(data.website),
        industry: resolvedIndustry,
        description: data.description,
        location: data.location,
        target_audience: data.targetAudience,
        typical_campaign_budget: data.typicalBudget,
        currency: 'INR',
        target_creator_niche: data.targetCreatorNiche,
        target_creator_location: data.targetCreatorLocation,
        preferred_platforms: data.preferredPlatforms,
        campaign_objectives: data.campaignObjectives,
      },
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    router.push('/brand/dashboard');
    router.refresh();
  }

  return (
    <OnboardingShell accountLabel="Brand" step={step} steps={steps} title={stepCopy[step][0]} description={stepCopy[step][1]}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {step === 0 ? (
          <BrandProfileStep
            register={register}
            errors={errors}
            logo={logo}
            onLogoChange={onLogoChange}
            selectedIndustry={selectedIndustry}
          />
        ) : null}
        {step === 1 ? <PreferencesStep register={register} errors={errors} /> : null}
        {step === 2 ? <BrandReview values={values} logo={logo} /> : null}

        {submitError ? <div className="mt-6 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{submitError}</span></div> : null}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
          <Button className={step === 0 ? 'invisible' : ''} variant="secondary" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}><ChevronLeft className="size-4" aria-hidden="true" />Back</Button>
          {step < steps.length - 1 ? <Button type="button" onClick={goNext}>Continue<ChevronRight className="size-4" aria-hidden="true" /></Button> : <Button type="submit" loading={isSubmitting}><BadgeCheck className="size-4" aria-hidden="true" />Complete brand profile</Button>}
        </div>
      </form>
    </OnboardingShell>
  );
}

type BrandRegister = ReturnType<typeof useForm<BrandOnboardingInput>>['register'];
type BrandErrors = ReturnType<typeof useForm<BrandOnboardingInput>>['formState']['errors'];

function BrandProfileStep({
  register,
  errors,
  logo,
  onLogoChange,
  selectedIndustry,
}: {
  register: BrandRegister;
  errors: BrandErrors;
  logo: File | null;
  onLogoChange: (file?: File) => void;
  selectedIndustry: string;
}) {
  return <div className="grid gap-5">
    <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"><span className="flex size-12 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm"><Upload className="size-5" aria-hidden="true" /></span><span className="min-w-0"><strong className="block text-sm text-slate-900">Brand logo</strong><span className="mt-1 block truncate text-xs text-slate-500">{logo?.name ?? 'PNG, JPG, or WebP up to 5 MB'}</span></span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onLogoChange(event.target.files?.[0])} /></label>
    <div className="grid gap-5 sm:grid-cols-2">
      <FieldShell label="Brand name" name="brandName" error={errors.brandName?.message}><TextInput id="brandName" {...register('brandName')} /></FieldShell>
      <FieldShell label="Website" name="website" hint="You can enter yourbrand.com; https:// is added automatically." error={errors.website?.message}><TextInput id="website" type="text" inputMode="url" placeholder="yourbrand.com" {...register('website')} /></FieldShell>
      <SearchableSelectField
        label="Industry"
        name="industry"
        placeholder="Select an industry"
        searchPlaceholder="Search industries..."
        options={industryOptions}
        registration={register('industry')}
        error={errors.industry?.message}
      />
      <FieldShell label="Location" name="location" error={errors.location?.message}><TextInput id="location" placeholder="Bengaluru, India" {...register('location')} /></FieldShell>
    </div>
    {selectedIndustry === 'Other' ? (
      <FieldShell
        label="What is your industry / niche?"
        name="customIndustry"
        hint="This will be shown as your brand's industry instead of “Other”."
        error={errors.customIndustry?.message}
      >
        <TextInput id="customIndustry" placeholder="e.g. Drone cinematography" {...register('customIndustry')} />
      </FieldShell>
    ) : null}
    <FieldShell label="Brand description" name="description" error={errors.description?.message}><TextArea id="description" placeholder="What your brand makes, believes, and wants creators to understand." {...register('description')} /></FieldShell>
    <FieldShell label="Target audience" name="targetAudience" error={errors.targetAudience?.message}><TextArea id="targetAudience" placeholder="Describe the people your campaigns need to reach." {...register('targetAudience')} /></FieldShell>
  </div>;
}

function PreferencesStep({ register, errors }: { register: BrandRegister; errors: BrandErrors }) {
  return <div className="grid gap-6">
    <div className="grid gap-5 sm:grid-cols-2">
      <FieldShell label="Typical campaign budget (₹)" name="typicalBudget" error={errors.typicalBudget?.message}><TextInput id="typicalBudget" type="number" min="0" {...register('typicalBudget', { valueAsNumber: true })} /></FieldShell>
      <SearchableSelectField
        label="Target creator industry / niche"
        name="targetCreatorNiche"
        placeholder="Select an industry / niche"
        searchPlaceholder="Search creator niches..."
        options={creatorNiches}
        registration={register('targetCreatorNiche')}
        error={errors.targetCreatorNiche?.message}
      />
      <FieldShell label="Target creator location" name="targetCreatorLocation" error={errors.targetCreatorLocation?.message}><TextInput id="targetCreatorLocation" placeholder="India" {...register('targetCreatorLocation')} /></FieldShell>
    </div>
    <ChoiceGroup title="Preferred platforms" error={errors.preferredPlatforms?.message}>{socialPlatforms.map((platform) => <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50" key={platform}><input type="checkbox" value={platform.toUpperCase()} className="size-4 accent-blue-600" {...register('preferredPlatforms')} />{platform}</label>)}</ChoiceGroup>
    <ChoiceGroup title="Primary campaign objectives" error={errors.campaignObjectives?.message}>{['Awareness', 'Engagement', 'Conversions', 'Content creation', 'Product launch'].map((objective) => <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 has-[:checked]:border-violet-300 has-[:checked]:bg-violet-50" key={objective}><input type="checkbox" value={objective.toUpperCase().replaceAll(' ', '_')} className="size-4 accent-violet-600" {...register('campaignObjectives')} />{objective}</label>)}</ChoiceGroup>
  </div>;
}

function SearchableSelectField({
  label,
  name,
  placeholder,
  searchPlaceholder,
  options,
  registration,
  error,
}: {
  label: string;
  name: string;
  placeholder: string;
  searchPlaceholder: string;
  options: readonly string[];
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options
    .filter((option) => option !== 'Other')
    .filter((option) => !normalizedQuery || option.toLowerCase().includes(normalizedQuery));
  const selectableOptions = [...filteredOptions, 'Other'];

  return <div className="grid gap-2">
    <label className="text-sm font-semibold text-slate-800" htmlFor={name}>{label}</label>
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <TextInput
          className="min-h-10 bg-white pl-9"
          id={`${name}-search`}
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </div>
      <SelectInput id={name} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} {...registration}>
        <option value="">{placeholder}</option>
        {selectableOptions.map((value) => <option value={value} key={value}>{value}</option>)}
      </SelectInput>
      {normalizedQuery && filteredOptions.length === 0 ? <p className="px-1 text-xs leading-5 text-slate-500">No listed industry matches “{query}”. Choose <strong>Other</strong> and type your exact industry.</p> : null}
    </div>
    {error ? <p className="text-xs font-medium text-red-600" id={`${name}-error`} role="alert">{error}</p> : null}
  </div>;
}

function ChoiceGroup({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return <fieldset><legend className="text-sm font-semibold text-slate-800">{title}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>{error ? <p className="mt-2 text-xs font-medium text-red-600" role="alert">{error}</p> : null}</fieldset>;
}

function BrandReview({ values, logo }: { values: BrandOnboardingInput; logo: File | null }) {
  const displayedIndustry = values.industry === 'Other' ? values.customIndustry?.trim() || 'Other' : values.industry;
  const items = [
    ['Brand', values.brandName || '—'],
    ['Industry', displayedIndustry || '—'],
    ['Website', values.website ? normalizeWebsiteUrl(values.website) : '—'],
    ['Location', values.location || '—'],
    ['Typical budget', `₹${values.typicalBudget.toLocaleString('en-IN')}`],
    ['Creator fit', `${values.targetCreatorNiche || '—'} · ${values.targetCreatorLocation || '—'}`],
    ['Platforms', values.preferredPlatforms.join(', ') || '—'],
    ['Objectives', values.campaignObjectives.join(', ') || '—'],
    ['Brand logo', logo?.name ?? 'Not added'],
  ];
  return <dl className="grid overflow-hidden rounded-2xl border border-slate-200">{items.map(([label, value]) => <div className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[150px_1fr]" key={label}><dt className="text-xs font-bold uppercase tracking-[0.06em] text-slate-400">{label}</dt><dd className="m-0 text-sm font-medium text-slate-800">{value}</dd></div>)}</dl>;
}
