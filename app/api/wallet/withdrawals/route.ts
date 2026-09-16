import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UPI_PATTERN = /^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/;
const MIN_WITHDRAWAL = 100;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, message: 'Supabase is not configured.' }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const { data, error } = await supabase
    .from('prototype_withdrawal_requests')
    .select('id,amount_inr,upi_id,status,created_at,completed_at,rejected_at')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: 'Withdrawal history is temporarily unavailable.' }, { status: 500 });
  return NextResponse.json({ ok: true, withdrawals: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, message: 'Supabase is not configured.' }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { amount?: number; upiId?: string } | null;
  const amount = Number(body?.amount ?? 0);
  const upiId = body?.upiId?.trim().toLowerCase() ?? '';

  if (!Number.isInteger(amount) || amount < MIN_WITHDRAWAL) {
    return NextResponse.json({ ok: false, message: `Minimum withdrawal is ₹${MIN_WITHDRAWAL}.` }, { status: 400 });
  }
  if (!UPI_PATTERN.test(upiId)) {
    return NextResponse.json({ ok: false, message: 'Enter a valid UPI ID format such as name@bank.' }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', user.id)
    .single();
  if (accountError || !account?.account_type) {
    return NextResponse.json({ ok: false, message: 'Account role is unavailable.' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('prototype_withdrawal_requests')
    .insert({
      user_id: user.id,
      account_type: account.account_type,
      amount_inr: amount,
      upi_id: upiId,
      status: 'PENDING',
    })
    .select('id,amount_inr,upi_id,status,created_at,completed_at,rejected_at')
    .single();

  if (error) return NextResponse.json({ ok: false, message: 'Could not submit the withdrawal request.' }, { status: 500 });
  return NextResponse.json({ ok: true, withdrawal: data }, { status: 201 });
}
