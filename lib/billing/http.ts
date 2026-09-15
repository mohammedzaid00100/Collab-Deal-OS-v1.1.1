import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isTrustedMutationRequest } from '@/lib/security/request';
import type { AccountType } from '@/types/domain';
import { BillingConfigurationError } from './config';
import { RazorpayApiError } from './razorpay';

export class BillingHttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export async function billingAccount(request: Request) {
  if (!isTrustedMutationRequest(request)) throw new BillingHttpError(403, 'ORIGIN_REJECTED', 'Refresh this page and try again.');
  const client = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!client || !admin) throw new BillingHttpError(503, 'BILLING_UNAVAILABLE', 'Billing is currently unavailable.');
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new BillingHttpError(401, 'AUTH_REQUIRED', 'Sign in to manage your subscription.');
  const { data: account, error: accountError } = await client.from('account_state')
    .select('account_type,onboarding_complete').eq('id', user.id).single();
  if (accountError || !account?.onboarding_complete || !['creator', 'brand'].includes(account.account_type)) {
    throw new BillingHttpError(403, 'ONBOARDING_REQUIRED', 'Complete your profile before subscribing.');
  }
  return { client, admin, userId: user.id, role: account.account_type as AccountType };
}

export async function readLimitedBody(request: Request, limit = 16_384) {
  if (Number(request.headers.get('content-length')) > limit) throw new BillingHttpError(413, 'BODY_TOO_LARGE', 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new BillingHttpError(400, 'EMPTY_BODY', 'Request data is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new BillingHttpError(413, 'BODY_TOO_LARGE', 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function checkBillingRpc(error: { message: string } | null) {
  if (!error) return;
  const message = error.message;
  if (/different data/.test(message)) throw new BillingHttpError(409, 'REQUEST_CONFLICT', 'This request was already used for different data.');
  if (/already|pending|active subscription/.test(message)) throw new BillingHttpError(409, 'BILLING_PENDING', 'An existing subscription or checkout needs to be resolved first.');
  if (/rate limit/.test(message)) throw new BillingHttpError(429, 'BILLING_RATE_LIMIT', 'Please wait before trying again.');
  if (/not configured/.test(message)) throw new BillingHttpError(503, 'ENTITLEMENTS_UNCONFIGURED', 'Paid plans are not available yet.');
  throw new BillingHttpError(503, 'BILLING_DATABASE_ERROR', 'Your billing request could not be saved. Please try again.');
}

export function billingError(error: unknown) {
  if (error instanceof BillingHttpError) return billingJson({ error: error.message, code: error.code }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return billingJson({ error: 'Review your billing request.', code: 'INVALID_REQUEST' }, 400);
  if (error instanceof BillingConfigurationError) return billingJson({ error: 'Paid plans are not available yet.', code: error.code }, 503);
  if (error instanceof RazorpayApiError) return billingJson({ error: error.outcomeUncertain
    ? 'Your request is being reconciled. Please do not start another payment.'
    : 'The payment provider is temporarily unavailable.', code: error.code }, 503);
  console.error('Billing request failed', { code: 'UNEXPECTED_BILLING_ERROR' });
  return billingJson({ error: 'Billing is temporarily unavailable.', code: 'BILLING_UNAVAILABLE' }, 503);
}

export function billingJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
