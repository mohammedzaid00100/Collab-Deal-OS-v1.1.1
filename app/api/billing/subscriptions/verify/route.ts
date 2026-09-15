import { billingAccount, billingError, billingJson, BillingHttpError, readLimitedBody } from '@/lib/billing/http';
import { getRazorpayBillingConfig } from '@/lib/billing/config';
import { verifyRazorpayCheckoutSignature } from '@/lib/billing/razorpay';
import { verifySubscriptionRequestSchema } from '@/lib/validation/billing';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { admin, userId } = await billingAccount(request);
    const body = verifySubscriptionRequestSchema.parse(JSON.parse(await readLimitedBody(request)));
    const { data, error } = await admin.from('billing_checkout_attempts')
      .select('provider_subscription_id').eq('user_id', userId).eq('command_id', body.requestId).single();
    if (error || !data?.provider_subscription_id) throw new BillingHttpError(404, 'CHECKOUT_NOT_FOUND', 'This checkout could not be found.');
    if (!verifyRazorpayCheckoutSignature({ paymentId: body.razorpayPaymentId,
      storedSubscriptionId: data.provider_subscription_id, receivedSignature: body.razorpaySignature,
      keySecret: getRazorpayBillingConfig().keySecret })) {
      throw new BillingHttpError(400, 'INVALID_SIGNATURE', 'Payment confirmation could not be verified.');
    }
    // Verification is acknowledgment only. Entitlements change in the webhook transaction.
    return billingJson({ status: 'AWAITING_WEBHOOK', message: 'Payment confirmation received. Your subscription is being confirmed.' });
  } catch (error) { return billingError(error); }
}
