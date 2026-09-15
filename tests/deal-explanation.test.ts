import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiProviderError, AI_UNAVAILABLE_MESSAGE, createDealExplanation } from '@/lib/ai/deal-explanation';
import type { DealAnalysisInput, PricingResult } from '@/types/analysis';

const input: DealAnalysisInput = {
  currency: 'INR',
  creator: {
    followers: 40_000, followersStatus: 'CREATOR_DECLARED',
    averageViews: 18_000, averageViewsStatus: 'CREATOR_DECLARED',
    engagementRate: 4.2, engagementRateStatus: 'CREATOR_DECLARED',
    niche: 'Beauty', platform: 'Instagram', audienceRegion: 'India', location: 'Mumbai',
  },
  deal: {
    cashOffer: 12_000, productValue: 2_000, creatorKeepsProduct: true,
    deliverables: [{ type: 'Instagram Reel', quantity: 1 }], turnaroundDays: 10,
    usageCategory: 'BRAND_ORGANIC', usageDurationDays: 30, perpetualUsage: false,
    paidAdRights: false, paidAdDurationDays: 0, whitelisting: false,
    territoryCategory: 'NATIONAL', territoryText: 'India', exclusivity: false,
    exclusivityDurationDays: 0,
  },
};

const pricing: PricingResult = {
  fairLow: 15_000, fairMid: 18_000, fairHigh: 22_000,
  dealScore: 78, confidenceScore: 81, recommendedCounter: 18_000,
  economicOfferValue: 13_000, verdict: 'BELOW_FAIR', riskFlags: ['BELOW_FAIR_RANGE'],
  factors: [{ key: 'views', label: 'Average views', explanation: 'Primary demand signal', amountImpact: 10_000, multiplier: 1 }],
  pricingEngineVersion: 'pricing-v1.0.0', benchmarkSource: 'Internal configuration',
  benchmarkRefs: ['00000000-0000-4000-8000-000000000001'], benchmarkConfigHash: 'a'.repeat(64),
};

const verdict = {
  verdict: 'BELOW_FAIR' as const,
  summary: 'The current value is below the deterministic fair range.',
  strengths: ['Clear deliverable'], risks: ['Usage rights add value'],
  recommended_counter: 18_000,
  reasoning_points: ['Average views drive most of the range.'],
  confidence_message: 'Confidence is good because performance metrics are available.',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function expectProviderCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    expect.fail(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    expect((error as AiProviderError).code).toBe(code);
    expect((error as Error).message).toBe(AI_UNAVAILABLE_MESSAGE);
  }
}

describe('deal explanation provider boundary', () => {
  it('fails safely when the server-only model configuration is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('OPENAI_MODEL', '');
    await expectProviderCode(createDealExplanation({ input, pricing, perspective: 'creator', userId: crypto.randomUUID() }), 'OPENAI_NOT_CONFIGURED');
  });

  it('uses strict Responses API output and accepts matching deterministic values', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'test-model');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify(verdict) }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await createDealExplanation({ input, pricing, perspective: 'brand', userId: crypto.randomUUID() });
    expect(result).toEqual({ verdict, model: 'test-model' });
    const requestBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as {
      store: boolean; text: { format: { strict: boolean; type: string } };
    };
    expect(requestBody.store).toBe(false);
    expect(requestBody.text.format).toMatchObject({ type: 'json_schema', strict: true });
  });

  it('rejects an AI response that changes the recommended money value', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'test-model');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({ ...verdict, recommended_counter: 99_999 }),
    }), { status: 200 })));
    await expectProviderCode(createDealExplanation({ input, pricing, perspective: 'creator', userId: crypto.randomUUID() }), 'OPENAI_COUNTER_MISMATCH');
  });
});
