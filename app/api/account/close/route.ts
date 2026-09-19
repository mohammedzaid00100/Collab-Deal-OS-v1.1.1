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

  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  const confirmation = body?.confirmation?.trim() ?? '';
  if (confirmation !== 'DELETE MY ACCOUNT') {
    return NextResponse.json({ ok: false, message: 'Type DELETE MY ACCOUNT exactly to confirm deletion.' }, { status: 400 });
  }

  const { data: deletion, error: deletionError } = await supabase.rpc('delete_current_account', {
    confirmation_text: confirmation,
  });

  if (deletionError || !deletion || typeof deletion !== 'object') {
    return NextResponse.json({ ok: false, message: 'Account deletion is temporarily unavailable.' }, { status: 503 });
  }

  const result = deletion as {
    deleted?: boolean;
    reason?: string;
  };

  if (result.deleted !== true) {
    if (result.reason === 'INVALID_CONFIRMATION') {
      return NextResponse.json({ ok: false, message: 'Confirmation text did not match DELETE MY ACCOUNT.' }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: 'Could not delete account. Please try again.' }, { status: 500 });
  }

  const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    return NextResponse.json({ ok: false, message: 'Account data was removed, but authentication cleanup needs attention. Please contact support.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

