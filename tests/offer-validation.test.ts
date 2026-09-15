import { describe, expect, it } from 'vitest';
import { offerSchema, toOfferTerms } from '@/lib/validation/offer';

const validOffer = {
  cashPayment: 20_000,
  productName: 'Creator kit',
  productValue: 4_000,
  dealType: 'HYBRID' as const,
  deliverables: [{ type: 'Instagram Reel', quantity: 1, notes: '30–45 seconds' }],
  usageRights: 'Organic brand social channels',
  usageDurationDays: 90,
  paidAdRights: false,
  exclusivity: true,
  exclusivityDurationDays: 30,
  deadline: '2099-12-31T12:00',
  territory: 'India',
  notes: 'One compliance review before publication.',
};

describe('structured offer validation', () => {
  it('accepts complete hybrid terms and maps server keys', () => {
    const parsed = offerSchema.parse(validOffer);
    expect(toOfferTerms(parsed)).toMatchObject({
      cash_payment: 20_000,
      product_value: 4_000,
      deal_type: 'HYBRID',
      exclusivity: true,
    });
  });

  it('requires a future deadline', () => {
    expect(offerSchema.safeParse({ ...validOffer, deadline: '' }).success).toBe(false);
    expect(offerSchema.safeParse({ ...validOffer, deadline: '2020-01-01T00:00' }).success).toBe(false);
  });

  it('requires deal value to match the deal type', () => {
    expect(offerSchema.safeParse({ ...validOffer, cashPayment: 0 }).success).toBe(false);
    expect(offerSchema.safeParse({ ...validOffer, dealType: 'PAID', cashPayment: 0, productValue: 0 }).success).toBe(false);
  });

  it('requires exclusivity duration only when exclusivity is enabled', () => {
    expect(offerSchema.safeParse({ ...validOffer, exclusivityDurationDays: undefined }).success).toBe(false);
  });
});
