import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountType, PlanTier } from '@/types/domain';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getRazorpayBillingConfig, isRazorpayCheckoutConfigured } from './config';

export interface BillingPageData {
  subscription: { plan: PlanTier; status: string; provider_status: string | null;
    current_period_start: string | null; current_period_end: string | null;
    cancel_at_period_end: boolean; provider_subscription_id: string | null };
  freeRemaining: number;
  paidUsed: number;
  plans: { plan: 'PRO' | 'PREMIUM'; limit: number | null; available: boolean }[];
  totalCount: number | null;
  pending: { requestId: string; plan: 'PRO' | 'PREMIUM'; status: string } | null;
}

export async function getBillingPageData(client: SupabaseClient, userId: string, role: AccountType): Promise<BillingPageData> {
  const admin = createSupabaseAdminClient();
  const [subscription, usage, entitlements, checkout] = await Promise.all([
    client.from('subscriptions').select('plan,status,provider_status,current_period_start,current_period_end,cancel_at_period_end,provider_subscription_id').eq('user_id', userId).single(),
    client.from('usage_limits').select('free_evaluations_total,free_evaluations_used,paid_period_evaluations_used,period_started_at,period_ends_at').eq('user_id', userId).single(),
    client.from('plan_entitlements').select('plan,ai_enabled,ai_evaluations_per_period'),
    admin?.from('billing_checkout_attempts').select('command_id,requested_plan,status').eq('user_id', userId)
      .in('status', ['RESERVED', 'CREATED', 'UNCERTAIN']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (subscription.error || usage.error || entitlements.error || checkout?.error) throw new Error('Billing data is temporarily unavailable.');
  let totalCount: number | null = null;
  try { totalCount = getRazorpayBillingConfig().totalCount; } catch { /* Unconfigured billing is displayed without checkout. */ }
  const paidPeriodMatches = usage.data.period_started_at === subscription.data.current_period_start
    && usage.data.period_ends_at === subscription.data.current_period_end;
  return {
    subscription: subscription.data as BillingPageData['subscription'],
    freeRemaining: Math.max(0, usage.data.free_evaluations_total - usage.data.free_evaluations_used),
    paidUsed: paidPeriodMatches ? usage.data.paid_period_evaluations_used : 0,
    plans: (['PRO', 'PREMIUM'] as const).map((plan) => {
      const entitlement = entitlements.data.find((entry) => entry.plan === plan);
      return { plan, limit: entitlement?.ai_evaluations_per_period ?? null,
        available: Boolean(entitlement?.ai_enabled && entitlement.ai_evaluations_per_period && isRazorpayCheckoutConfigured(role, plan)) };
    }),
    totalCount,
    pending: checkout?.data ? { requestId: checkout.data.command_id,
      plan: checkout.data.requested_plan, status: checkout.data.status } : null,
  };
}
