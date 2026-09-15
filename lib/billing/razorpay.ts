import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AccountType } from '@/types/domain';
import type { PaidPlanTier, RazorpayBillingConfig } from './config';

const subscriptionSchema = z.object({
  id: z.string().regex(/^sub_[A-Za-z0-9]{14,}$/),
  entity: z.literal('subscription').optional(),
  plan_id: z.string().regex(/^plan_[A-Za-z0-9]{14,}$/),
  customer_id: z.string().nullable().optional(),
  status: z.enum(['created', 'authenticated', 'active', 'pending', 'halted', 'paused', 'resumed', 'cancelled', 'completed', 'expired']),
  current_start: z.number().int().positive().nullable().optional(),
  current_end: z.number().int().positive().nullable().optional(),
  expire_by: z.number().int().positive().nullable().optional(),
  notes: z.unknown().optional(),
  has_scheduled_changes: z.boolean().optional(),
  change_scheduled_at: z.union([z.string(), z.number()]).nullable().optional(),
}).loose();

export type RazorpaySubscription = z.infer<typeof subscriptionSchema>;

export class RazorpayApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly outcomeUncertain: boolean,
  ) {
    super('The payment provider is temporarily unavailable.');
    this.name = 'RazorpayApiError';
  }
}

export async function createRazorpaySubscription(args: {
  config: RazorpayBillingConfig;
  providerPlanId: string;
  attemptId: string;
  role: AccountType;
  plan: PaidPlanTier;
}) {
  const expireBy = Math.floor(Date.now() / 1000) + 30 * 60;
  return callRazorpay(args.config, 'POST', '/v1/subscriptions', {
    plan_id: args.providerPlanId,
    total_count: args.config.totalCount,
    quantity: 1,
    customer_notify: true,
    expire_by: expireBy,
    notes: {
      collab_checkout_attempt_id: args.attemptId,
      collab_account_role: args.role,
      collab_plan: args.plan,
    },
  });
}

export function fetchRazorpaySubscription(config: RazorpayBillingConfig, subscriptionId: string) {
  assertSubscriptionId(subscriptionId);
  return callRazorpay(config, 'GET', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export function cancelRazorpaySubscription(config: RazorpayBillingConfig, subscriptionId: string) {
  assertSubscriptionId(subscriptionId);
  return callRazorpay(config, 'POST', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    cancel_at_cycle_end: true,
  });
}

export async function validateRazorpayPlan(config: RazorpayBillingConfig, planId: string, monthlyPriceInr: number) {
  const response = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(10_000), cache: 'no-store',
  });
  if (!response.ok) throw new RazorpayApiError('RAZORPAY_PLAN_UNAVAILABLE', 503, false);
  const parsed = z.object({ id: z.literal(planId), period: z.literal('monthly'), interval: z.literal(1),
    item: z.object({ currency: z.literal('INR'), amount: z.literal(monthlyPriceInr * 100) }),
  }).safeParse(await response.json());
  if (!parsed.success) throw new RazorpayApiError('RAZORPAY_PLAN_PRICE_MISMATCH', 503, false);
}

export function verifyRazorpayWebhookSignature(rawBody: string, receivedSignature: string, secrets: readonly string[]) {
  if (!/^[0-9a-f]{64}$/i.test(receivedSignature) || secrets.length === 0) return false;
  const received = Buffer.from(receivedSignature, 'hex');
  return secrets.some((secret) => {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export function verifyRazorpayCheckoutSignature(args: {
  paymentId: string;
  storedSubscriptionId: string;
  receivedSignature: string;
  keySecret: string;
}) {
  if (!/^pay_[A-Za-z0-9]{14,}$/.test(args.paymentId)
      || !/^sub_[A-Za-z0-9]{14,}$/.test(args.storedSubscriptionId)
      || !/^[0-9a-f]{64}$/i.test(args.receivedSignature)) return false;
  const expected = createHmac('sha256', args.keySecret)
    .update(`${args.paymentId}|${args.storedSubscriptionId}`, 'utf8').digest();
  const received = Buffer.from(args.receivedSignature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function callRazorpay(config: RazorpayBillingConfig, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`, 'utf8').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    throw new RazorpayApiError('RAZORPAY_NETWORK_ERROR', 503, method === 'POST');
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    throw new RazorpayApiError(`RAZORPAY_HTTP_${response.status}`, response.status, response.status >= 500 && method === 'POST');
  }
  const parsed = subscriptionSchema.safeParse(payload);
  if (!parsed.success) throw new RazorpayApiError('RAZORPAY_INVALID_RESPONSE', 502, method === 'POST');
  return parsed.data;
}

function assertSubscriptionId(subscriptionId: string) {
  if (!/^sub_[A-Za-z0-9]{14,}$/.test(subscriptionId)) {
    throw new RazorpayApiError('RAZORPAY_INVALID_SUBSCRIPTION_ID', 400, false);
  }
}
