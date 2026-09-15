import { billingAccount, billingError, billingJson, BillingHttpError, checkBillingRpc, readLimitedBody } from '@/lib/billing/http';
import { getRazorpayBillingConfig, getRazorpayPlanId, getRazorpayWebhookSecrets } from '@/lib/billing/config';
import { createRazorpaySubscription, RazorpayApiError, validateRazorpayPlan } from '@/lib/billing/razorpay';
import { createSubscriptionRequestSchema } from '@/lib/validation/billing';
import { planCatalog } from '@/lib/plans';
import { sha256Json } from '@/lib/security/hash';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { admin, userId, role } = await billingAccount(request);
    const body = createSubscriptionRequestSchema.parse(JSON.parse(await readLimitedBody(request)));
    const config = getRazorpayBillingConfig();
    getRazorpayWebhookSecrets();
    const providerPlanId = getRazorpayPlanId(role, body.plan);
    const { data: entitlement, error: entitlementError } = await admin.from('plan_entitlements')
      .select('ai_enabled,ai_evaluations_per_period').eq('plan', body.plan).single();
    if (entitlementError || !entitlement?.ai_enabled || !entitlement.ai_evaluations_per_period) {
      throw new BillingHttpError(503, 'ENTITLEMENTS_UNCONFIGURED', 'Paid plans are not available yet.');
    }
    await validateRazorpayPlan(config, providerPlanId, planCatalog[body.plan].monthlyPriceInr);
    const requestHash = await sha256Json({ userId, role, plan: body.plan, providerPlanId, totalCount: config.totalCount });
    const { data, error } = await admin.rpc('reserve_billing_checkout', {
      requester_user_id: userId, request_command_id: body.requestId, billing_request_hash: requestHash,
      target_plan: body.plan, target_provider_plan_id: providerPlanId,
    });
    checkBillingRpc(error);
    const reservation = Array.isArray(data) ? data[0] : data;
    if (!reservation) throw new BillingHttpError(503, 'RESERVATION_FAILED', 'Checkout could not be started.');
    let subscriptionId: string = reservation.provider_subscription_id;
    if (reservation.reservation_created) {
      let created = false;
      try {
        const subscription = await createRazorpaySubscription({ config, providerPlanId,
          attemptId: reservation.attempt_id, role, plan: body.plan });
        created = true;
        if (subscription.plan_id !== providerPlanId) throw new RazorpayApiError('PROVIDER_PLAN_MISMATCH', 502, true);
        subscriptionId = subscription.id;
        const { error: saveError } = await admin.rpc('complete_billing_checkout', {
          target_attempt_id: reservation.attempt_id, target_provider_subscription_id: subscription.id,
          provider_checkout_expires_at: subscription.expire_by ? new Date(subscription.expire_by * 1000).toISOString() : null,
        });
        checkBillingRpc(saveError);
      } catch (error) {
        const { error: failureError } = await admin.rpc('mark_billing_checkout_failure', {
          target_attempt_id: reservation.attempt_id,
          failure_code: error instanceof RazorpayApiError ? error.code : 'CHECKOUT_PERSIST_FAILED',
          outcome_uncertain: created || !(error instanceof RazorpayApiError) || error.outcomeUncertain,
        });
        if (failureError) console.error('Checkout reconciliation required', { attemptId: reservation.attempt_id });
        throw error;
      }
    } else if (reservation.attempt_status !== 'CREATED') {
      return billingJson({ status: reservation.attempt_status, message: 'Check your subscription status before starting another payment.' }, 202);
    }
    return billingJson({ subscriptionId, keyId: config.keyId, requestId: body.requestId,
      plan: body.plan, monthlyPriceInr: planCatalog[body.plan].monthlyPriceInr,
      evaluationsPerPeriod: entitlement.ai_evaluations_per_period, totalCount: config.totalCount }, 201);
  } catch (error) { return billingError(error); }
}
