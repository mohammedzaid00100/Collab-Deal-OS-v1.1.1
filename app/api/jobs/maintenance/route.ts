import { timingSafeEqual } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { billingJson } from '@/lib/billing/http';
import { deliverQueuedEvents } from '@/lib/delivery/worker';
import { reconcileSubscriptions } from '@/lib/billing/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.MAINTENANCE_JOB_SECRET?.trim();
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret ?? '');
  if (!secret || secret.length < 32 || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return billingJson({ error: 'Unauthorized' }, 401);
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return billingJson({ error: 'Maintenance unavailable' }, 503);
  try {
    const { data: expired, error } = await admin.rpc('expire_stale_deal_analyses', { batch_limit: 100 });
    if (error) throw new Error('ANALYSIS_SWEEP_FAILED');
    const [deliveries, billing] = await Promise.all([deliverQueuedEvents(admin), reconcileSubscriptions(admin)]);
    return billingJson({ expiredAnalyses: expired, deliveries, billing }, billing.failed ? 503 : 200);
  } catch { return billingJson({ error: 'Maintenance needs retry' }, 503); }
}
