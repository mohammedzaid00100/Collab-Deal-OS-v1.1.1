import { describe, expect, it } from 'vitest';
import { calculateDealPricing, PricingInputError } from '@/lib/pricing/engine';
import { PricingConfigurationError, type ResolvedPricingBenchmark } from '@/lib/pricing/config';
import type { DealAnalysisFormInput } from '@/lib/validation/analysis';

const benchmark: ResolvedPricingBenchmark = {
  engineVersion: 'pricing-v1.0.0', benchmarkRefs: ['00000000-0000-4000-8000-000000000001'],
  sourceLabel: 'Internal illustrative test configuration', configHash: 'a'.repeat(64), specificityScore: 15,
  configuration: {
    baseCpmInr: 450, viewRateFallback: 0.2, avgViewsWeight: 0.8, followerWeight: 0.2,
    engagementReferenceLow: 1, engagementReferenceHigh: 8,
    engagementMultiplierMin: 0.8, engagementMultiplierMax: 1.35,
    deliverableMultipliers: { 'Instagram Reel': 1, 'Instagram Feed Post': 0.65, 'Instagram Story': 0.35, 'TikTok Video': 0.9, 'YouTube Integration': 1.35, 'UGC Video': 0.85, Other: 0.75 },
    productionFloors: { 'Instagram Reel': 1800, 'Instagram Feed Post': 1200, 'Instagram Story': 600, 'TikTok Video': 1600, 'YouTube Integration': 3000, 'UGC Video': 1800, Other: 1200 },
    formatMultiplier: 1, demandMultiplier: 1, productRealizationRate: 0.5,
    rightsBaseRates: { CREATOR_CHANNELS_ONLY: 0, BRAND_ORGANIC: 0.08, MULTI_CHANNEL_ORGANIC: 0.15 },
    rightsDailyRate: 0.0015, rightsCap: 0.6, paidAdsBaseRate: 0.25,
    paidAdsMonthlyRate: 0.1, adsCap: 1.2, whitelistingRate: 0.35,
    exclusivityMonthlyRate: 0.08, exclusivityCap: 0.8,
    territoryRates: { LOCAL: 0, NATIONAL: 0.03, MULTI_COUNTRY: 0.08, GLOBAL: 0.15 },
    rushThresholdDays: 7, rushRate: 0.12, urgentThresholdDays: 3, urgentRate: 0.25,
    fitMaxAdjustment: 0.1, minimumDealValue: 1000, minRangeWidth: 0.15,
    maxRangeWidth: 0.4, roundingIncrement: 100, confidenceCap: 90,
  },
};

function input(overrides: Partial<DealAnalysisFormInput> = {}): DealAnalysisFormInput {
  const base: DealAnalysisFormInput = {
    currency: 'INR',
    creator: {
      followers: 100_000, followersStatus: 'CREATOR_DECLARED',
      averageViews: 20_000, averageViewsStatus: 'CREATOR_DECLARED',
      engagementRate: 4.5, engagementRateStatus: 'CREATOR_DECLARED',
      niche: 'Beauty', platform: 'Instagram', audienceRegion: 'India', location: 'Mumbai',
    },
    deal: {
      cashOffer: 8_000, productValue: 0, creatorKeepsProduct: false,
      deliverables: [{ type: 'Instagram Reel', quantity: 1, notes: '' }],
      turnaroundDays: 14, usageCategory: 'CREATOR_CHANNELS_ONLY', usageRightsText: '',
      usageDurationDays: 0, perpetualUsage: false, paidAdRights: false,
      paidAdDurationDays: 0, whitelisting: false, territoryCategory: 'NATIONAL',
      territoryText: 'India', exclusivity: false, exclusivityDurationDays: 0,
      campaignBudget: 10_000, context: '',
    },
  };
  return { ...base, ...overrides, creator: { ...base.creator, ...overrides.creator }, deal: { ...base.deal, ...overrides.deal } };
}

describe('deterministic pricing engine', () => {
  it('returns byte-stable, bounded integer money outputs', () => {
    const first = calculateDealPricing(input(), benchmark);
    const second = calculateDealPricing(input(), benchmark);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.fairLow).toBeLessThanOrEqual(first.fairMid);
    expect(first.fairMid).toBeLessThanOrEqual(first.fairHigh);
    for (const amount of [first.fairLow, first.fairMid, first.fairHigh, first.recommendedCounter]) {
      expect(Number.isSafeInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('makes average views materially stronger than follower changes', () => {
    const baseline = calculateDealPricing(input(), benchmark).fairMid;
    const viewsDoubled = calculateDealPricing(input({ creator: { averageViews: 40_000 } as DealAnalysisFormInput['creator'] }), benchmark).fairMid;
    const followersDoubled = calculateDealPricing(input({ creator: { followers: 200_000 } as DealAnalysisFormInput['creator'] }), benchmark).fairMid;
    expect(viewsDoubled - baseline).toBeGreaterThan((followersDoubled - baseline) * 2);
  });

  it('caps the follower proxy when representative average views exist', () => {
    const million = calculateDealPricing(input({ creator: { followers: 1_000_000 } as DealAnalysisFormInput['creator'] }), benchmark);
    const tenMillion = calculateDealPricing(input({ creator: { followers: 10_000_000 } as DealAnalysisFormInput['creator'] }), benchmark);
    expect(tenMillion.fairMid).toBe(million.fairMid);
  });

  it('uses metric provenance only for confidence and range width', () => {
    const declared = calculateDealPricing(input(), benchmark);
    const verified = calculateDealPricing(input({ creator: { followersStatus: 'API_VERIFIED', averageViewsStatus: 'API_VERIFIED', engagementRateStatus: 'API_VERIFIED' } as DealAnalysisFormInput['creator'] }), benchmark);
    expect(verified.fairMid).toBe(declared.fairMid);
    expect(verified.confidenceScore).toBeGreaterThan(declared.confidenceScore);
    expect(verified.fairHigh - verified.fairLow).toBeLessThan(declared.fairHigh - declared.fairLow);
  });

  it('does not let cash, product, or campaign budget anchor fair value', () => {
    const base = calculateDealPricing(input(), benchmark);
    const changed = calculateDealPricing(input({ deal: { cashOffer: 100, productValue: 50_000, creatorKeepsProduct: true, campaignBudget: 500 } as DealAnalysisFormInput['deal'] }), benchmark);
    expect([changed.fairLow, changed.fairMid, changed.fairHigh]).toEqual([base.fairLow, base.fairMid, base.fairHigh]);
    expect(changed.economicOfferValue).not.toBe(base.economicOfferValue);
  });

  it('credits retained product at the configured non-cash realization rate', () => {
    const notKept = calculateDealPricing(input({ deal: { productValue: 10_000, creatorKeepsProduct: false } as DealAnalysisFormInput['deal'] }), benchmark);
    const kept = calculateDealPricing(input({ deal: { productValue: 10_000, creatorKeepsProduct: true } as DealAnalysisFormInput['deal'] }), benchmark);
    expect(kept.economicOfferValue - notKept.economicOfferValue).toBe(5_000);
    expect(kept.fairMid).toBe(notKept.fairMid);
  });

  it('never lowers value when structured scope or rights increase', () => {
    const base = calculateDealPricing(input(), benchmark).fairMid;
    const expanded = calculateDealPricing(input({ deal: {
      deliverables: [{ type: 'Instagram Reel', quantity: 2, notes: '' }],
      usageCategory: 'MULTI_CHANNEL_ORGANIC', usageDurationDays: 180,
      paidAdRights: true, paidAdDurationDays: 90, whitelisting: true,
      exclusivity: true, exclusivityDurationDays: 90, territoryCategory: 'GLOBAL', turnaroundDays: 3,
    } as DealAnalysisFormInput['deal'] }), benchmark).fairMid;
    expect(expanded).toBeGreaterThan(base);
  });

  it('fails closed without performance data or deliverable configuration', () => {
    try {
      calculateDealPricing(input({ creator: { followers: 0, followersStatus: 'UNAVAILABLE', averageViews: 0, averageViewsStatus: 'UNAVAILABLE' } as DealAnalysisFormInput['creator'] }), benchmark);
      expect.fail('Expected performance validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PricingInputError);
      expect((error as PricingInputError).code).toBe('INSUFFICIENT_PERFORMANCE_DATA');
    }
    try {
      calculateDealPricing(input({ deal: { deliverables: [{ type: 'Podcast', quantity: 1 }] } as DealAnalysisFormInput['deal'] }), benchmark);
      expect.fail('Expected deliverable configuration to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PricingConfigurationError);
      expect((error as PricingConfigurationError).code).toBe('UNSUPPORTED_DELIVERABLE');
    }
  });

  it('rejects unsupported currency instead of silently applying INR values', () => {
    expect(() => calculateDealPricing(input({ currency: 'USD' }), benchmark)).toThrow();
  });

  it('uses the neutral below/within/above score formula', () => {
    const reference = calculateDealPricing(input(), benchmark);
    const below = calculateDealPricing(input({ deal: { cashOffer: Math.floor(reference.fairLow / 2) } as DealAnalysisFormInput['deal'] }), benchmark);
    const within = calculateDealPricing(input({ deal: { cashOffer: reference.fairMid } as DealAnalysisFormInput['deal'] }), benchmark);
    const above = calculateDealPricing(input({ deal: { cashOffer: reference.fairHigh * 2 } as DealAnalysisFormInput['deal'] }), benchmark);
    expect(below.dealScore).toBeCloseTo(50, -1);
    expect(within.dealScore).toBe(100);
    expect(above.dealScore).toBe(50);
  });
});
