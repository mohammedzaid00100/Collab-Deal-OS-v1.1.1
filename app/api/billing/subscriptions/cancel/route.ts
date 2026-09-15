import { billingAccount, billingError, billingJson, checkBillingRpc, readLimitedBody } from '@/lib/billing/http';
import { getRazorpayBillingConfig } from '@/lib/billing/config';
import { cancelRazorpaySubscription, RazorpayApiError } from '@/lib/billing/razorpay';
import { cancelSubscriptionRequestSchema } from '@/lib/validation/billing';
import { sha256Json } from '@/lib/security/hash';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { admin, userId } = await billingAccount(request);
    const { requestId } = cancelSubscriptionRequestSchema.parse(JSON.parse(await readLimitedBody(request)));
    const config = getRazorpayBillingConfig();
    const { data, error } = await admin.rpc('reserve_subscription_cancellation', {
      requester_user_id: userId, request_command_id: requestId,
      cancellation_request_hash: await sha256Json({ userId, atPeriodEnd: true }),
    });
    checkBillingRpc(error);
    const reservation = Array.isArray(data) ? data[0] : data;
    if (!reservation?.reservation_created) return billingJson({ status: reservation?.cancellation_status ?? 'PENDING' }, 202);
    let submitted = false;
    try {
      await cancelRazorpaySubscription(config, reservation.provider_subscription_id);
      submitted = true;
      const { error: saveError } = await admin.rpc('complete_subscription_cancellation', {
        target_cancellation_id: reservation.cancellation_id,
      });
      checkBillingRpc(saveError);
    } catch (error) {
      const { error: failureError } = await admin.rpc('mark_subscription_cancellation_failure', {
        target_cancellation_id: reservation.cancellation_id,
        failure_code: error instanceof RazorpayApiError ? error.code : 'CANCELLATION_PERSIST_FAILED',
        outcome_uncertain: submitted || !(error instanceof RazorpayApiError) || error.outcomeUncertain,
      });
      if (failureError) console.error('Cancellation reconciliation required', { cancellationId: reservation.cancellation_id });
      throw error;
    }
    return billingJson({ status: 'SUBMITTED', message: 'Cancellation is scheduled for the end of your billing period.' });
  } catch (error) { return billingError(error); }
}
