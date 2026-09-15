import { describe, expect, it } from 'vitest';
import {
  brandOnboardingSchema,
  creatorOnboardingSchema,
} from '@/lib/validation/onboarding';

const validCreator = {
  fullName: 'Aanya Sharma',
  username: 'aanya_creates',
  bio: 'Beauty creator producing practical tutorials and polished short-form product stories.',
  niche: 'Beauty',
  location: 'Mumbai, India',
  primaryAudienceRegion: 'India',
  primaryContentFormat: 'Short-form video',
  instagramUrl: 'https://instagram.com/aanya_creates',
  instagramFollowers: 128600,
  facebookUrl: '',
  facebookFollowers: 12000,
  youtubeUrl: '',
  youtubeSubscribers: 56000,
  tiktokUrl: '',
  tiktokFollowers: 0,
  otherPlatformName: '',
  otherPlatformUrl: '',
  otherPlatformFollowers: 0,
  averageViews: 64000,
  engagementRate: 4.8,
  expectedRateLow: 28000,
  expectedRateHigh: 36000,
  portfolioUrl: '',
  mediaKitUrl: '',
};

describe('creator onboarding validation', () => {
  it('preserves creator-declared follower and performance metrics', () => {
    const result = creatorOnboardingSchema.safeParse(validCreator);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.instagramFollowers).toBe(128600);
      expect(result.data.averageViews).toBe(64000);
      expect(result.data.engagementRate).toBe(4.8);
    }
  });

  it('requires an Instagram URL from instagram.com', () => {
    const result = creatorOnboardingSchema.safeParse({ ...validCreator, instagramUrl: 'https://example.com/aanya' });
    expect(result.success).toBe(false);
  });

  it('rejects an inverted expected rate range', () => {
    const result = creatorOnboardingSchema.safeParse({ ...validCreator, expectedRateLow: 50000, expectedRateHigh: 25000 });
    expect(result.success).toBe(false);
  });

  it('rejects impossible engagement values', () => {
    expect(creatorOnboardingSchema.safeParse({ ...validCreator, engagementRate: 101 }).success).toBe(false);
  });
});

describe('brand onboarding validation', () => {
  const brand = {
    brandName: 'Nila Beauty',
    website: 'https://nilabeauty.example',
    industry: 'Beauty & Personal Care',
    description: 'Indian clean beauty products designed for warm climates and everyday routines.',
    location: 'Bengaluru, India',
    targetAudience: 'Urban Indian adults aged 20–35 interested in practical skincare.',
    typicalBudget: 150000,
    targetCreatorNiche: 'Beauty',
    targetCreatorLocation: 'India',
    preferredPlatforms: ['INSTAGRAM'],
    campaignObjectives: ['AWARENESS'],
  };

  it('accepts a complete brand profile', () => {
    expect(brandOnboardingSchema.safeParse(brand).success).toBe(true);
  });

  it('requires at least one preferred platform', () => {
    expect(brandOnboardingSchema.safeParse({ ...brand, preferredPlatforms: [] }).success).toBe(false);
  });
});
