import { z } from 'zod';

const rate = z.number().finite().min(0);
const positive = z.number().finite().positive();

export const pricingBenchmarkConfigSchema = z.object({
  baseCpmInr: positive,
  viewRateFallback: z.number().finite().min(0.01).max(2),
  avgViewsWeight: z.number().finite().min(0).max(1),
  followerWeight: z.number().finite().min(0).max(1),
  engagementReferenceLow: z.number().finite().min(0).max(100),
  engagementReferenceHigh: z.number().finite().min(0).max(100),
  engagementMultiplierMin: positive,
  engagementMultiplierMax: positive,
  deliverableMultipliers: z.record(z.string(), positive),
  productionFloors: z.record(z.string(), positive),
  formatMultiplier: positive,
  demandMultiplier: positive,
  productRealizationRate: z.number().finite().min(0).max(1),
  rightsBaseRates: z.object({
    CREATOR_CHANNELS_ONLY: rate,
    BRAND_ORGANIC: rate,
    MULTI_CHANNEL_ORGANIC: rate,
  }),
  rightsDailyRate: rate,
  rightsCap: rate,
  paidAdsBaseRate: rate,
  paidAdsMonthlyRate: rate,
  adsCap: rate,
  whitelistingRate: rate,
  exclusivityMonthlyRate: rate,
  exclusivityCap: rate,
  territoryRates: z.object({ LOCAL: rate, NATIONAL: rate, MULTI_COUNTRY: rate, GLOBAL: rate }),
  rushThresholdDays: z.number().int().min(1),
  rushRate: rate,
  urgentThresholdDays: z.number().int().min(1),
  urgentRate: rate,
  fitMaxAdjustment: z.number().finite().min(0).max(0.25),
  minimumDealValue: positive,
  minRangeWidth: z.number().finite().min(0.01).max(0.75),
  maxRangeWidth: z.number().finite().min(0.01).max(0.9),
  roundingIncrement: z.number().int().positive(),
  confidenceCap: z.number().finite().min(1).max(100),
}).superRefine((config, ctx) => {
  if (Math.abs(config.avgViewsWeight + config.followerWeight - 1) > 0.000001) {
    ctx.addIssue({ code: 'custom', path: ['avgViewsWeight'], message: 'Performance weights must total 1' });
  }
  if (config.engagementReferenceHigh <= config.engagementReferenceLow) {
    ctx.addIssue({ code: 'custom', path: ['engagementReferenceHigh'], message: 'Engagement high must exceed low' });
  }
  if (config.engagementMultiplierMax < config.engagementMultiplierMin) {
    ctx.addIssue({ code: 'custom', path: ['engagementMultiplierMax'], message: 'Engagement multiplier range is invalid' });
  }
  if (config.maxRangeWidth < config.minRangeWidth) {
    ctx.addIssue({ code: 'custom', path: ['maxRangeWidth'], message: 'Range widths are invalid' });
  }
  if (config.urgentThresholdDays > config.rushThresholdDays) {
    ctx.addIssue({ code: 'custom', path: ['urgentThresholdDays'], message: 'Urgent threshold must be within rush threshold' });
  }
});

export type PricingBenchmarkConfig = z.infer<typeof pricingBenchmarkConfigSchema>;

export interface ResolvedPricingBenchmark {
  configuration: PricingBenchmarkConfig;
  engineVersion: string;
  benchmarkRefs: string[];
  sourceLabel: string;
  configHash: string;
  specificityScore: number;
}

export class PricingConfigurationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PricingConfigurationError';
  }
}
