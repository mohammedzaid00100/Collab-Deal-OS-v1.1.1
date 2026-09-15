import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { buildNotificationEmail } from './email';

const jobSchema = z.object({ id: z.string().uuid(), user_id: z.string().uuid(), channel: z.enum(['EMAIL', 'ANALYTICS']),
  event_name: z.string(), payload: z.record(z.string(), z.unknown()), lease_token: z.string().uuid(), created_at: z.string() });
type Job = z.infer<typeof jobSchema>;

export async function deliverQueuedEvents(admin: SupabaseClient) {
  const channels: ('EMAIL' | 'ANALYTICS')[] = [];
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.NEXT_PUBLIC_SITE_URL) channels.push('EMAIL');
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) channels.push('ANALYTICS');
  const results: { channel: string; attempted: number }[] = [];
  for (const channel of channels) {
    const { data, error } = await admin.rpc('claim_delivery_jobs', { delivery_channel: channel, batch_limit: 3 });
    if (error) throw new Error('DELIVERY_CLAIM_FAILED');
    const jobs = z.array(jobSchema).parse(data);
    await Promise.all(jobs.map((job) => deliverOne(admin, job)));
    results.push({ channel, attempted: jobs.length });
  }
  return results;
}

async function deliverOne(admin: SupabaseClient, job: Job) {
  let resultStatus = 'PENDING';
  let code: string | null = null;
  let providerId: string | null = null;
  try {
    const { data: preferences, error: preferencesError } = await admin.from('account_preferences')
      .select('email_notifications,product_analytics').eq('user_id', job.user_id).single();
    if (preferencesError) throw new Error('PREFERENCES_UNAVAILABLE');
    const allowed = job.channel === 'EMAIL' ? preferences.email_notifications : preferences.product_analytics;
    if (!allowed) { resultStatus = 'SKIPPED'; code = 'USER_PREFERENCE'; }
    else {
      const response = job.channel === 'EMAIL' ? await sendEmail(admin, job) : await sendAnalytics(job);
      if (response.ok) {
        const body = z.object({ id: z.string().optional() }).passthrough().safeParse(await response.json().catch(() => null));
        providerId = body.success ? body.data.id ?? null : null;
        resultStatus = 'SENT';
      } else {
        code = `${job.channel}_HTTP_${response.status}`;
        resultStatus = response.status === 429 || response.status >= 500 || response.status === 409 ? 'PENDING' : 'FAILED';
      }
    }
  } catch { code = 'DELIVERY_UNAVAILABLE'; }
  const { error } = await admin.rpc('finish_delivery_job', { job_id: job.id, job_token: job.lease_token,
    result_status: resultStatus, result_code: code, result_provider_id: providerId });
  if (error) console.error('Delivery acknowledgment failed', { jobId: job.id });
}

async function sendEmail(admin: SupabaseClient, job: Job) {
  const { data: user, error } = await admin.from('users').select('email').eq('id', job.user_id).single();
  if (error || !user?.email) throw new Error('RECIPIENT_UNAVAILABLE');
  const email = buildNotificationEmail(job.payload, process.env.NEXT_PUBLIC_SITE_URL!);
  const { data: frozenRequest, error: snapshotError } = await admin.rpc('prepare_email_delivery', {
    job_id: job.id, job_token: job.lease_token,
    request_body: { from: process.env.RESEND_FROM_EMAIL, to: [user.email], ...email },
  });
  if (snapshotError || !frozenRequest) throw new Error('EMAIL_SNAPSHOT_UNAVAILABLE');
  return fetch('https://api.resend.com/emails', { method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `collab/${job.id}` },
    body: JSON.stringify(frozenRequest),
    signal: AbortSignal.timeout(8000),
  });
}

async function sendAnalytics(job: Job) {
  const configuredHost = new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST!);
  if (configuredHost.protocol !== 'https:') throw new Error('INVALID_ANALYTICS_HOST');
  const properties = { distinct_id: job.user_id, account_type: job.payload.account_type,
    entity_type: job.payload.entity_type, $process_person_profile: false };
  return fetch(new URL('/i/v0/e/', configuredHost.origin), { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.NEXT_PUBLIC_POSTHOG_KEY, event: job.event_name,
      uuid: job.id, timestamp: job.created_at, properties }),
    signal: AbortSignal.timeout(8000),
  });
}
