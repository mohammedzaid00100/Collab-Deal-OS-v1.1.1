import { z } from 'zod';

const httpsUrl = z
  .string()
  .trim()
  .url('Enter a complete URL, including https://')
  .refine((value) => new URL(value).protocol === 'https:', 'Use a secure https:// URL');

const optionalUrl = z.union([z.literal(''), httpsUrl]).optional();

function optionalPlatformUrl(hosts: readonly string[], label: string) {
  return z.union([
    z.literal(''),
    httpsUrl.refine((value) => {
      const host = new URL(value).hostname.replace(/^www\./, '');
      return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    }, `Use a valid ${label} profile URL`),
  ]).optional();
}

const count = z
  .number({ error: 'Enter a number' })
  .int('Use a whole number')
  .min(0, 'Cannot be negative')
  .max(1_000_000_000, 'Value is too large');

const money = z
  .number({ error: 'Enter an amount' })
  .int('Use a whole amount')
  .min(0, 'Cannot be negative')
  .max(1_000_000_000, 'Amount is too large');

const instagramUrl = z
  .string()
  .trim()
  .url('Enter a complete Instagram URL')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.replace(/^www\./, '');
      return parsed.protocol === 'https:'
        && (host === 'instagram.com' || host.endsWith('.instagram.com'))
        && parsed.pathname.split('/').filter(Boolean).length > 0;
    } catch {
      return false;
    }
  }, 'Use a valid instagram.com profile URL');

export const creatorOnboardingSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    username: z
      .string()
      .trim()
      .min(3, 'Use at least 3 characters')
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Use only letters, numbers, and underscores'),
    bio: z.string().trim().min(20, 'Tell brands a little more about your work').max(500),
    niche: z.string().min(1, 'Choose your niche'),
    location: z.string().trim().min(2, 'Enter your location').max(100),
    primaryAudienceRegion: z.string().trim().min(2, 'Enter your main audience region').max(100),
    primaryContentFormat: z.string().min(1, 'Choose a content format'),
    instagramUrl,
    instagramFollowers: count,
    facebookUrl: optionalPlatformUrl(['facebook.com', 'fb.com'], 'Facebook'),
    facebookFollowers: count,
    youtubeUrl: optionalPlatformUrl(['youtube.com', 'youtu.be'], 'YouTube'),
    youtubeSubscribers: count,
    tiktokUrl: optionalPlatformUrl(['tiktok.com'], 'TikTok'),
    tiktokFollowers: count,
    otherPlatformName: z.string().trim().max(50).optional(),
    otherPlatformUrl: optionalUrl,
    otherPlatformFollowers: count,
    averageViews: count,
    engagementRate: z.number({ error: 'Enter your engagement rate' }).min(0).max(100, 'Engagement cannot exceed 100%'),
    expectedRateLow: money,
    expectedRateHigh: money,
    portfolioUrl: optionalUrl,
    mediaKitUrl: optionalUrl,
  })
  .refine((data) => data.expectedRateLow <= data.expectedRateHigh, {
    message: 'Maximum expected rate must be at least the minimum rate',
    path: ['expectedRateHigh'],
  })
  .refine(
    (data) => !data.otherPlatformFollowers || Boolean(data.otherPlatformName?.trim()),
    { message: 'Name the other platform', path: ['otherPlatformName'] },
  );

export const brandOnboardingSchema = z.object({
  brandName: z.string().trim().min(2, 'Enter your brand name').max(120),
  website: httpsUrl,
  industry: z.string().min(1, 'Choose your industry'),
  description: z.string().trim().min(20, 'Add a short brand description').max(800),
  location: z.string().trim().min(2, 'Enter your location').max(100),
  targetAudience: z.string().trim().min(10, 'Describe your target audience').max(500),
  typicalBudget: money.min(1_000, 'Enter a typical budget of at least ₹1,000'),
  targetCreatorNiche: z.string().min(1, 'Choose a target niche'),
  targetCreatorLocation: z.string().trim().min(2, 'Enter a target location').max(100),
  preferredPlatforms: z.array(z.string()).min(1, 'Choose at least one platform'),
  campaignObjectives: z.array(z.string()).min(1, 'Choose at least one objective'),
});

export type CreatorOnboardingInput = z.infer<typeof creatorOnboardingSchema>;
export type BrandOnboardingInput = z.infer<typeof brandOnboardingSchema>;

export const creatorNiches = [
  'Beauty',
  'Fashion',
  'Fitness',
  'Food',
  'Gaming',
  'Lifestyle',
  'Technology',
  'Travel',
] as const;

export const socialPlatforms = ['Instagram', 'YouTube', 'TikTok', 'Facebook'] as const;
