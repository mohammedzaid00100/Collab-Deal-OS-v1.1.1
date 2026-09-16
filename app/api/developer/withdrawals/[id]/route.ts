import { NextResponse } from 'next/server';
import { canUseDeveloperApi } from '@/lib/developer/access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canUseDeveloperApi())) {
    return NextResponse.json({ ok: false, message: 'Developer access required.' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, message: 'Supabase admin access is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as { action?: 'complete' | 'reject' } | null;
  if (!body?.action || !['complete', 'reject'].includes(body.action)) {
    return NextResponse.json({ ok: false, message: 'Invalid withdrawal action.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update = body.action === 'complete'
    ? { status: 'COMPLETED', completed_at: now, rejected_at: null, operator_note: 'Payout marked completed in Collab Deal OS Developer Tool.' }
    : { status: 'REJECTED', rejected_at: now, completed_at: null, operator_note: 'Withdrawal rejected in Collab Deal OS Developer Tool.' };

  const { data, error } = await admin
    .from('prototype_withdrawal_requests')
    .update(update)
    .eq('id', id)
    .eq('status', 'PENDING')
    .select('id,status,completed_at,rejected_at')
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: 'Could not update withdrawal.' }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: 'Withdrawal is no longer pending.' }, { status: 409 });
  return NextResponse.json({ ok: true, withdrawal: data });
}
