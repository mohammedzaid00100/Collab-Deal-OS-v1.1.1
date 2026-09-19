import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) loadEnvFile(envPath);
const env = process.env;
const has = (...keys) => keys.every((key) => Boolean(env[key]?.trim()));
const migrations = readdirSync(resolve(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'));
const checks = [
  ['Application and Android files', ['app/page.tsx', 'android/app/build.gradle', 'capacitor.config.ts'].every((file) => existsSync(resolve(root, file)))],
  ['Database migrations (' + migrations.length + ')', migrations.length >= 13],
  ['Supabase public configuration', has('NEXT_PUBLIC_SUPABASE_URL') && hasEither('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')],
  ['Supabase privileged server configuration', hasEither('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')],
  ['Trusted application origin', validOrigin(env.NEXT_PUBLIC_SITE_URL, true)],
  ['AI key and explicit model', has('OPENAI_API_KEY', 'OPENAI_MODEL')],
  ['Google OAuth operator confirmation', env.GOOGLE_OAUTH_CONFIGURED === 'true'],
  ['Resend sender configuration', has('RESEND_API_KEY', 'RESEND_FROM_EMAIL') && !env.RESEND_FROM_EMAIL.includes('example.com')],
  ['PostHog configuration', has('NEXT_PUBLIC_POSTHOG_KEY') && validOrigin(env.NEXT_PUBLIC_POSTHOG_HOST)],
  ['Maintenance authentication', (env.MAINTENANCE_JOB_SECRET?.length ?? 0) >= 32],
  ['Android production origin', validOrigin(env.CAPACITOR_SERVER_URL)],
];
console.log('\nCOLLAB DEAL OS SETUP\n');
for (const [label, ready] of checks) console.log('[' + (ready ? 'configured' : 'missing') + '] ' + label);
console.log('\nThese are configuration checks, not proof that providers are connected. No secret values are printed.');
console.log('Paid monthly AI allowances must be approved and configured in plan_entitlements; checkout remains disabled while they are NULL.');
if (process.argv.includes('--check-database') && has('NEXT_PUBLIC_SUPABASE_URL') && hasEither('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
  try {
    const [health, entitlements, queue] = await Promise.all([
      client.rpc('health_check'), client.from('plan_entitlements').select('*').neq('plan', 'FREE'),
      client.from('delivery_outbox').select('id', { head: true, count: 'exact' }).eq('status', 'FAILED'),
    ]);
    if (health.error || entitlements.error || queue.error) throw new Error('Database check failed');
    console.log('[connected] Database health and current integration tables');
    console.log('[' + (entitlements.data.length === 2 && entitlements.data.every((row) => row.ai_enabled && row.ai_evaluations_per_period > 0) ? 'configured' : 'missing') + '] Pro and Premium AI allowances (shared across roles)');
    console.log('[attention] Failed delivery jobs: ' + (queue.count ?? 0));
  } catch { console.log('[error] Database check failed; verify credentials, reachability, and migrations.'); process.exitCode = 1; }
}
console.log('\nRun npm run typecheck, npm run lint, npm test, npm run test:db, and npm run build.');
console.log('See docs/DEPLOYMENT.md and docs/ANDROID.md for external activation and packaging.\n');
if (!checks.slice(0, 5).every(([, ready]) => ready)) process.exitCode = 1;

function validOrigin(value, local = false) {
  try {
    const parsed = new URL(value);
    return !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash
      && (parsed.protocol === 'https:' || (local && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)));
  } catch { return false; }
}

function hasEither(...keys) {
  return keys.some((key) => Boolean(env[key]?.trim()));
}
