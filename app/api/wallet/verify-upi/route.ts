import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UPI_PATTERN = /^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/;
const RAZORPAY_API = 'https://api.razorpay.com/v1';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ ok: false, code: 'service_unavailable', message: 'Supabase is not configured.' }, { status: 503 });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Sign in before verifying a UPI ID.' }, { status: 401 });

    const body = await request.json().catch(() => null) as { upiId?: string } | null;
    const upiId = body?.upiId?.trim().toLowerCase() ?? '';
    if (!UPI_PATTERN.test(upiId)) return NextResponse.json({ ok: false, code: 'invalid_format', message: 'Enter a valid UPI ID such as name@bank.' }, { status: 400 });

    if (process.env.RAZORPAYX_LIVE_VPA_VALIDATION !== 'true') {
      return NextResponse.json({
        ok: false,
        code: 'provider_not_configured',
        message: 'Live UPI verification is not enabled yet. Connect the verified payout provider before using this step.',
      }, { status: 503 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const sourceAccountNumber = process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER;
    if (!keyId || !keySecret || !sourceAccountNumber) {
      return NextResponse.json({
        ok: false,
        code: 'provider_not_configured',
        message: 'RazorpayX VPA validation credentials are incomplete.',
      }, { status: 503 });
    }

    const { data: account } = await supabase.from('users').select('account_type').eq('id', user.id).maybeSingle();
    const role = account?.account_type === 'brand' ? 'brand' : 'creator';
    const profileResult = role === 'brand'
      ? await supabase.from('brand_profiles').select('brand_name').eq('user_id', user.id).maybeSingle()
      : await supabase.from('creator_profiles').select('full_name').eq('user_id', user.id).maybeSingle();
    const profile = profileResult.data as { brand_name?: string; full_name?: string } | null;
    const displayName = (profile?.brand_name ?? profile?.full_name ?? user.user_metadata?.full_name ?? 'Collab Deal OS User').slice(0, 50);

    const authorization = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
    const referenceId = `cdo_${Date.now().toString(36)}_${user.id.replaceAll('-', '').slice(0, 8)}`.slice(0, 40);

    const validationResponse = await fetch(`${RAZORPAY_API}/fund_accounts/validations`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_account_number: sourceAccountNumber,
        reference_id: referenceId,
        notes: { product: 'Collab Deal OS', purpose: 'withdrawal_vpa_verification' },
        fund_account: {
          account_type: 'vpa',
          vpa: { address: upiId },
          contact: {
            name: displayName,
            email: user.email ?? undefined,
            type: role === 'brand' ? 'vendor' : 'customer',
            reference_id: `cdo_${user.id.replaceAll('-', '').slice(0, 20)}`,
          },
        },
      }),
      cache: 'no-store',
    });

    const initial = await validationResponse.json().catch(() => ({})) as RazorpayValidationResponse;
    if (!validationResponse.ok) {
      return NextResponse.json({
        ok: false,
        code: 'provider_error',
        message: initial.error?.description ?? 'The payment provider could not verify this UPI ID.',
      }, { status: 502 });
    }

    let validation = initial;
    if (validation.status === 'created' && validation.id) {
      validation = await waitForValidation(validation.id, authorization);
    }

    const accountStatus = validation.validation_results?.account_status ?? validation.results?.account_status ?? null;
    const registeredName = validation.validation_results?.registered_name ?? validation.results?.registered_name ?? null;
    const completed = validation.status === 'completed';
    const valid = completed && ['active', 'valid'].includes(String(accountStatus).toLowerCase());

    if (!valid) {
      return NextResponse.json({
        ok: false,
        code: validation.status === 'created' ? 'verification_pending' : 'verification_failed',
        message: validation.status === 'created'
          ? 'UPI verification is still processing. Please try again in a moment.'
          : validation.status_details?.description ?? 'This UPI ID could not be verified as an active payout destination.',
        verificationId: validation.id ?? null,
      }, { status: validation.status === 'created' ? 202 : 422 });
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      upiId,
      registeredName,
      verificationId: validation.id ?? null,
      message: registeredName ? `UPI verified for ${registeredName}.` : 'UPI ID verified successfully.',
    });
  } catch {
    return NextResponse.json({ ok: false, code: 'verification_unavailable', message: 'UPI verification is temporarily unavailable.' }, { status: 500 });
  }
}

async function waitForValidation(id: string, authorization: string) {
  let latest: RazorpayValidationResponse = { id, status: 'created' };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const response = await fetch(`${RAZORPAY_API}/fund_accounts/validations/${encodeURIComponent(id)}`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    });
    if (!response.ok) break;
    latest = await response.json().catch(() => latest) as RazorpayValidationResponse;
    if (latest.status !== 'created') break;
  }
  return latest;
}

type RazorpayValidationResponse = {
  id?: string;
  status?: 'created' | 'completed' | 'failed' | string;
  validation_results?: { account_status?: string | null; registered_name?: string | null };
  results?: { account_status?: string | null; registered_name?: string | null };
  status_details?: { description?: string | null };
  error?: { description?: string | null };
};
