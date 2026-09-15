import { z } from 'zod';
import { metricStatuses } from '@/types/domain';

const count = z.number({ error: 'Enter a number' }).int('Use a whole number').min(0, 'Cannot be negative').max(1_000_000_000, 'Value is too large');
const money = z.number({ error: 'Enter an amount' }).int('Use a whole amount').min(0, 'Cannot be negative').max(1_000_000_000, 'Amount is too large');
const days = z.number({ error: 'Enter a duration' }).int('Use whole days').min(0, 'Cannot be negative').max(3650, 'Duration is too long');

export const pricingPlatforms = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'Other'] as const;

export const dealAnalysisInputSchema = z.object({
  sourceOfferId: z.string().uuid().optional(),
  sourceOfferVersion: z.number().int().min(1).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code'),
  creator: z.object({
    creatorProfileId: z.string().uuid().optional(),
    followers: count,
    followersStatus: z.enum(metricStatuses),
    averageViews: count,
    averageViewsStatus: z.enum(metricStatuses),
    engagementRate: z.number({ error: 'Enter engagement rate' }).min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
    engagementRateStatus: z.enum(metricStatuses),
    niche: z.string().trim().min(2, 'Enter a niche').max(80),
    platform: z.enum(pricingPlatforms),
    audienceRegion: z.string().trim().min(2, 'Enter the audience region').max(100),
    location: z.string().trim().min(2, 'Enter the creator location').max(100),
  }),
  deal: z.object({
    cashOffer: money,
    productValue: money,
    creatorKeepsProduct: z.boolean(),
    deliverables: z.array(z.object({
      type: z.string().trim().min(2, 'Choose a deliverable').max(80),
      quantity: z.number({ error: 'Enter a quantity' }).int().min(1).max(100),
      notes: z.string().trim().max(300).optional().nullable(),
    })).min(1, 'Add at least one deliverable').max(20),
    turnaroundDays: z.number({ error: 'Enter turnaround days' }).int().min(1, 'Use at least one day').max(3650),
    usageCategory: z.enum(['CREATOR_CHANNELS_ONLY', 'BRAND_ORGANIC', 'MULTI_CHANNEL_ORGANIC']),
    usageRightsText: z.string().trim().max(1000).optional(),
    usageDurationDays: days,
    perpetualUsage: z.boolean(),
    paidAdRights: z.boolean(),
    paidAdDurationDays: days,
    whitelisting: z.boolean(),
    territoryCategory: z.enum(['LOCAL', 'NATIONAL', 'MULTI_COUNTRY', 'GLOBAL']),
    territoryText: z.string().trim().min(2, 'Enter a territory').max(160),
    exclusivity: z.boolean(),
    exclusivityDurationDays: days,
    campaignBudget: money.optional(),
    campaignFitScore: z.number().min(0).max(100).optional(),
    context: z.string().trim().max(1000).optional(),
  }),
}).superRefine((data, ctx) => {
  if (data.currency !== 'INR') {
    ctx.addIssue({ code: 'custom', path: ['currency'], message: 'The V1 pricing benchmark currently supports INR only' });
  }
  if (data.deal.usageCategory !== 'CREATOR_CHANNELS_ONLY' && !data.deal.perpetualUsage && data.deal.usageDurationDays <= 0) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'usageDurationDays'], message: 'Set a duration for usage rights' });
  }
  if (data.deal.usageCategory === 'CREATOR_CHANNELS_ONLY' && (data.deal.paidAdRights || data.deal.whitelisting)) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'usageCategory'], message: 'Paid ads or whitelisting require brand usage rights' });
  }
  if (data.deal.usageCategory === 'CREATOR_CHANNELS_ONLY' && data.deal.perpetualUsage) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'perpetualUsage'], message: 'Perpetual usage requires brand usage rights' });
  }
  if (data.deal.paidAdRights && data.deal.paidAdDurationDays <= 0) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'paidAdDurationDays'], message: 'Set the paid-ad duration' });
  }
  if (!data.deal.paidAdRights && data.deal.paidAdDurationDays > 0) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'paidAdDurationDays'], message: 'Paid-ad duration requires paid-ad rights' });
  }
  if (data.deal.exclusivity && data.deal.exclusivityDurationDays <= 0) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'exclusivityDurationDays'], message: 'Set an exclusivity duration' });
  }
  if (!data.deal.exclusivity && data.deal.exclusivityDurationDays > 0) {
    ctx.addIssue({ code: 'custom', path: ['deal', 'exclusivityDurationDays'], message: 'Exclusivity duration requires exclusivity' });
  }
});

export const aiVerdictSchema = z.object({
  verdict: z.enum(['BELOW_FAIR', 'FAIR', 'ABOVE_FAIR', 'NEEDS_REVIEW']),
  summary: z.string().trim().min(1).max(700),
  strengths: z.array(z.string().trim().min(1).max(240)).max(6),
  risks: z.array(z.string().trim().min(1).max(240)).max(8),
  recommended_counter: money,
  reasoning_points: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  confidence_message: z.string().trim().min(1).max(400),
});

export type DealAnalysisFormInput = z.infer<typeof dealAnalysisInputSchema>;
