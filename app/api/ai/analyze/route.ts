import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDealExplanation, AiProviderError, AI_UNAVAILABLE_MESSAGE } from '@/lib/ai/deal-explanation';
import { AnalysisContextError, resolveAnalysisContext } from '@/lib/analysis/context';
import { calculateDealPricing, PricingInputError } from '@/lib/pricing/engine';
import { resolvePricingBenchmark } from '@/lib/pricing/benchmarks';
import { PricingConfigurationError } from '@/lib/pricing/config';
import { sha256Json } from '@/lib/security/hash';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dealAnalysisInputSchema } from '@/lib/validation/analysis';
import type { AccountType } from '@/types/domain';

export const runtime = 'nodejs';

const requestSchema = z.object({
  requestId: z.string().uuid(),
  input: dealAnalysisInputSchema,
});

interface ReservationRow {
  analysis_id: string;
  analysis_status: 'PENDING' | 'COMPLETED' | 'FAILED';
  reservation_created: boolean;
  evaluations_remaining: number;
  reserved_bucket: 'FREE' | 'PAID';
}

interface AccountRow { account_type: AccountType; onboarding_complete: boolean }

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 256_000) return jsonError('Request is too large.', 'REQUEST_TOO_LARGE', 413);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return unavailable('SUPABASE_NOT_CONFIGURED');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return jsonError('Sign in to analyze a deal.', 'AUTH_REQUIRED', 401);
  const { data: accountData, error: accountError } = await supabase.from('account_state')
    .select('account_type,onboarding_complete').eq('id', authData.user.id).maybeSingle();
  const account = accountData as AccountRow | null;
  if (accountError || !account?.account_type) return jsonError('Account access is temporarily unavailable.', 'ACCOUNT_UNAVAILABLE', 503);
  if (!account.onboarding_complete) return jsonError('Complete onboarding before analyzing a deal.', 'ONBOARDING_REQUIRED', 403);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Enter valid analysis data.', 'INVALID_JSON', 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Review the analysis inputs and try again.', code: 'INVALID_ANALYSIS_INPUT', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return unavailable('SERVICE_ROLE_NOT_CONFIGURED');

  try {
    const input = await resolveAnalysisContext({
      userId: authData.user.id,
      role: account.account_type,
      input: parsed.data.input,
      userClient: supabase,
      adminClient: admin,
    });
    const benchmark = await resolvePricingBenchmark(supabase, input);
    const pricing = calculateDealPricing(input, benchmark);
    const requestHash = await sha256Json({ input, pricing_engine_version: pricing.pricingEngineVersion });

    // Sweep in its own transaction before quota reservation so every path takes
    // analysis-row locks before usage-row locks and cannot deadlock with cleanup.
    const { error: sweepError } = await admin.rpc('expire_stale_deal_analyses', { batch_limit: 20 });
    if (sweepError) console.warn('AI reservation sweep failed', { code: sweepError.code });
    const { data: reservationData, error: reservationError } = await admin.rpc('reserve_deal_analysis', {
      requester_user_id: authData.user.id,
      analysis_request_id: parsed.data.requestId,
      analysis_request_hash: requestHash,
      target_offer_id: input.sourceOfferId ?? null,
      target_offer_version: input.sourceOfferVersion ?? null,
      analysis_input_snapshot: input,
      deterministic_result: pricing,
      selected_benchmark_refs: benchmark.benchmarkRefs,
    });
    if (reservationError) return reservationFailure(reservationError.message);
    const reservation = (Array.isArray(reservationData) ? reservationData[0] : reservationData) as ReservationRow | null;
    if (!reservation?.analysis_id) return unavailable('ANALYSIS_RESERVATION_FAILED');
    const redirectTo = `/${account.account_type}/analysis/${reservation.analysis_id}`;
    if (!reservation.reservation_created) {
      if (reservation.analysis_status === 'FAILED') return unavailable('PREVIOUS_REQUEST_FAILED');
      return NextResponse.json({
        analysisId: reservation.analysis_id,
        status: reservation.analysis_status,
        evaluationsRemaining: Number(reservation.evaluations_remaining),
        redirectTo,
      }, { status: reservation.analysis_status === 'COMPLETED' ? 200 : 202 });
    }

    try {
      const explanation = await createDealExplanation({ input, pricing, perspective: account.account_type, userId: authData.user.id });
      const { error: completionError } = await admin.rpc('complete_deal_analysis', {
        target_analysis_id: reservation.analysis_id,
        provider_model: explanation.model,
        verdict_data: explanation.verdict,
      });
      if (completionError) throw new AiProviderError('ANALYSIS_PERSIST_FAILED');
    } catch (error) {
      const code = error instanceof AiProviderError ? error.code : 'AI_PROVIDER_UNKNOWN';
      await releaseFailedReservation(admin, reservation.analysis_id, code);
      return unavailable(code);
    }
    return NextResponse.json({
      analysisId: reservation.analysis_id,
      status: 'COMPLETED',
      evaluationsRemaining: Number(reservation.evaluations_remaining),
      redirectTo,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AnalysisContextError) return jsonError('The linked offer or creator context is stale or unavailable.', error.code, 409);
    if (error instanceof PricingInputError) return jsonError(error.message, error.code, 422);
    if (error instanceof PricingConfigurationError) return jsonError('Pricing configuration is temporarily unavailable.', error.code, 503);
    if (error instanceof z.ZodError) return jsonError('Review the analysis inputs and try again.', 'INVALID_ANALYSIS_INPUT', 400);
    return unavailable('ANALYSIS_UNEXPECTED_FAILURE');
  }
}

async function releaseFailedReservation(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, analysisId: string, code: string) {
  let lastErrorCode: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { error } = await admin.rpc('fail_deal_analysis', { target_analysis_id: analysisId, failure_code: code });
      if (!error) return;
      lastErrorCode = error.code;
    } catch {
      lastErrorCode = 'RPC_THROWN_ERROR';
    }
  }
  // A scheduled/opportunistic sweep remains the database-enforced fallback.
  console.error('AI usage release failed after retry', { analysisId, code, errorCode: lastErrorCode });
}

function reservationFailure(message: string) {
  if (message.includes('rate limit')) return jsonError('Too many AI evaluations were requested. Try again later.', 'AI_RATE_LIMITED', 429);
  if (message.includes('Free AI evaluation limit reached')) return jsonError('Your 5 free AI evaluations are used. Upgrade to run another analysis.', 'AI_USAGE_EXHAUSTED', 402);
  if (message.includes('AI evaluation limit reached')) return jsonError('Your current AI evaluation allowance is used.', 'AI_USAGE_EXHAUSTED', 402);
  if (message.includes('Paid AI evaluation limit is not configured')) return jsonError('Paid AI access is awaiting plan configuration.', 'PAID_LIMIT_NOT_CONFIGURED', 503);
  if (message.includes('subscription period is invalid')) return jsonError('Your subscription needs to be synchronized before another analysis.', 'SUBSCRIPTION_INVALID', 409);
  if (message.includes('different data')) return jsonError('This request identifier was already used. Start a new evaluation.', 'IDEMPOTENCY_CONFLICT', 409);
  if (message.includes('stale') || message.includes('not authorized')) return jsonError('The linked offer changed or is unavailable.', 'OFFER_STALE_OR_UNAVAILABLE', 409);
  return jsonError('AI usage could not be reserved.', 'USAGE_RESERVATION_FAILED', 503);
}

function unavailable(code: string) {
  return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE, code }, { status: 503 });
}

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}
