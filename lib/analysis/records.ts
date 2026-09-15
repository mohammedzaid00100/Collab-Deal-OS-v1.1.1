import type { SupabaseClient } from '@supabase/supabase-js';
import type { DealAnalysisInput, DealAnalysisRecord, PricingCreatorInput } from '@/types/analysis';
import type { AccountType } from '@/types/domain';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface AnalysisRow {
  id: string;
  requested_by: string;
  offer_id: string | null;
  offer_version: number | null;
  status: DealAnalysisRecord['status'];
  account_perspective: AccountType;
  offer_snapshot: DealAnalysisInput;
  creator_metrics_snapshot: PricingCreatorInput;
  pricing_inputs_snapshot: Record<string, unknown>;
  fair_low: number | string | null;
  fair_mid: number | string | null;
  fair_high: number | string | null;
  deal_score: number | string | null;
  confidence_score: number | string | null;
  pricing_engine_version: string;
  ai_model: string | null;
  ai_verdict: DealAnalysisRecord['aiVerdict'];
  recommended_counter: number | string | null;
  provider_error_code: string | null;
  completed_at: string | null;
  created_at: string;
}

const selection = 'id,requested_by,offer_id,offer_version,status,account_perspective,offer_snapshot,creator_metrics_snapshot,pricing_inputs_snapshot,fair_low,fair_mid,fair_high,deal_score,confidence_score,pricing_engine_version,ai_model,ai_verdict,recommended_counter,provider_error_code,completed_at,created_at';

export async function getAnalysis(client: SupabaseClient, id: string): Promise<DealAnalysisRecord | null> {
  const { data, error } = await client.from('deal_analyses').select(selection).eq('id', id).maybeSingle();
  if (error) throw new Error('Analysis history is temporarily unavailable.');
  return data ? mapAnalysis(data as unknown as AnalysisRow) : null;
}

export async function getAnalysisHistory(client: SupabaseClient, limit = 20): Promise<DealAnalysisRecord[]> {
  const { data, error } = await client.from('deal_analyses').select(selection).order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new Error('Analysis history is temporarily unavailable.');
  return ((data ?? []) as unknown as AnalysisRow[]).map(mapAnalysis);
}

export async function sweepStaleAnalyses(limit = 20) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.rpc('expire_stale_deal_analyses', { batch_limit: Math.min(Math.max(limit, 1), 100) });
}

function mapAnalysis(row: AnalysisRow): DealAnalysisRecord {
  return {
    id: row.id, requestedBy: row.requested_by, offerId: row.offer_id,
    offerVersion: row.offer_version == null ? null : Number(row.offer_version), status: row.status,
    accountPerspective: row.account_perspective, offerSnapshot: row.offer_snapshot,
    creatorMetricsSnapshot: row.creator_metrics_snapshot, pricingInputsSnapshot: row.pricing_inputs_snapshot,
    fairLow: numberOrNull(row.fair_low), fairMid: numberOrNull(row.fair_mid), fairHigh: numberOrNull(row.fair_high),
    dealScore: numberOrNull(row.deal_score), confidenceScore: numberOrNull(row.confidence_score),
    pricingEngineVersion: row.pricing_engine_version, aiModel: row.ai_model,
    aiVerdict: row.ai_verdict, recommendedCounter: numberOrNull(row.recommended_counter),
    providerErrorCode: row.provider_error_code, completedAt: row.completed_at, createdAt: row.created_at,
  };
}

function numberOrNull(value: number | string | null) { return value == null ? null : Number(value); }
