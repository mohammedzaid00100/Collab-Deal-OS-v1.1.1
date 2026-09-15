import type { SupabaseClient } from '@supabase/supabase-js';
import { getRazorpayBillingConfig } from './config';
import { fetchRazorpaySubscription } from './razorpay';
import { getCheckoutAttemptId, subscriptionPeriodSnapshot } from './webhook';
import { sha256Json } from '@/lib/security/hash';

export async function reconcileSubscriptions(admin: SupabaseClient) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return { attempted: 0, failed: 0 };
  const config = getRazorpayBillingConfig();
  const { data, error } = await admin.from('subscriptions').select('provider_subscription_id')
    .eq('provider', 'razorpay').not('provider_subscription_id', 'is', null)
    .not('status', 'in', '(CANCELLED,EXPIRED)')
    .order('last_reconciled_at', { ascending: true, nullsFirst: true }).limit(3);
  if (error) throw new Error('RECONCILIATION_READ_FAILED');
  let failed = 0;
  await Promise.all(data.map(async ({ provider_subscription_id: id }) => {
    const eventId = `reconcile:${crypto.randomUUID()}`;
    try {
      const observedAt = new Date().toISOString();
      const subscription = await fetchRazorpaySubscription(config, id);
      if (subscription.id !== id) throw new Error('PROVIDER_ID_MISMATCH');
      const { error: recordError } = await admin.rpc('record_razorpay_reconciliation', {
        target_event_id: eventId, target_payload_hash: await sha256Json(subscription),
        target_subscription_id: id, observed_at: observedAt,
      });
      if (recordError) throw new Error('RECONCILIATION_RECORD_FAILED');
      const period = subscriptionPeriodSnapshot(subscription);
      const { error: applyError } = await admin.rpc('apply_razorpay_subscription_snapshot', {
        target_event_id: eventId, target_event_type: 'subscription.reconciled', target_subscription_id: id,
        target_checkout_attempt_id: getCheckoutAttemptId(subscription), target_provider_plan_id: subscription.plan_id,
        target_provider_status: subscription.status, target_customer_id: subscription.customer_id ?? null,
        target_period_start: period.periodStart, target_period_end: period.periodEnd,
        target_cancel_at_period_end: period.cancelAtPeriodEnd, target_event_created_at: observedAt,
      });
      if (applyError) throw new Error('RECONCILIATION_APPLY_FAILED');
    } catch {
      failed += 1;
      await admin.rpc('fail_razorpay_webhook_event', { target_event_id: eventId, failure_code: 'RECONCILIATION_FAILED' });
    }
  }));
  return { attempted: data.length, failed };
}
