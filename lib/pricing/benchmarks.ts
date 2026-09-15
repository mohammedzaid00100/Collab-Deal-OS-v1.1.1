import type { SupabaseClient } from '@supabase/supabase-js';
import type { DealAnalysisFormInput } from '@/lib/validation/analysis';
import { PRICING_ENGINE_VERSION } from './engine';
import { pricingBenchmarkConfigSchema, PricingConfigurationError, type ResolvedPricingBenchmark } from './config';
import { sha256Json } from '@/lib/security/hash';

interface BenchmarkRow {
  id: string;
  benchmark_key: string;
  niche: string | null;
  platform: string | null;
  region: string | null;
  configuration: Record<string, unknown>;
  source_label: string;
  engine_version: string;
  effective_from: string;
}

export async function resolvePricingBenchmark(client: SupabaseClient, input: DealAnalysisFormInput): Promise<ResolvedPricingBenchmark> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client.from('pricing_benchmarks')
    .select('id,benchmark_key,niche,platform,region,configuration,source_label,engine_version,effective_from')
    .eq('currency', input.currency)
    .eq('engine_version', PRICING_ENGINE_VERSION)
    .eq('is_active', true)
    .lte('effective_from', today)
    .or(`effective_until.is.null,effective_until.gte.${today}`);
  if (error) throw new PricingConfigurationError('BENCHMARK_LOOKUP_FAILED', 'Pricing configuration is temporarily unavailable.');
  const region = input.currency === 'INR' ? 'IN' : input.creator.audienceRegion.trim().toUpperCase();
  const applicable = ((data ?? []) as BenchmarkRow[]).filter((row) =>
    (row.region == null || same(row.region, region))
    && (row.platform == null || same(row.platform, input.creator.platform))
    && (row.niche == null || same(row.niche, input.creator.niche)),
  );
  const base = applicable.filter((row) => row.niche == null && row.platform == null && row.region != null && same(row.region, region));
  if (base.length !== 1) throw new PricingConfigurationError('BASE_BENCHMARK_MISSING', 'A single active base pricing configuration is required.');
  const selectorKeys = new Set<string>();
  for (const row of applicable) {
    const key = `${row.niche?.toLowerCase() ?? '*'}|${row.platform?.toLowerCase() ?? '*'}|${row.region?.toLowerCase() ?? '*'}`;
    if (selectorKeys.has(key)) throw new PricingConfigurationError('AMBIGUOUS_BENCHMARK', 'Overlapping active pricing configurations were found.');
    selectorKeys.add(key);
  }
  const ordered = applicable.sort((a, b) => specificity(a) - specificity(b) || a.benchmark_key.localeCompare(b.benchmark_key));
  const merged = ordered.reduce<Record<string, unknown>>((current, row) => deepMerge(current, row.configuration), {});
  const parsed = pricingBenchmarkConfigSchema.safeParse(merged);
  if (!parsed.success) throw new PricingConfigurationError('INVALID_BENCHMARK', 'The active pricing configuration is incomplete or invalid.');
  const coverage = new Set(ordered.flatMap((row) => [row.niche ? 'niche' : '', row.platform ? 'platform' : '', row.region ? 'region' : '']).filter(Boolean));
  return {
    configuration: parsed.data,
    engineVersion: PRICING_ENGINE_VERSION,
    benchmarkRefs: ordered.map((row) => row.id),
    sourceLabel: [...new Set(ordered.map((row) => row.source_label))].join(' · '),
    configHash: await sha256Json(parsed.data),
    specificityScore: coverage.size * 5,
  };
}

function specificity(row: BenchmarkRow) { return Number(Boolean(row.niche)) + Number(Boolean(row.platform)) + Number(Boolean(row.region)); }
function same(left: string, right: string) { return left.trim().localeCompare(right.trim(), undefined, { sensitivity: 'accent' }) === 0; }
function deepMerge(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const output = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const previous = output[key];
    output[key] = isRecord(previous) && isRecord(value) ? deepMerge(previous, value) : value;
  }
  return output;
}
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
