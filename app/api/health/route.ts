import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isRazorpayCheckoutConfigured } from '@/lib/billing/config';

export const dynamic = 'force-dynamic';

type ConnectionState = 'connected' | 'configured' | 'not_configured' | 'error';

export async function GET() {
  let database: ConnectionState = isSupabaseConfigured() ? 'configured' : 'not_configured';

  if (database === 'configured') {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase!.rpc('health_check');
      database = error ? 'error' : 'connected';
    } catch {
      database = 'error';
    }
  }

  const detailed = process.env.NODE_ENV !== 'production' || process.env.ENABLE_SETUP_STATUS === 'true';
  const services = {
      database,
      ai: hasValue(process.env.OPENAI_API_KEY) && Boolean(process.env.OPENAI_MODEL?.trim()) ? 'configured' : 'not_configured',
      payments: (['creator', 'brand'] as const).every((role) => (['PRO', 'PREMIUM'] as const).every((plan) => isRazorpayCheckoutConfigured(role, plan))) ? 'configured' : 'not_configured',
      paymentWebhook: connectionState(process.env.RAZORPAY_WEBHOOK_SECRET),
      email: hasValue(process.env.RESEND_API_KEY) && Boolean(process.env.RESEND_FROM_EMAIL) ? 'configured' : 'not_configured',
      analytics: connectionState(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    } as const;
  const body = {
    status: database === 'connected' ? 'ready' : database === 'error' ? 'degraded' : 'not_ready',
    services: detailed ? services : { database },
    checkedAt: new Date().toISOString(),
    scope: 'Database health; provider configuration is not live verification or checkout readiness.',
  } as const;

  return NextResponse.json(body, {
    status: database === 'error' ? 503 : 200,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' },
  });
}

function connectionState(value: string | undefined): ConnectionState {
  return hasValue(value) ? 'configured' : 'not_configured';
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.length >= 8);
}
