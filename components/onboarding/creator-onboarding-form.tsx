'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldPath } from 'react-hook-form';
import { BadgeCheck, ChevronLeft, ChevronRight, CircleAlert, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, SelectInput, TextArea, TextInput } from '@/components/ui/form-field';
import { OnboardingShell } from './onboarding-shell';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  creatorNiches,
  creatorOnboardingSchema,
  type CreatorOnboardingInput,
} from '@/lib/validation/onboarding';

const steps = ['Profile setup', 'Audience & content', 'Portfolio & links', 'Review & submit'] as const;
const stepCopy = [
  ['Tell us who you are', 'This is the profile brands will use to understand your work and creator fit.'],
  ['Add your real audience metrics', 'Enter current numbers for the platforms you actually use. Unused platforms can stay at zero.'],
  ['Share your work', 'Add at least one social profile so brands can review your work. You do not need accounts on every platform.'],
  ['Review your creator profile', 'Confirm the information below before finishing setup. You can update it later in Settings.'],
] as const;

const stepFields: ReadonlyArray<ReadonlyArray<FieldPath<CreatorOnboardingInput>>> = [
  ['fullName', 'username', 'bio', 'niche', 'location', 'primaryAudienceRegion', 'primaryContentFormat'],
  ['instagramFollowers', 'facebookFollowers', 'youtubeSubscribers', 'tiktokFollowers', 'otherPlatformName', 'otherPlatformFollowers', 'averageViews', 'engagementRate', 'expectedRateLow', 'expectedRateHigh'],
  ['instagramUrl', 'facebookUrl', 'youtubeUrl', 'tiktokUrl', 'otherPlatformUrl', 'portfolioUrl', 'mediaKitUrl'],
  [],
];

const defaults: CreatorOnboardingInput = {
  fullName: '',
  username: '',
  bio: '',
  niche: '',
  location: '',
  primaryAudienceRegion: '',
  primaryContentFormat: '',
  instagramUrl: '',
  instagramFollowers: 0,
  facebookUrl: '',
  facebookFollowers: 0,
  youtubeUrl: '',
  youtubeSubscribers: 0,
  tiktokUrl: '',
  tiktokFollowers: 0,
  otherPlatformName: '',
  otherPlatformUrl: '',
  otherPlatformFollowers: 0,
  averageViews: 0,
  engagementRate: 0,
  expectedRateLow: 0,
  expectedRateHigh: 0,
  portfolioUrl: '',
  mediaKitUrl: '',
};

export function CreatorOnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreatorOnboardingInput>({
    resolver: zodResolver(creatorOnboardingSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const values = getValues();

  async function goNext() {
    setSubmitError(null);
    const valid = await trigger(stepFields[step], { shouldFocus: true });
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setSubmitError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  function onAvatarChange(file: File | undefined) {
    setSubmitError(null);
    if (!file) return setAvatar(null);
    if (!file.type.startsWith('image/')) return setSubmitError('Choose an image file for your profile photo.');
    if (file.size > 5 * 1024 * 1024) return setSubmitError('Profile photo must be smaller than 5 MB.');
    setAvatar(file);
  }

  async function onSubmit(data: CreatorOnboardingInput) {
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

    let avatarPath: string | null = null;
    if (avatar) {
      const extension = avatar.name.split('.').pop()?.toLowerCase() || 'jpg';
      avatarPath = `${userResult.user.id}/avatar.${extension}`;
      const { error } = await supabase.storage.from('avatars').upload(avatarPath, avatar, {
        upsert: true,
        contentType: avatar.type,
      });
      if (error) {
        setSubmitError(`Profile photo upload failed: ${error.message}`);
        return;
      }
    }

    const socialData = [
      socialRow('INSTAGRAM', data.instagramUrl, data.instagramFollowers, 'followers'),
      socialRow('FACEBOOK', data.facebookUrl, data.facebookFollowers, 'followers'),
      socialRow('YOUTUBE', data.youtubeUrl, data.youtubeSubscribers, 'subscribers'),
      socialRow('TIKTOK', data.tiktokUrl, data.tiktokFollowers, 'followers'),
      ...(data.otherPlatformName
        ? [socialRow(data.otherPlatformName.toUpperCase(), data.otherPlatformUrl, data.otherPlatformFollowers, 'followers')]
        : []),
    ].filter((row) => Boolean(row.profile_url));

    const { error } = await supabase.rpc('complete_creator_onboarding', {
      profile_data: {
        full_name: data.fullName,
        username: data.username.toLowerCase(),
        bio: data.bio,
        niche: data.niche,
        location: data.location,
        primary_audience_region: data.primaryAudienceRegion,
        primary_content_format: data.primaryContentFormat,
        average_views: data.averageViews,
        engagement_rate: data.engagementRate,
        expected_rate_low: data.expectedRateLow,
        expected_rate_high: data.expectedRateHigh,
        currency: 'INR',
        portfolio_url: data.portfolioUrl || null,
        media_kit_url: data.mediaKitUrl || null,
        avatar_path: avatarPath,
      },
      social_data: socialData,
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    router.push('/creator/dashboard');
    router.refresh();
  }

  return (
    <OnboardingShell
      accountLabel="Creator"
      step={step}
      steps={steps}
      title={stepCopy[step][0]}
      description={stepCopy[step][1]}
    >
      <form onSubmit={handleSubmit(onSubmit)} onChange={() => submitError && setSubmitError(null)} noValidate>
        {step === 0 ? <ProfileStep register={register} errors={errors} avatar={avatar} onAvatarChange={onAvatarChange} /> : null}
        {step === 1 ? <MetricsStep register={register} errors={errors} /> : null}
        {step === 2 ? <LinksStep register={register} errors={errors} /> : null}
        {step === 3 ? <ReviewStep values={values} avatar={avatar} /> : null}

        {submitError ? (
          <div className="mt-6 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
          <Button className={step === 0 ? 'invisible' : ''} variant="secondary" type="button" onClick={goBack}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Continue
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" loading={isSubmitting}>
              <BadgeCheck className="size-4" aria-hidden="true" />
              Complete creator profile
            </Button>
          )}
        </div>
      </form>
    </OnboardingShell>
  );
}

type RegisterProps = ReturnType<typeof useForm<CreatorOnboardingInput>>['register'];
type ErrorsProps = ReturnType<typeof useForm<CreatorOnboardingInput>>['formState']['errors'];

function ProfileStep({ register, errors, avatar, onAvatarChange }: { register: RegisterProps; errors: ErrorsProps; avatar: File | null; onAvatarChange: (file?: File) => void }) {
  return (
    <div className="grid gap-5">
      <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-violet-300 hover:bg-violet-50/40">
        <span className="flex size-12 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Upload className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0"><strong className="block text-sm text-slate-900">Profile photo</strong><span className="mt-1 block truncate text-xs text-slate-500">{avatar?.name ?? 'PNG, JPG, or WebP up to 5 MB'}</span></span>
        <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onAvatarChange(event.target.files?.[0])} />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Full name" name="fullName" error={errors.fullName?.message}><TextInput id="fullName" autoComplete="name" {...register('fullName')} /></FieldShell>
        <FieldShell label="Username" name="username" hint="Letters, numbers, periods, and underscores." error={errors.username?.message}><TextInput id="username" autoComplete="username" placeholder="zaid.frame" {...register('username')} /></FieldShell>
      </div>
      <FieldShell label="Bio" name="bio" error={errors.bio?.message}><TextArea id="bio" placeholder="Describe your content, audience, and the partnerships you create best." {...register('bio')} /></FieldShell>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Niche" name="niche" error={errors.niche?.message}><SelectInput id="niche" {...register('niche')}><option value="">Select a niche</option>{creatorNiches.map((value) => <option value={value} key={value}>{value}</option>)}</SelectInput></FieldShell>
        <FieldShell label="Location" name="location" error={errors.location?.message}><TextInput id="location" placeholder="Mumbai, India" {...register('location')} /></FieldShell>
        <FieldShell label="Primary audience region" name="primaryAudienceRegion" error={errors.primaryAudienceRegion?.message}><TextInput id="primaryAudienceRegion" placeholder="India" {...register('primaryAudienceRegion')} /></FieldShell>
        <FieldShell label="Primary content format" name="primaryContentFormat" error={errors.primaryContentFormat?.message}><SelectInput id="primaryContentFormat" {...register('primaryContentFormat')}><option value="">Select a format</option><option>Short-form video</option><option>Long-form video</option><option>Photography</option><option>UGC</option><option>Live content</option><option>Mixed media</option></SelectInput></FieldShell>
      </div>
    </div>
  );
}

function MetricsStep({ register, errors }: { register: RegisterProps; errors: ErrorsProps }) {
  const numberRegister = (name: FieldPath<CreatorOnboardingInput>) => register(name, { valueAsNumber: true });
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm leading-6 text-violet-900"><strong>Creator-declared metrics</strong><p className="mt-1 text-violet-800/80">Enter numbers only for the platforms you use. Unused platform fields can stay at zero and will not block setup.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Instagram followers" name="instagramFollowers" error={errors.instagramFollowers?.message}><TextInput id="instagramFollowers" type="number" min="0" {...numberRegister('instagramFollowers')} /></FieldShell>
        <FieldShell label="Facebook followers" name="facebookFollowers" error={errors.facebookFollowers?.message}><TextInput id="facebookFollowers" type="number" min="0" {...numberRegister('facebookFollowers')} /></FieldShell>
        <FieldShell label="YouTube subscribers" name="youtubeSubscribers" error={errors.youtubeSubscribers?.message}><TextInput id="youtubeSubscribers" type="number" min="0" {...numberRegister('youtubeSubscribers')} /></FieldShell>
        <FieldShell label="TikTok followers" name="tiktokFollowers" error={errors.tiktokFollowers?.message}><TextInput id="tiktokFollowers" type="number" min="0" {...numberRegister('tiktokFollowers')} /></FieldShell>
        <FieldShell label="Average views" name="averageViews" hint="Use a recent, representative average." error={errors.averageViews?.message}><TextInput id="averageViews" type="number" min="0" {...numberRegister('averageViews')} /></FieldShell>
        <FieldShell label="Engagement rate (%)" name="engagementRate" error={errors.engagementRate?.message}><TextInput id="engagementRate" type="number" min="0" max="100" step="0.01" {...numberRegister('engagementRate')} /></FieldShell>
        <FieldShell label="Expected rate from (₹)" name="expectedRateLow" error={errors.expectedRateLow?.message}><TextInput id="expectedRateLow" type="number" min="0" {...numberRegister('expectedRateLow')} /></FieldShell>
        <FieldShell label="Expected rate up to (₹)" name="expectedRateHigh" error={errors.expectedRateHigh?.message}><TextInput id="expectedRateHigh" type="number" min="0" {...numberRegister('expectedRateHigh')} /></FieldShell>
        <FieldShell label="Other platform" name="otherPlatformName" optional error={errors.otherPlatformName?.message}><TextInput id="otherPlatformName" placeholder="Twitch" {...register('otherPlatformName')} /></FieldShell>
        <FieldShell label="Other platform followers" name="otherPlatformFollowers" optional error={errors.otherPlatformFollowers?.message}><TextInput id="otherPlatformFollowers" type="number" min="0" {...numberRegister('otherPlatformFollowers')} /></FieldShell>
      </div>
    </div>
  );
}

function LinksStep({ register, errors }: { register: RegisterProps; errors: ErrorsProps }) {
  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm leading-6 text-violet-900">Add at least one social profile below. Instagram, Facebook, YouTube, TikTok, or another platform can be your only connected profile.</div>
      <FieldShell label="Instagram profile URL" name="instagramUrl" hint="Add this only if you use Instagram." error={errors.instagramUrl?.message}><TextInput id="instagramUrl" type="url" placeholder="https://instagram.com/your_handle" {...register('instagramUrl')} /></FieldShell>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell label="Facebook URL" name="facebookUrl" error={errors.facebookUrl?.message}><TextInput id="facebookUrl" type="url" {...register('facebookUrl')} /></FieldShell>
        <FieldShell label="YouTube URL" name="youtubeUrl" error={errors.youtubeUrl?.message}><TextInput id="youtubeUrl" type="url" {...register('youtubeUrl')} /></FieldShell>
        <FieldShell label="TikTok URL" name="tiktokUrl" error={errors.tiktokUrl?.message}><TextInput id="tiktokUrl" type="url" {...register('tiktokUrl')} /></FieldShell>
        <FieldShell label="Other platform URL" name="otherPlatformUrl" error={errors.otherPlatformUrl?.message}><TextInput id="otherPlatformUrl" type="url" {...register('otherPlatformUrl')} /></FieldShell>
        <FieldShell label="Portfolio URL" name="portfolioUrl" optional error={errors.portfolioUrl?.message}><TextInput id="portfolioUrl" type="url" {...register('portfolioUrl')} /></FieldShell>
        <FieldShell label="Media kit URL" name="mediaKitUrl" optional error={errors.mediaKitUrl?.message}><TextInput id="mediaKitUrl" type="url" {...register('mediaKitUrl')} /></FieldShell>
      </div>
    </div>
  );
}

function ReviewStep({ values, avatar }: { values: CreatorOnboardingInput; avatar: File | null }) {
  const socialSummary = getSocialSummary(values);
  const items = [
    ['Profile', `${values.fullName || '—'} · @${values.username || '—'}`],
    ['Creator fit', `${values.niche || '—'} · ${values.location || '—'}`],
    ['Audience', `${values.primaryAudienceRegion || '—'} · ${values.primaryContentFormat || '—'}`],
    ['Social audience', socialSummary],
    ['Performance', `${values.averageViews.toLocaleString('en-IN')} avg. views · ${values.engagementRate}% engagement`],
    ['Expected rate', `₹${values.expectedRateLow.toLocaleString('en-IN')} – ₹${values.expectedRateHigh.toLocaleString('en-IN')}`],
    ['Profile photo', avatar?.name ?? 'Not added'],
  ];
  return <dl className="grid overflow-hidden rounded-2xl border border-slate-200">{items.map(([label, value]) => <div className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[150px_1fr]" key={label}><dt className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">{label}</dt><dd className="m-0 text-sm font-medium text-slate-800">{value}</dd></div>)}</dl>;
}

function getSocialSummary(values: CreatorOnboardingInput) {
  const connected = [
    values.instagramUrl ? `Instagram · ${values.instagramFollowers.toLocaleString('en-IN')} followers` : null,
    values.facebookUrl ? `Facebook · ${values.facebookFollowers.toLocaleString('en-IN')} followers` : null,
    values.youtubeUrl ? `YouTube · ${values.youtubeSubscribers.toLocaleString('en-IN')} subscribers` : null,
    values.tiktokUrl ? `TikTok · ${values.tiktokFollowers.toLocaleString('en-IN')} followers` : null,
    values.otherPlatformUrl && values.otherPlatformName
      ? `${values.otherPlatformName} · ${values.otherPlatformFollowers.toLocaleString('en-IN')} followers`
      : null,
  ].filter(Boolean);

  return connected.join(' · ') || 'No social profile added';
}

function socialRow(platform: string, profileUrl: string | undefined, audienceCount: number, metricLabel: string) {
  return {
    platform,
    profile_url: profileUrl || null,
    audience_count: audienceCount,
    metric_label: metricLabel,
    metric_status: audienceCount > 0 || Boolean(profileUrl) ? 'CREATOR_DECLARED' : 'UNAVAILABLE',
  };
}
