import { billingError, billingJson, BillingHttpError, readLimitedBody } from '@/lib/billing/http';
import { getExpectedRazorpayAccountId, getRazorpayBillingConfig, getRazorpayWebhookSecrets } from '@/lib/billing/config';
import { fetchRazorpaySubscription, verifyRazorpayWebhookSignature } from '@/lib/billing/razorpay';
import { getCheckoutAttemptId, parseRazorpayWebhookEnvelope, subscriptionPeriodSnapshot } from '@/lib/billing/webhook';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sha256Text } from '@/lib/security/hash';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let recordedEventId: string | null = null;
  const admin = createSupabaseAdminClient();
  try {
    const rawBody = await readLimitedBody(request, 256_000);
    if (!verifyRazorpayWebhookSignature(rawBody, request.headers.get('x-razorpay-signature') ?? '', getRazorpayWebhookSecrets())) {
      throw new BillingHttpError(400, 'INVALID_SIGNATURE', 'Invalid webhook signature.');
    }
    const eventId = request.headers.get('x-razorpay-event-id');
    if (!eventId || eventId.length > 200) throw new BillingHttpError(400, 'EVENT_ID_REQUIRED', 'A valid event ID is required.');
    const event = parseRazorpayWebhookEnvelope(JSON.parse(rawBody));
    const expectedAccount = getExpectedRazorpayAccountId();
    if (expectedAccount && event.accountId !== expectedAccount) throw new BillingHttpError(400, 'ACCOUNT_MISMATCH', 'Unexpected merchant account.');
    if (!admin) throw new BillingHttpError(503, 'DATABASE_UNAVAILABLE', 'Webhook storage is unavailable.');
    const { data: claimed, error } = await admin.rpc('record_razorpay_webhook_event', {
      target_event_id: eventId, target_event_type: event.eventType, target_payload_hash: await sha256Text(rawBody),
      target_subscription_id: event.subscriptionId, target_event_created_at: event.eventCreatedAt,
    });
    if (error) throw new BillingHttpError(503, 'EVENT_STORAGE_FAILED', 'Could not store event.');
    if (!claimed) return billingJson({ received: true, duplicate: true });
    recordedEventId = eventId;
    if (!event.subscriptionId || !(event.eventType.startsWith('subscription.') || event.eventType === 'payment.failed')) {
      const { error: ignoreError } = await admin.rpc('ignore_razorpay_webhook_event', { target_event_id: eventId, ignore_code: 'UNRELATED_EVENT' });
      if (ignoreError) throw new Error('Event ignore failed');
      return billingJson({ received: true, ignored: true });
    }
    // Fetch the current provider state: webhook payloads are historical and can arrive out of order.
    const subscription = await fetchRazorpaySubscription(getRazorpayBillingConfig(), event.subscriptionId);
    if (subscription.id !== event.subscriptionId) throw new Error('Subscription mismatch');
    const period = subscriptionPeriodSnapshot(subscription);
    const { error: applyError } = await admin.rpc('apply_razorpay_subscription_snapshot', {
      target_event_id: eventId, target_event_type: event.eventType, target_subscription_id: subscription.id,
      target_checkout_attempt_id: getCheckoutAttemptId(subscription), target_provider_plan_id: subscription.plan_id,
      target_provider_status: subscription.status, target_customer_id: subscription.customer_id ?? null,
      target_period_start: period.periodStart, target_period_end: period.periodEnd,
      target_cancel_at_period_end: period.cancelAtPeriodEnd, target_event_created_at: event.eventCreatedAt,
    });
    if (applyError) throw new Error('Subscription event could not be applied');
    return billingJson({ received: true });
  } catch (error) {
    if (recordedEventId && admin) {
      await admin.rpc('fail_razorpay_webhook_event', { target_event_id: recordedEventId, failure_code: 'WEBHOOK_PROCESSING_FAILED' });
    }
    return billingError(error);
  }
}
