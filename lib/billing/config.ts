import type { AccountType, PlanTier } from '@/types/domain';

export type PaidPlanTier = Exclude<PlanTier, 'FREE'>;

export class BillingConfigurationError extends Error {
  constructor(public readonly code: string) {
    super('Billing is not configured.');
    this.name = 'BillingConfigurationError';
  }
}

export interface RazorpayBillingConfig {
  keyId: string;
  keySecret: string;
  totalCount: number;
}

const planEnvironmentKeys: Record<AccountType, Record<PaidPlanTier, string>> = {
  creator: {
    PRO: 'RAZORPAY_CREATOR_PRO_PLAN_ID',
    PREMIUM: 'RAZORPAY_CREATOR_PREMIUM_PLAN_ID',
  },
  brand: {
    PRO: 'RAZORPAY_BRAND_PRO_PLAN_ID',
    PREMIUM: 'RAZORPAY_BRAND_PREMIUM_PLAN_ID',
  },
};

export function getRazorpayBillingConfig(): RazorpayBillingConfig {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const parsedCount = Number(process.env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT);
  if (!keyId || keyId.length < 8 || !keySecret || keySecret.length < 8) {
    throw new BillingConfigurationError('RAZORPAY_CREDENTIALS_MISSING');
  }
  if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 1200) {
    throw new BillingConfigurationError('RAZORPAY_TOTAL_COUNT_MISSING');
  }
  return { keyId, keySecret, totalCount: parsedCount };
}

export function getRazorpayPlanId(role: AccountType, plan: PaidPlanTier) {
  const key = planEnvironmentKeys[role][plan];
  const planId = process.env[key]?.trim();
  if (!planId || !/^plan_[A-Za-z0-9]{14,}$/.test(planId)) {
    throw new BillingConfigurationError(`RAZORPAY_${role.toUpperCase()}_${plan}_PLAN_MISSING`);
  }
  return planId;
}

export function getRazorpayWebhookSecrets() {
  const current = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const previous = process.env.RAZORPAY_PREVIOUS_WEBHOOK_SECRET?.trim();
  if (!current || current.length < 8) throw new BillingConfigurationError('RAZORPAY_WEBHOOK_SECRET_MISSING');
  return previous && previous.length >= 8 ? [current, previous] : [current];
}

export function getExpectedRazorpayAccountId() {
  return process.env.RAZORPAY_ACCOUNT_ID?.trim() || null;
}

export function isRazorpayCheckoutConfigured(role: AccountType, plan: PaidPlanTier) {
  try {
    getRazorpayBillingConfig();
    getRazorpayPlanId(role, plan);
    getRazorpayWebhookSecrets();
    return true;
  } catch {
    return false;
  }
}
