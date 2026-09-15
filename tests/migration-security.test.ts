import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const accounts = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608280001_core_accounts.sql'),
  'utf8',
);
const storage = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608280003_storage_and_health.sql'),
  'utf8',
);
const matching = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608280004_matching_and_discovery.sql'),
  'utf8',
);
const lifecycle = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608280006_campaign_lifecycle.sql'),
  'utf8',
);
const offerHardening = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608280008_offer_workflow_hardening.sql'),
  'utf8',
);
const pricingAnalysis = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608280009_pricing_analysis_usage.sql'),
  'utf8',
);

describe('migration security invariants', () => {
  it('uses null-safe onboarding role checks', () => {
    expect(accounts).toContain("is distinct from 'creator'");
    expect(accounts).toContain("is distinct from 'brand'");
    expect(accounts).not.toMatch(/account_type[^\n]+<>\s*'(creator|brand)'/);
  });

  it('does not trust creator-submitted metric status', () => {
    expect(accounts).not.toContain("(social_row ->> 'metric_status')::public.metric_status");
    expect(accounts).toContain("then 'CREATOR_DECLARED'::public.metric_status");
  });

  it('rejects duplicate social platforms before upsert', () => {
    expect(accounts).toContain('Duplicate social platform entries are not allowed');
  });

  it('constrains storage updates and deletes to known private buckets', () => {
    const updatePolicy = storage.slice(storage.indexOf('private_assets_update_owner'));
    expect(updatePolicy).toContain("bucket_id in ('avatars', 'brand-logos', 'campaign-assets', 'media-kits', 'campaign-briefs')");
    expect(updatePolicy).toContain("u.account_type = 'creator'");
    expect(updatePolicy).toContain("u.account_type = 'brand'");
  });

  it('gates persisted matches on platform presence and niche fit', () => {
    expect(matching).toContain('and scored.platform_present');
    expect(matching).toContain('and scored.niche_score > 0');
  });

  it('does not grant direct campaign term or deliverable mutation', () => {
    expect(matching).toContain('revoke update on public.campaigns from authenticated');
    expect(matching).toContain('revoke insert, update, delete on public.campaign_deliverables from authenticated');
    expect(matching).not.toContain('grant update (asset_path)');
  });

  it('keeps lifecycle and asset changes behind owned RPCs', () => {
    expect(lifecycle).toContain('set_campaign_lifecycle');
    expect(lifecycle).toContain('set_campaign_asset_path');
    expect(lifecycle).toContain("target_asset_path not like auth.uid()::text || '/' || target_campaign_id::text || '/%'");
  });

  it('rejects null offer decisions explicitly', () => {
    expect(offerHardening).toContain("if decision is null or normalized_decision not in ('ACCEPT', 'REJECT')");
  });

  it('uses expected versions on every shared offer mutation', () => {
    expect(offerHardening).toMatch(/send_structured_offer\(target_offer_id uuid, expected_version integer\)/);
    expect(offerHardening).toContain('expected_version integer,\n  terms_data jsonb');
    expect(offerHardening).toContain('o.version = expected_version');
  });

  it('advances the optimistic lock on every private draft edit', () => {
    expect(offerHardening).toContain('version = o.version + 1');
    expect(offerHardening).toContain('returning o.version into next_version');
  });

  it('keeps brand drafts private from creator reads', () => {
    expect(offerHardening).toContain("status <> 'DRAFT' and sent_at is not null");
    expect(offerHardening).toContain("o.status <> 'DRAFT' and o.sent_at is not null");
  });

  it('stores immutable participant-visible offer events', () => {
    expect(offerHardening).toContain('create table public.offer_events');
    expect(offerHardening).toContain('create trigger offer_events_immutable');
    expect(offerHardening).toContain('offer_events_select_participants');
    expect(offerHardening).toContain('using (exists (select 1 from public.offers o where o.id = offer_id))');
    expect(offerHardening).not.toContain('join public.brand_profiles bp on bp.id = o.brand_profile_id\n  join public.creator_profiles cp on cp.id = o.creator_profile_id\n  where o.id = offer_id');
  });

  it('requires live deadlines and idempotent creation commands', () => {
    expect(offerHardening).toContain("raise exception 'Offer deadline must be in the future'");
    expect(offerHardening).toContain('offers_actor_creation_command_idx');
    expect(offerHardening).toContain('client_command_id uuid');
    expect(offerHardening).toContain('creation_request_hash');
    expect(offerHardening).toContain('public.sha256_text(request_fingerprint::text)');
    expect(offerHardening).not.toContain('creation_request_fingerprint');
    expect(offerHardening).toContain('if offer_record.deadline is null or offer_record.deadline <= now()');
    expect(offerHardening).toContain('add constraint offer_deadline_required check (deadline is not null)');
    expect(offerHardening).toContain('pg_advisory_xact_lock');
  });

  it('keeps AI quota mutations service-only and paid limits fail-closed', () => {
    expect(pricingAnalysis).toContain("('PRO', true, null");
    expect(pricingAnalysis).toContain("('PREMIUM', true, null");
    expect(pricingAnalysis).toContain('grant execute on function public.reserve_deal_analysis');
    expect(pricingAnalysis).toContain('to service_role');
    expect(pricingAnalysis).not.toMatch(/grant execute on function public\.(reserve|complete|fail)_deal_analysis[^;]+authenticated/);
  });

  it('serializes stale sweeps and uses a consistent analysis-to-usage lock order', () => {
    expect(pricingAnalysis).toContain('pg_try_advisory_xact_lock');
    const reserve = pricingAnalysis.slice(pricingAnalysis.indexOf('create or replace function public.reserve_deal_analysis'), pricingAnalysis.indexOf('create or replace function public.complete_deal_analysis'));
    expect(reserve).not.toContain("status = 'PENDING'\n      and da.usage_consumed and da.created_at < now() - interval '15 minutes'");
    expect(pricingAnalysis).toContain("perform public.fail_deal_analysis(stale_record.id, 'REQUEST_TIMEOUT')");
  });

  it('retains offers referenced by immutable analyses and validates trusted snapshots', () => {
    expect(pricingAnalysis).toContain('references public.offers(id) on delete restrict');
    expect(pricingAnalysis).toContain("jsonb_typeof(analysis_input_snapshot -> 'creator') is distinct from 'object'");
    expect(pricingAnalysis).toContain('cardinality(coalesce(selected_benchmark_refs');
  });
});
