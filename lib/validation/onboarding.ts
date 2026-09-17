import { z } from 'zod';

function parseUrl(value: string, addHttpsWhenMissing = false) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (addHttpsWhenMissing && !/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  } else if (addHttpsWhenMissing && /^http:\/\//i.test(candidate)) {
    candidate = `https://${candidate.slice(7)}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeWebsiteUrl(value: string) {
  const parsed = parseUrl(value, true);
  if (!parsed) return '';
  parsed.protocol = 'https:';
  return parsed.toString();
}

const httpsUrl = z
  .string()
  .trim()
  .refine((value) => {
    const parsed = parseUrl(value);
    return Boolean(parsed && parsed.protocol === 'https:' && parsed.hostname);
  }, 'Enter a complete secure URL, including https://');

const websiteUrl = z
  .string()
  .trim()
  .min(1, 'Enter your website')
  .refine((value) => {
    const parsed = parseUrl(value, true);
    return Boolean(parsed && parsed.protocol === 'https:' && parsed.hostname.includes('.'));
  }, 'Enter a valid website, such as yourbrand.com');

const optionalUrl = z.union([z.literal(''), httpsUrl]).optional();

function optionalPlatformUrl(hosts: readonly string[], label: string) {
  return z.union([
    z.literal(''),
    z.string().trim().refine((value) => {
      const parsed = parseUrl(value);
      if (!parsed || parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.replace(/^www\./, '');
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
  .refine((value) => {
    const parsed = parseUrl(value);
    if (!parsed) return false;
    const host = parsed.hostname.replace(/^www\./, '');
    return parsed.protocol === 'https:'
      && (host === 'instagram.com' || host.endsWith('.instagram.com'))
      && parsed.pathname.split('/').filter(Boolean).length > 0;
  }, 'Use a valid https://instagram.com profile URL');

export const industryOptions = [
  'Beauty & Personal Care',
  'Fashion & Apparel',
  'Food & Beverage',
  'Health & Fitness',
  'Technology & Software',
  'Travel & Hospitality',
  'Gaming & Esports',
  'Consumer Services',
  'Education',
  'Finance & Fintech',
  'Automotive',
  'Home & Living',
  'Entertainment & Media',
  'Sports',
  'Parenting & Family',
  'Pets & Animals',
  'Luxury & Lifestyle',
  'E-commerce & Retail',
  'Real Estate',
  'Business & Professional Services',
  'Art & Design',
  'Photography',
  'Music',
  'Books & Publishing',
  'Sustainability & Environment',
  'Nonprofit & Social Impact',
  'Advertising & Marketing',
  'Creator Economy & Influencer Marketing',
  'Events & Experiences',
  'Hospitality & Restaurants',
  'Cafes & Bakeries',
  'Consumer Electronics',
  'Mobile Apps & Digital Products',
  'SaaS & B2B Software',
  'AI & Machine Learning',
  'Telecommunications',
  'Banking & Payments',
  'Insurance',
  'Investing & Wealth',
  'Healthcare & Clinics',
  'Medicine & Pharmaceuticals',
  'Skincare & Cosmetics',
  'Jewellery & Accessories',
  'Footwear',
  'Grocery & FMCG',
  'Restaurants & Quick Service',
  'Beverages',
  'Hotels & Resorts',
  'Airlines & Transportation',
  'Logistics & Delivery',
  'Construction & Infrastructure',
  'Architecture & Interiors',
  'Manufacturing',
  'Agriculture & Farming',
  'Energy & Utilities',
  'Legal Services',
  'Recruitment & HR',
  'Consulting',
  'Cybersecurity',
  'Web3 & Blockchain',
  'News & Journalism',
  'Film & Television',
  'Podcasts & Audio',
  'Comics & Animation',
  'Kids & Toys',
  'Dating & Relationships',
  'Spirituality & Wellness',
  'Government & Public Sector',
  'Other',
] as const;

export const creatorOnboardingSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(80),
    username: z
      .string()
      .trim()
      .min(3, 'Use at least 3 characters')
      .max(30)
      .regex(/^[a-zA-Z0-9._]+$/, 'Use only letters, numbers, periods, and underscores'),
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

export const brandOnboardingSchema = z
  .object({
    brandName: z.string().trim().min(2, 'Enter your brand name').max(120),
    website: websiteUrl,
    industry: z.string().min(1, 'Choose your industry'),
    customIndustry: z.string().trim().max(100, 'Keep the industry name under 100 characters').optional(),
    description: z.string().trim().min(20, 'Add a short brand description').max(800),
    location: z.string().trim().min(2, 'Enter your location').max(100),
    targetAudience: z.string().trim().min(10, 'Describe your target audience').max(500),
    typicalBudget: money.min(1_000, 'Enter a typical budget of at least ₹1,000'),
    targetCreatorNiche: z.string().min(1, 'Choose a target niche'),
    targetCreatorLocation: z.string().trim().min(2, 'Enter a target location').max(100),
    preferredPlatforms: z.array(z.string()).min(1, 'Choose at least one platform'),
    campaignObjectives: z.array(z.string()).min(1, 'Choose at least one objective'),
  })
  .superRefine((data, ctx) => {
    if (data.industry === 'Other' && (!data.customIndustry || data.customIndustry.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIndustry'],
        message: 'Tell us your industry or niche',
      });
    }
  });

export type CreatorOnboardingInput = z.infer<typeof creatorOnboardingSchema>;
export type BrandOnboardingInput = z.infer<typeof brandOnboardingSchema>;

// Creators and brands deliberately share one category vocabulary.
export const creatorNiches = industryOptions;

export const socialPlatforms = ['Instagram', 'YouTube', 'TikTok', 'Facebook'] as const;
