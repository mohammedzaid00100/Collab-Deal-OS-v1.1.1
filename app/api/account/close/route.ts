import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, message: 'Account deletion is not configured.' }, { status: 503 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { paymentPassword?: string } | null;
  const paymentPassword = body?.paymentPassword ?? '';
  if (!paymentPassword) {
    return NextResponse.json({ ok: false, message: 'Enter your Collab Deal OS payment password.' }, { status: 400 });
  }

  const { data: verification, error: verificationError } = await supabase.rpc('verify_payment_password', { candidate: paymentPassword });
  if (verificationError || !verification || typeof verification !== 'object') {
    return NextResponse.json({ ok: false, message: 'Payment password verification is temporarily unavailable.' }, { status: 503 });
  }

  const result = verification as { valid?: boolean; reason?: string; remaining_attempts?: number };
  if (result.valid !== true) {
    if (result.reason === 'LOCKED') {
      return NextResponse.json({ ok: false, message: 'Payment password verification is temporarily locked after repeated failed attempts. Try again in about a minute.' }, { status: 423 });
    }
    if (result.reason === 'NOT_CONFIGURED') {
      return NextResponse.json({ ok: false, message: 'Create your Collab Deal OS payment password before deleting the account.' }, { status: 409 });
    }
    const remaining = typeof result.remaining_attempts === 'number' ? ` ${result.remaining_attempts} attempt${result.remaining_attempts === 1 ? '' : 's'} remaining.` : '';
    return NextResponse.json({ ok: false, message: `Incorrect payment password.${remaining}` }, { status: 403 });
  }

  const { data: purged, error: purgeError } = await supabase.rpc('purge_current_account_data');
  if (purgeError || purged !== true) {
    return NextResponse.json({ ok: false, message: 'Could not remove the Collab Deal OS account data.' }, { status: 500 });
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    return NextResponse.json({ ok: false, message: 'Account data was removed, but authentication cleanup needs attention. Please contact support.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
