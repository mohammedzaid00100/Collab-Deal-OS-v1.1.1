import { z } from 'zod';

const money = z.number({ error: 'Enter an amount' }).int('Use a whole amount').min(0, 'Cannot be negative').max(1_000_000_000);
const optionalDays = z.union([z.nan().transform(() => undefined), z.number().int().min(0).max(3650)]).optional();

export const offerSchema = z.object({
  cashPayment: money,
  productName: z.string().trim().max(120).optional(),
  productValue: money,
  dealType: z.enum(['PAID', 'PRODUCT_ONLY', 'HYBRID']),
  deliverables: z.array(z.object({
    type: z.string().trim().min(2, 'Choose a deliverable').max(80),
    quantity: z.number({ error: 'Enter a quantity' }).int().min(1).max(100),
    notes: z.string().trim().max(300).optional(),
  })).min(1, 'Add at least one deliverable').max(20),
  usageRights: z.string().trim().max(1000).optional(),
  usageDurationDays: optionalDays,
  paidAdRights: z.boolean(),
  exclusivity: z.boolean(),
  exclusivityDurationDays: optionalDays,
  deadline: z.string().min(1, 'Set an offer deadline'),
  territory: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((data, ctx) => {
  if (data.dealType === 'PAID' && data.cashPayment <= 0) ctx.addIssue({ code: 'custom', path: ['cashPayment'], message: 'Paid offers require a cash payment' });
  if (data.dealType === 'PRODUCT_ONLY' && data.productValue <= 0) ctx.addIssue({ code: 'custom', path: ['productValue'], message: 'Product-only offers require a product value' });
  if (data.dealType === 'HYBRID' && (data.cashPayment <= 0 || data.productValue <= 0)) ctx.addIssue({ code: 'custom', path: [data.cashPayment <= 0 ? 'cashPayment' : 'productValue'], message: 'Hybrid offers require both cash and product value' });
  if (data.productValue > 0 && !data.productName) ctx.addIssue({ code: 'custom', path: ['productName'], message: 'Name the product included in the offer' });
  if (data.exclusivity && !data.exclusivityDurationDays) ctx.addIssue({ code: 'custom', path: ['exclusivityDurationDays'], message: 'Set an exclusivity duration' });
  if (data.deadline && Date.parse(data.deadline) <= Date.now()) ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Deadline must be in the future' });
});

export type OfferInput = z.infer<typeof offerSchema>;

export function toOfferTerms(data: OfferInput) {
  return {
    cash_payment: data.cashPayment,
    currency: 'INR',
    product_name: data.productName || null,
    product_value: data.productValue,
    deal_type: data.dealType,
    deliverables: data.deliverables,
    usage_rights: data.usageRights || null,
    usage_duration_days: data.usageDurationDays ?? null,
    paid_ad_rights: data.paidAdRights,
    exclusivity: data.exclusivity,
    exclusivity_duration_days: data.exclusivity ? (data.exclusivityDurationDays ?? null) : null,
    deadline: new Date(data.deadline).toISOString(),
    territory: data.territory || null,
    notes: data.notes || null,
  };
}
