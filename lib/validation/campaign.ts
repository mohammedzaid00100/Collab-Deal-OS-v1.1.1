import { z } from 'zod';

const money = z.number({ error: 'Enter an amount' }).int('Use a whole amount').min(0, 'Cannot be negative').max(1_000_000_000, 'Amount is too large');
const count = z.number({ error: 'Enter a number' }).int('Use a whole number').min(0, 'Cannot be negative').max(1_000_000_000, 'Value is too large');
const optionalPercent = z.union([
  z.nan().transform(() => undefined),
  z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
]).optional();

export const campaignDeliverableTypes = [
  'Instagram Reel',
  'Instagram Feed Post',
  'Instagram Story',
  'TikTok Video',
  'YouTube Integration',
  'UGC Video',
  'Other',
] as const;

export const campaignSchema = z
  .object({
    title: z.string().trim().min(3, 'Use at least 3 characters').max(160),
    description: z.string().trim().min(20, 'Add at least 20 characters').max(3000),
    platform: z.string().trim().min(2, 'Choose a platform').max(50),
    targetCreatorNiche: z.string().trim().min(2, 'Choose a niche').max(80),
    targetLocation: z.string().trim().max(100).optional(),
    targetFollowersMin: count,
    targetFollowersMax: z.union([z.nan().transform(() => undefined), count]).optional(),
    targetEngagementMin: optionalPercent,
    targetEngagementMax: optionalPercent,
    budget: money,
    dealType: z.enum(['PAID', 'PRODUCT_ONLY', 'HYBRID']),
    productName: z.string().trim().max(120).optional(),
    productValue: money,
    deliverables: z.array(z.object({
      type: z.string().trim().min(2, 'Choose a deliverable').max(80),
      quantity: z.number({ error: 'Enter a quantity' }).int().min(1).max(100),
      notes: z.string().trim().max(300).optional(),
    })).min(1, 'Add at least one deliverable').max(20),
    objective: z.string().trim().min(3, 'Choose or describe an objective').max(300),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    submissionDeadline: z.string().optional(),
    usageRights: z.string().trim().max(1000).optional(),
    usageDurationDays: z.union([z.nan().transform(() => undefined), z.number().int().min(0).max(3650)]).optional(),
    paidAdRights: z.boolean(),
    exclusivity: z.boolean(),
    exclusivityDurationDays: z.union([z.nan().transform(() => undefined), z.number().int().min(0).max(3650)]).optional(),
    territory: z.string().trim().max(160).optional(),
    additionalRequirements: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.targetFollowersMax != null && data.targetFollowersMax < data.targetFollowersMin) {
      ctx.addIssue({ code: 'custom', path: ['targetFollowersMax'], message: 'Maximum must be at least the minimum' });
    }
    if (data.targetEngagementMin != null && data.targetEngagementMax != null && data.targetEngagementMax < data.targetEngagementMin) {
      ctx.addIssue({ code: 'custom', path: ['targetEngagementMax'], message: 'Maximum must be at least the minimum' });
    }
    if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End date must be after the start date' });
    }
    if (data.dealType === 'PAID' && data.budget <= 0) {
      ctx.addIssue({ code: 'custom', path: ['budget'], message: 'Paid campaigns require a cash budget' });
    }
    if (data.dealType === 'PRODUCT_ONLY' && data.productValue <= 0) {
      ctx.addIssue({ code: 'custom', path: ['productValue'], message: 'Product-only campaigns require a product value' });
    }
    if (data.dealType === 'HYBRID' && (data.budget <= 0 || data.productValue <= 0)) {
      ctx.addIssue({ code: 'custom', path: [data.budget <= 0 ? 'budget' : 'productValue'], message: 'Hybrid campaigns require both cash and product value' });
    }
    if (data.productValue > 0 && !data.productName) {
      ctx.addIssue({ code: 'custom', path: ['productName'], message: 'Name the product included in the deal' });
    }
    if (data.exclusivity && !data.exclusivityDurationDays) {
      ctx.addIssue({ code: 'custom', path: ['exclusivityDurationDays'], message: 'Set an exclusivity duration' });
    }
  });

export type CampaignInput = z.infer<typeof campaignSchema>;
