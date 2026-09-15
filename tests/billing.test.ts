import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyRazorpayCheckoutSignature, verifyRazorpayWebhookSignature } from '@/lib/billing/razorpay';
import { getRazorpayBillingConfig, getRazorpayPlanId } from '@/lib/billing/config';
import { parseRazorpayWebhookEnvelope } from '@/lib/billing/webhook';
import { createSubscriptionRequestSchema } from '@/lib/validation/billing';
import { buildNotificationEmail } from '@/lib/delivery/email';
import { isTrustedMutationRequest } from '@/lib/security/request';

afterEach(() => vi.unstubAllEnvs());
describe('billing trust boundaries', () => {
  it('verifies the exact raw webhook bytes and rejects reformatting', () => {
    const raw = '{ "event": "subscription.charged" }';
    const signature = createHmac('sha256', 'test-secret').update(raw).digest('hex');
    expect(verifyRazorpayWebhookSignature(raw, signature, ['test-secret'])).toBe(true);
    expect(verifyRazorpayWebhookSignature(JSON.stringify(JSON.parse(raw)), signature, ['test-secret'])).toBe(false);
    expect(verifyRazorpayWebhookSignature(raw, 'bad', ['test-secret'])).toBe(false);
    expect(verifyRazorpayWebhookSignature(raw, signature, ['rotated-secret', 'test-secret'])).toBe(true);
  });
  it('binds checkout verification to the stored subscription', () => {
    const paymentId = 'pay_12345678901234';
    const storedSubscriptionId = 'sub_12345678901234';
    const receivedSignature = createHmac('sha256', 'test-secret').update(`${paymentId}|${storedSubscriptionId}`).digest('hex');
    expect(verifyRazorpayCheckoutSignature({ paymentId, storedSubscriptionId, receivedSignature, keySecret: 'test-secret' })).toBe(true);
    expect(verifyRazorpayCheckoutSignature({ paymentId, storedSubscriptionId: 'sub_99999999999999', receivedSignature, keySecret: 'test-secret' })).toBe(false);
  });
  it('does not accept browser-supplied prices, role, or provider plan IDs', () => {
    expect(createSubscriptionRequestSchema.safeParse({ requestId: crypto.randomUUID(), plan: 'PRO', price: 1 }).success).toBe(false);
    expect(createSubscriptionRequestSchema.safeParse({ requestId: crypto.randomUUID(), plan: 'FREE' }).success).toBe(false);
  });
  it('requires explicit billing cycles and maps each role to its own plan', () => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_123456'); vi.stubEnv('RAZORPAY_KEY_SECRET', 'test-secret');
    vi.stubEnv('RAZORPAY_SUBSCRIPTION_TOTAL_COUNT', '');
    expect(() => getRazorpayBillingConfig()).toThrow();
    vi.stubEnv('RAZORPAY_SUBSCRIPTION_TOTAL_COUNT', '12');
    expect(getRazorpayBillingConfig().totalCount).toBe(12);
    vi.stubEnv('RAZORPAY_CREATOR_PRO_PLAN_ID', 'plan_12345678901234');
    vi.stubEnv('RAZORPAY_BRAND_PRO_PLAN_ID', 'plan_98765432109876');
    expect(getRazorpayPlanId('creator', 'PRO')).not.toBe(getRazorpayPlanId('brand', 'PRO'));
  });
  it('reads the documented nested subscription webhook envelope', () => {
    expect(parseRazorpayWebhookEnvelope({ entity: 'event', event: 'subscription.charged', created_at: 1787913000,
      payload: { subscription: { entity: { id: 'sub_12345678901234', notes: [] } } },
    }).subscriptionId).toBe('sub_12345678901234');
  });
  it('rejects cross-origin billing mutations', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://deals.example');
    expect(isTrustedMutationRequest(new Request('https://deals.example/api', { headers: { origin: 'https://attacker.example' } }))).toBe(false);
    expect(isTrustedMutationRequest(new Request('https://deals.example/api', { headers: { origin: 'https://deals.example' } }))).toBe(true);
  });
});

describe('transactional email safety', () => {
  it('escapes notification text and refuses external action links', () => {
    const email = buildNotificationEmail({ subject: '<script>alert(1)</script>', body: '<img onerror=evil()>', action_path: '//attacker.example' }, 'https://deals.example');
    expect(email.html).not.toContain('<script>'); expect(email.html).not.toContain('<img');
    expect(email.text).toContain('https://deals.example/login'); expect(email.html).not.toContain('attacker.example');
  });
});
