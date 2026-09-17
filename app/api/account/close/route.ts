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

  const { data: deletion, error: deletionError } = await supabase.rpc('delete_current_account_with_password', { candidate: paymentPassword });
  if (deletionError || !deletion || typeof deletion !== 'object') {
    return NextResponse.json({ ok: false, message: 'Account deletion is temporarily unavailable.' }, { status: 503 });
  }

  const result = deletion as {
    deleted?: boolean;
    valid?: boolean;
    reason?: string;
    remaining_attempts?: number;
  };

  if (result.deleted !== true) {
    if (result.reason === 'LOCKED') {
      return NextResponse.json({ ok: false, message: 'Payment password verification is temporarily locked after repeated failed attempts. Try again in about a minute.' }, { status: 423 });
    }
    if (result.reason === 'NOT_CONFIGURED') {
      return NextResponse.json({ ok: false, message: 'Create your Collab Deal OS payment password before deleting the account.' }, { status: 409 });
    }
    const remaining = typeof result.remaining_attempts === 'number' ? ` ${result.remaining_attempts} attempt${result.remaining_attempts === 1 ? '' : 's'} remaining.` : '';
    return NextResponse.json({ ok: false, message: `Incorrect payment password.${remaining}` }, { status: 403 });
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    return NextResponse.json({ ok: false, message: 'Account data was removed, but authentication cleanup needs attention. Please contact support.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
