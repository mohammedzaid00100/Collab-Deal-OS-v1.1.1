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

  // Verify messaging reply invariants and realtime publication
  const pubTableCheck = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversation_messages'`);
  assert.equal(pubTableCheck.rows.length, 1);
  console.log('PASS conversation_messages registered in supabase_realtime publication');

  await db.query(`insert into public.brand_profiles(user_id,brand_name,website,industry,description,location,target_audience,typical_campaign_budget,target_creator_niche,target_creator_location,onboarding_complete)
    values($1,'Test Brand','https://testbrand.example','Tech','A valid test description for the brand profile.','Bengaluru','Founders',10000,'Tech','India',true)`, [other]);
  const brandProfId = (await db.query(`select id from public.brand_profiles where user_id=$1`, [other])).rows[0].id;
  const creatorProfId = (await db.query(`select id from public.creator_profiles where user_id=$1`, [user])).rows[0].id;
  const camp1 = (await db.query(`insert into public.campaigns(brand_profile_id,title,description,platform,target_creator_niche,objective,deal_type,budget,status) values($1,'Deal 1','A valid campaign description for testing.','Instagram','Tech','Brand awareness','PAID',5000,'DRAFT') returning id`, [brandProfId])).rows[0].id;

  const conv1 = (await db.query(`insert into public.conversations(campaign_id,brand_profile_id,creator_profile_id) values($1,$2,$3) returning id`, [camp1, brandProfId, creatorProfId])).rows[0].id;
  const camp2 = (await db.query(`insert into public.campaigns(brand_profile_id,title,description,platform,target_creator_niche,objective,deal_type,budget,status) values($1,'Deal 2','A second valid campaign description for testing.','Instagram','Tech','Brand awareness','PAID',5000,'DRAFT') returning id`, [brandProfId])).rows[0].id;
  const conv2 = (await db.query(`insert into public.conversations(campaign_id,brand_profile_id,creator_profile_id) values($1,$2,$3) returning id`, [camp2, brandProfId, creatorProfId])).rows[0].id;

  const msg1 = (await db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body) values($1,$2,'First message') returning id`, [conv1, other])).rows[0].id;
  const reply1 = (await db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body,reply_to_message_id) values($1,$2,'Reply to first',$3) returning id, reply_to_message_id`, [conv1, user, msg1])).rows[0];
  assert.equal(reply1.reply_to_message_id, msg1);

  // Reject reply targeting a message from a different conversation
  await assert.rejects(
    db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body,reply_to_message_id) values($1,$2,'Cross conv reply',$3)`, [conv2, user, msg1]),
    /Referenced reply message does not belong to the same conversation/
  );
  console.log('PASS message reply integrity and cross-conversation rejection');

  // Verify ON DELETE SET NULL on original message delete
  await db.query(`delete from public.conversation_messages where id=$1`, [msg1]);
  const replyAfterDelete = (await db.query(`select reply_to_message_id from public.conversation_messages where id=$1`, [reply1.id])).rows[0];
  assert.equal(replyAfterDelete.reply_to_message_id, null);
  console.log('PASS reply_to_message_id set null on referenced message delete');

  // Verify RLS sender-only deletion
  const creatorMsg = (await db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body) values($1,$2,'Creator message to delete') returning id`, [conv1, user])).rows[0].id;

  // As 'other' (non-sender), attempt to delete creatorMsg -> 0 rows affected
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
  await db.exec(`set role authenticated`);
  const nonSenderDelete = await db.query(`delete from public.conversation_messages where id=$1`, [creatorMsg]);
  assert.equal(nonSenderDelete.rowCount ?? 0, 0);

  const stillExists = (await db.query(`select count(*)::integer as n from public.conversation_messages where id=$1`, [creatorMsg])).rows[0].n;
  assert.equal(stillExists, 1);

  // As 'user' (sender), delete creatorMsg -> succeeds
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
  const senderDelete = await db.query(`delete from public.conversation_messages where id=$1`, [creatorMsg]);
  assert.equal(senderDelete.rowCount, 1);

  const deletedCheck = (await db.query(`select count(*)::integer as n from public.conversation_messages where id=$1`, [creatorMsg])).rows[0].n;
  assert.equal(deletedCheck, 0);

  await db.exec(`reset role`);
  console.log('PASS RLS sender-only message deletion and non-sender denial');

  // Verify Creator-to-Creator Connect functionality and RLS isolation
  const userB = '00000000-0000-4000-8000-000000000003';
  const userC = '00000000-0000-4000-8000-000000000004';
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ($1,'creator_b@example.test','{"account_type":"creator"}'),
    ($2,'creator_c@example.test','{"account_type":"creator"}')`, [userB, userC]);

  const creatorProfB = (await db.query(`insert into public.creator_profiles(user_id,full_name,username,bio,niche,location,primary_audience_region,primary_content_format,onboarding_complete)
    values($1,'Creator Beta','creator_beta','Creator B bio description for database testing','Fashion','Delhi','India','Reels',true) returning id`, [userB])).rows[0].id;

  const creatorProfC = (await db.query(`insert into public.creator_profiles(user_id,full_name,username,bio,niche,location,primary_audience_region,primary_content_format,onboarding_complete)
    values($1,'Creator Charlie','creator_charlie','Creator C bio description for database testing','Fitness','Goa','India','Reels',true) returning id`, [userC])).rows[0].id;

  // Add deliverable and publish camp1 so it is available for connect
  await db.query(`insert into public.campaign_deliverables(campaign_id, deliverable_type, quantity) values($1, 'Instagram Reel', 1)`, [camp1]);
  await db.query(`update public.campaigns set status = 'PUBLISHED' where id = $1`, [camp1]);

  // Both Creator A and Creator B comment on camp1
  await db.query(`insert into public.campaign_comments(campaign_id,creator_profile_id,body) values($1,$2,'Creator A comment on Deal 1')`, [camp1, creatorProfId]);
  await db.query(`insert into public.campaign_comments(campaign_id,creator_profile_id,body) values($1,$2,'Great campaign! Count me in.')`, [camp1, creatorProfB]);

  // Test self-messaging rejection as Creator A (user)
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
  await db.exec(`set role authenticated`);

  try {
    await db.query(`select public.start_creator_connect_conversation($1, $2)`, [creatorProfId, camp1]);
    assert.fail('Should have rejected self message');
  } catch (err) {
    assert.match(err.message, /cannot message yourself/);
  }

  try {
    await db.query(`select public.start_creator_connect_conversation($1, $2)`, [creatorProfC, camp1]);
    assert.fail('Should have rejected creator with no comment');
  } catch (err) {
    assert.match(err.message, /must comment on this deal before a conversation can start/);
  }

  // Creator A starts conversation with Creator B from camp1
  const ccConvResult1 = await db.query(`select public.start_creator_connect_conversation($1, $2) as id`, [creatorProfB, camp1]);
  const ccConvId1 = ccConvResult1.rows[0].id;
  assert.ok(ccConvId1);

  // Creator B starts conversation with Creator A from camp1 -> must return identical conversation ID
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [userB]);
  const ccConvResult2 = await db.query(`select public.start_creator_connect_conversation($1, $2) as id`, [creatorProfId, camp1]);
  const ccConvId2 = ccConvResult2.rows[0].id;
  assert.equal(ccConvId2, ccConvId1);
  console.log('PASS Creator-to-Creator symmetrical conversation deduplication and self-message check');

  // Creator B sends message to Creator A
  const ccMsgResult = await db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body) values($1,$2,'Hey, loved your comment!') returning id`, [ccConvId1, userB]);
  const ccMsgId = ccMsgResult.rows[0].id;
  assert.ok(ccMsgId);

  // Creator B can select conversation and message
  const creatorBConvs = await db.query(`select id from public.conversations where id = $1`, [ccConvId1]);
  assert.equal(creatorBConvs.rows.length, 1);
  const creatorBMsgs = await db.query(`select id from public.conversation_messages where conversation_id = $1`, [ccConvId1]);
  assert.equal(creatorBMsgs.rows.length, 1);

  // Creator A can select conversation and message
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
  const creatorAConvs = await db.query(`select id from public.conversations where id = $1`, [ccConvId1]);
  assert.equal(creatorAConvs.rows.length, 1);
  const creatorAMsgs = await db.query(`select id from public.conversation_messages where conversation_id = $1`, [ccConvId1]);
  assert.equal(creatorAMsgs.rows.length, 1);

  // Brand (other, who owns the campaign) CANNOT select conversation or messages
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
  const brandConvs = await db.query(`select id from public.conversations where id = $1`, [ccConvId1]);
  assert.equal(brandConvs.rows.length, 0);
  const brandMsgs = await db.query(`select id from public.conversation_messages where conversation_id = $1`, [ccConvId1]);
  assert.equal(brandMsgs.rows.length, 0);

  // Brand CANNOT insert message into Creator-to-Creator conversation
  await assert.rejects(
    db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body) values($1,$2,'Brand snooping')`, [ccConvId1, other]),
    /violates row-level security policy/
  );

  // Unrelated Creator C CANNOT select conversation or messages
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [userC]);
  const creatorCConvs = await db.query(`select id from public.conversations where id = $1`, [ccConvId1]);
  assert.equal(creatorCConvs.rows.length, 0);
  const creatorCMsgs = await db.query(`select id from public.conversation_messages where conversation_id = $1`, [ccConvId1]);
  assert.equal(creatorCMsgs.rows.length, 0);

  // Unrelated Creator C CANNOT insert message into Creator-to-Creator conversation
  await assert.rejects(
    db.query(`insert into public.conversation_messages(conversation_id,sender_user_id,body) values($1,$2,'Creator C snooping')`, [ccConvId1, userC]),
    /violates row-level security policy/
  );

  // Brand cannot invoke start_creator_connect_conversation
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [other]);
  await assert.rejects(
    db.query(`select public.start_creator_connect_conversation($1, $2)`, [creatorProfB, camp1]),
    /Creator account required/
  );

  // Reset role to superuser and test constraint enforcement
  await db.exec(`reset role`);

  // Verify conversation invariant check constraint blocks invalid combinations
  await assert.rejects(
    db.query(`insert into public.conversations(campaign_id, brand_profile_id, creator_profile_id, participant_creator_profile_id, conversation_type)
      values($1, null, $2, null, 'BRAND_CREATOR')`, [camp1, creatorProfId]),
    /violates check constraint "conversations_type_participants_check"/
  );

  await assert.rejects(
    db.query(`insert into public.conversations(campaign_id, brand_profile_id, creator_profile_id, participant_creator_profile_id, conversation_type)
      values($1, $2, $3, $4, 'CREATOR_CREATOR')`, [camp1, brandProfId, creatorProfId, creatorProfB]),
    /violates check constraint "conversations_type_participants_check"/
  );

  await assert.rejects(
    db.query(`insert into public.conversations(campaign_id, brand_profile_id, creator_profile_id, participant_creator_profile_id, conversation_type)
      values($1, null, $2, $2, 'CREATOR_CREATOR')`, [camp1, creatorProfId]),
    /violates check constraint "conversations_type_participants_check"/
  );

  console.log('PASS Creator-to-Creator RLS isolation (Brand & 3rd-party Creator blocked) and constraint checks');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await db.close(); }
