import { describe, expect, it } from 'vitest';
import { campaignSchema } from '@/lib/validation/campaign';

const validCampaign = {
  title: 'Summer creator launch',
  description: 'A structured creator campaign for a new seasonal product launch.',
  platform: 'Instagram',
  targetCreatorNiche: 'Beauty',
  targetLocation: 'India',
  targetFollowersMin: 10_000,
  targetFollowersMax: 100_000,
  targetEngagementMin: 2,
  targetEngagementMax: 8,
  budget: 25_000,
  dealType: 'HYBRID' as const,
  productName: 'Summer care kit',
  productValue: 5_000,
  deliverables: [{ type: 'Instagram Reel', quantity: 1, notes: '' }],
  objective: 'Product launch',
  startsAt: '2026-09-01',
  endsAt: '2026-09-30',
  submissionDeadline: '2026-09-20T12:00',
  usageRights: 'Organic social usage',
  usageDurationDays: 90,
  paidAdRights: false,
  exclusivity: false,
  exclusivityDurationDays: undefined,
  territory: 'India',
  additionalRequirements: '',
};

describe('campaign validation', () => {
  it('accepts complete structured hybrid terms', () => {
    expect(campaignSchema.safeParse(validCampaign).success).toBe(true);
  });

  it('requires both cash and product value for a hybrid deal', () => {
    const result = campaignSchema.safeParse({ ...validCampaign, budget: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects inverted audience and engagement ranges', () => {
    const result = campaignSchema.safeParse({
      ...validCampaign,
      targetFollowersMax: 5_000,
      targetEngagementMax: 1,
    });
    expect(result.success).toBe(false);
  });

  it('requires a duration when exclusivity is enabled', () => {
    const result = campaignSchema.safeParse({ ...validCampaign, exclusivity: true });
    expect(result.success).toBe(false);
  });
});
