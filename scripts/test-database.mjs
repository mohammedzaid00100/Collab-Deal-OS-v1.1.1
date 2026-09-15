import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Executes PostgreSQL migrations locally without provider credentials. Supabase
// platform schemas are minimal fixtures; pgcrypto is replaced only in this test
// with PostgreSQL's built-in SHA-256. Hosted storage/Auth still need live QA.
const db = new PGlite();
const root = resolve(import.meta.dirname, '..');
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select string_to_array(name, '/') $$;
    grant usage on schema auth, public, storage to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(resolve(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    let sql = readFileSync(resolve(root, 'supabase/migrations', file), 'utf8');
    sql = sql.replace(/create extension if not exists pgcrypto with schema extensions;/g, '');
    sql = sql.replace(/create or replace function public\.sha256_text\(input_value text\)[\s\S]*?\$\$;/g,
      () => `create or replace function public.sha256_text(input_value text) returns text language sql immutable strict as $$ select encode(sha256(convert_to(input_value, 'UTF8')), 'hex') $$;`);
    try { await db.exec(sql); console.log(`PASS migration ${file}`); }
    catch (error) { console.error(`FAIL migration ${file}: ${error.message}\n${error.where ?? ''}`); throw error; }
  }
  const user = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'creator@example.test','{"account_type":"creator"}'),($2,'other@example.test','{"account_type":"brand"}')`, [user, other]);
  await db.query(`insert into public.creator_profiles(user_id,full_name,username,bio,niche,location,primary_audience_region,primary_content_format,onboarding_complete)
    values($1,'Test Creator','test_creator','A complete creator profile for database testing.','Beauty','Mumbai','India','Reels',true)`, [user]);
  await db.exec(`update public.plan_entitlements set ai_evaluations_per_period = 25 where plan = 'PRO'`);
  const command = '10000000-0000-4000-8000-000000000001';
  const hash = 'a'.repeat(64);
  const plan = 'plan_12345678901234'; const sub = 'sub_12345678901234';
  const reserve = () => db.query(`select * from public.reserve_billing_checkout($1,$2,$3,'PRO',$4)`, [user, command, hash, plan]);
  const attempt = (await reserve()).rows[0];
  assert.equal(attempt.reservation_created, true);
  assert.equal((await reserve()).rows[0].reservation_created, false);
  await db.query(`select public.complete_billing_checkout($1,$2,now()+interval '30 minutes')`, [attempt.attempt_id, sub]);
  assert.equal((await db.query(`select plan from public.account_state where id=$1`, [user])).rows[0].plan, 'FREE');
  await db.query(`select public.record_razorpay_webhook_event('evt_activate','subscription.activated',$1,$2,now())`, [hash, sub]);
  await db.query(`select public.apply_razorpay_subscription_snapshot('evt_activate','subscription.activated',$1,$2,$3,'active',null,now()-interval '1 day',now()+interval '29 days',false,now())`, [sub, attempt.attempt_id, plan]);
  assert.equal((await db.query(`select plan from public.account_state where id=$1`, [user])).rows[0].plan, 'PRO');
  assert.equal((await db.query(`select public.record_razorpay_webhook_event('evt_activate','subscription.activated',$1,$2,now()) as claimed`, [hash, sub])).rows[0].claimed, false);
  const notifications = (await db.query(`select count(*)::integer as n from public.notifications where user_id=$1`, [user])).rows[0].n;
  assert.equal(notifications, 1);
  await db.query(`select public.record_razorpay_webhook_event('evt_old','subscription.authenticated',$1,$2,now()-interval '1 day')`, [hash, sub]);
  await db.query(`select public.apply_razorpay_subscription_snapshot('evt_old','subscription.authenticated',$1,$2,$3,'authenticated',null,null,null,false,now()-interval '1 day')`, [sub, attempt.attempt_id, plan]);
  assert.equal((await db.query(`select plan from public.account_state where id=$1`, [user])).rows[0].plan, 'PRO');
  await db.query(`select public.record_razorpay_webhook_event('evt_cancel','subscription.cancelled',$1,$2,now()+interval '1 second')`, [hash, sub]);
  await db.query(`select public.record_razorpay_reconciliation('reconcile:test',$1,$2,now())`, [hash, sub]);
  await db.query(`select public.apply_razorpay_subscription_snapshot('reconcile:test','subscription.reconciled',$1,$2,$3,'active',null,now()-interval '1 day',now()+interval '29 days',false,now())`, [sub, attempt.attempt_id, plan]);
  const reconciliation = (await db.query(`select signature_verified,api_verified,processing_status from public.payment_webhook_events where provider_event_id='reconcile:test'`)).rows[0];
  assert.deepEqual(reconciliation, { signature_verified: false, api_verified: true, processing_status: 'PROCESSED' });
  console.log('PASS authenticated provider reconciliation with separate audit provenance');
  await db.query(`select public.apply_razorpay_subscription_snapshot('evt_cancel','subscription.cancelled',$1,$2,$3,'cancelled',null,now()-interval '1 day',now()+interval '29 days',false,now()+interval '1 second')`, [sub, attempt.attempt_id, plan]);
  assert.equal((await db.query(`select plan from public.account_state where id=$1`, [user])).rows[0].plan, 'FREE');
  console.log('PASS billing reserve, replay, pending/free, activation, stale-event rejection, cancellation');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
  await db.exec(`set role authenticated`);
  assert.equal((await db.query(`select count(*)::integer as n from public.subscriptions`)).rows[0].n, 1);
  await assert.rejects(db.query(`select public.reserve_billing_checkout($1,$2,$3,'PRO',$4)`, [other, command, hash, plan]), /permission denied/);
  await assert.rejects(db.exec(`update public.subscriptions set plan='PREMIUM'`), /permission denied/);
  await db.exec(`reset role`);
  console.log('PASS billing RLS and service-only mutation checks');
  const pricing = { fairLow: 1000, fairMid: 1500, fairHigh: 2000, dealScore: 80, confidenceScore: 70,
    recommendedCounter: 1500, pricingEngineVersion: 'pricing-v1.0.0', benchmarkConfigHash: hash,
    verdict: 'BELOW_FAIR', riskFlags: [] };
  const reserveAnalysis = (requestId) => db.query(`select * from public.reserve_deal_analysis($1,$2,$3,null,null,$4,$5,'{}'::uuid[])`,
    [user, requestId, hash, JSON.stringify({ creator: {} }), JSON.stringify(pricing)]);
  const failedAnalysis = (await reserveAnalysis('20000000-0000-4000-8000-000000000001')).rows[0];
  await db.query(`select public.fail_deal_analysis($1,'TEST_PROVIDER_FAILURE')`, [failedAnalysis.analysis_id]);
  await db.query(`select public.fail_deal_analysis($1,'TEST_PROVIDER_FAILURE')`, [failedAnalysis.analysis_id]);
  assert.equal((await db.query(`select free_evaluations_used from public.usage_limits where user_id=$1`, [user])).rows[0].free_evaluations_used, 0);
  for (let index = 2; index <= 6; index++) {
    const requestId = `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    const analysis = (await reserveAnalysis(requestId)).rows[0];
    assert.equal((await reserveAnalysis(requestId)).rows[0].reservation_created, false);
    await db.query(`select public.complete_deal_analysis($1,'test-model',$2)`, [analysis.analysis_id, JSON.stringify({
      verdict: 'BELOW_FAIR', summary: 'Test explanation', strengths: ['Clear scope'], risks: [],
      recommended_counter: 1500, reasoning_points: ['Deterministic values retained'], confidence_message: 'Declared metrics',
    })]);
  }
  assert.equal((await db.query(`select free_evaluations_used from public.usage_limits where user_id=$1`, [user])).rows[0].free_evaluations_used, 5);
  await assert.rejects(reserveAnalysis('20000000-0000-4000-8000-000000000007'), /Free AI evaluation limit reached/);
  console.log('PASS five lifetime evaluations, idempotent reservation, provider-failure refund, sixth-use rejection');
  const jobs = (await db.query(`select * from public.claim_delivery_jobs('EMAIL', 3)`)).rows;
  assert.ok(jobs.length > 0);
  const emailRequest = { from: 'test@example.com', to: ['recipient@example.com'], subject: 'Test', text: 'Original' };
  const prepareEmail = (body) => db.query(`select public.prepare_email_delivery($1,$2,$3) as body`, [jobs[0].id, jobs[0].lease_token, JSON.stringify(body)]);
  assert.deepEqual((await prepareEmail(emailRequest)).rows[0].body, emailRequest);
  assert.deepEqual((await prepareEmail({ ...emailRequest, text: 'Changed' })).rows[0].body, emailRequest);
  await db.query(`select public.finish_delivery_job($1,$2,'SENT',null,'email_test')`, [jobs[0].id, jobs[0].lease_token]);
  assert.equal((await db.query(`select status from public.delivery_outbox where id=$1`, [jobs[0].id])).rows[0].status, 'SENT');
  await db.query(`select public.finish_delivery_job($1,$2,'PENDING',null,null)`, [jobs[0].id, jobs[0].lease_token]);
  assert.equal((await db.query(`select status from public.delivery_outbox where id=$1`, [jobs[0].id])).rows[0].status, 'SENT');
  console.log('PASS delivery queue lease and acknowledgment idempotency');
  await assert.rejects(prepareEmail(emailRequest), /Delivery lease is not active/);
  console.log('PASS immutable email request and expired lease rejection');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await db.close(); }
