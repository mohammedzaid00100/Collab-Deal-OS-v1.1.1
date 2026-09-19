import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { deliverQueuedEvents } from '@/lib/delivery/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_JOB_SECRET?.trim();
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret ?? '');
  if (!secret || secret.length < 32 || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'Maintenance unavailable' }, { status: 503 });
  try {
    const { data: expired, error } = await admin.rpc('expire_stale_deal_analyses', { batch_limit: 100 });
    if (error) throw new Error('ANALYSIS_SWEEP_FAILED');
    const deliveries = await deliverQueuedEvents(admin);
    return NextResponse.json({ expiredAnalyses: expired, deliveries }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Maintenance needs retry' }, { status: 503 });
  }
}
