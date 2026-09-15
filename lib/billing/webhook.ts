import { z } from 'zod';
import type { RazorpaySubscription } from './razorpay';

const webhookEnvelopeSchema = z.object({
  entity: z.literal('event'),
  account_id: z.string().optional(),
  event: z.string().min(1).max(120),
  created_at: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
}).loose();

export interface RazorpayWebhookEnvelope {
  accountId: string | null;
  eventType: string;
  eventCreatedAt: string | null;
  subscriptionId: string | null;
}

export function parseRazorpayWebhookEnvelope(value: unknown): RazorpayWebhookEnvelope {
  const parsed = webhookEnvelopeSchema.parse(value);
  const subscription = entityRecord(parsed.payload.subscription);
  const payment = entityRecord(parsed.payload.payment);
  const subscriptionId = stringValue(subscription?.id) ?? stringValue(payment?.subscription_id);
  return {
    accountId: parsed.account_id ?? null,
    eventType: parsed.event,
    eventCreatedAt: unixSecondsToIso(parsed.created_at),
    subscriptionId: subscriptionId && /^sub_[A-Za-z0-9]{14,}$/.test(subscriptionId) ? subscriptionId : null,
  };
}

export function getCheckoutAttemptId(subscription: RazorpaySubscription) {
  if (!subscription.notes || Array.isArray(subscription.notes) || typeof subscription.notes !== 'object') return null;
  const value = (subscription.notes as Record<string, unknown>).collab_checkout_attempt_id;
  return typeof value === 'string' && z.string().uuid().safeParse(value).success ? value : null;
}

export function subscriptionPeriodSnapshot(subscription: RazorpaySubscription) {
  return {
    periodStart: unixSecondsToIso(subscription.current_start ?? undefined),
    periodEnd: unixSecondsToIso(subscription.current_end ?? undefined),
    checkoutExpiresAt: unixSecondsToIso(subscription.expire_by ?? undefined),
    cancelAtPeriodEnd: subscription.has_scheduled_changes === true
      && subscription.change_scheduled_at === 'cycle_end',
  };
}

function entityRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entity = (value as Record<string, unknown>).entity;
  return entity && typeof entity === 'object' && !Array.isArray(entity)
    ? entity as Record<string, unknown> : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function unixSecondsToIso(value: number | undefined) {
  if (!value || !Number.isInteger(value) || value < 1 || value > 7_258_118_400) return null;
  return new Date(value * 1000).toISOString();
}
