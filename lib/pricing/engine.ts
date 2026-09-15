import { dealAnalysisInputSchema, type DealAnalysisFormInput } from '@/lib/validation/analysis';
import type { MetricStatus } from '@/types/domain';
import type { PricingFactor, PricingResult } from '@/types/analysis';
import type { ResolvedPricingBenchmark } from './config';
import { PricingConfigurationError } from './config';

export const PRICING_ENGINE_VERSION = 'pricing-v1.0.0';

export class PricingInputError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PricingInputError';
  }
}

export function calculateDealPricing(rawInput: DealAnalysisFormInput, benchmark: ResolvedPricingBenchmark): PricingResult {
  const input = dealAnalysisInputSchema.parse(rawInput);
  if (benchmark.engineVersion !== PRICING_ENGINE_VERSION) {
    throw new PricingConfigurationError('ENGINE_VERSION_MISMATCH', 'The selected pricing benchmark is not compatible with this engine.');
  }
  const config = benchmark.configuration;
  const risks: string[] = [];
  const averageViewsAvailable = input.creator.averageViews > 0 && input.creator.averageViewsStatus !== 'UNAVAILABLE';
  const followersAvailable = input.creator.followers > 0 && input.creator.followersStatus !== 'UNAVAILABLE';
  if (!averageViewsAvailable && !followersAvailable) {
    throw new PricingInputError('INSUFFICIENT_PERFORMANCE_DATA', 'Add average views or followers before running a fair-value analysis.');
  }

  const followerProxyViews = input.creator.followers * config.viewRateFallback;
  let effectiveViews: number;
  if (averageViewsAvailable && followersAvailable) {
    const cappedFollowerProxy = Math.min(followerProxyViews, input.creator.averageViews * 2);
    effectiveViews = config.avgViewsWeight * input.creator.averageViews + config.followerWeight * cappedFollowerProxy;
  } else if (averageViewsAvailable) {
    effectiveViews = input.creator.averageViews;
    risks.push('FOLLOWERS_UNAVAILABLE');
  } else {
    effectiveViews = followerProxyViews;
    risks.push('AVERAGE_VIEWS_UNAVAILABLE', 'FOLLOWER_PROXY_USED');
  }

  const engagementAvailable = input.creator.engagementRateStatus !== 'UNAVAILABLE';
  const engagementMultiplier = engagementAvailable
    ? interpolate(
      input.creator.engagementRate,
      config.engagementReferenceLow,
      config.engagementReferenceHigh,
      config.engagementMultiplierMin,
      config.engagementMultiplierMax,
    )
    : 1;
  if (!engagementAvailable) risks.push('ENGAGEMENT_UNAVAILABLE');
  if ([input.creator.followersStatus, input.creator.averageViewsStatus, input.creator.engagementRateStatus].some((status) => status === 'CREATOR_DECLARED')) {
    risks.push('CREATOR_DECLARED_METRICS');
  }

  const performanceUnit = (effectiveViews / 1000) * config.baseCpmInr * engagementMultiplier
    * config.formatMultiplier * config.demandMultiplier;
  let scopeBase = 0;
  for (const deliverable of input.deal.deliverables) {
    const multiplier = config.deliverableMultipliers[deliverable.type];
    const productionFloor = config.productionFloors[deliverable.type];
    if (multiplier == null || productionFloor == null) {
      throw new PricingConfigurationError('UNSUPPORTED_DELIVERABLE', `No pricing configuration exists for ${deliverable.type}.`);
    }
    scopeBase += deliverable.quantity * Math.max(productionFloor, performanceUnit * multiplier);
  }

  const usageDays = input.deal.perpetualUsage ? Number.POSITIVE_INFINITY : input.deal.usageDurationDays;
  const rightsRate = input.deal.perpetualUsage
    ? config.rightsCap
    : Math.min(config.rightsBaseRates[input.deal.usageCategory] + usageDays * config.rightsDailyRate, config.rightsCap);
  const organicRightsPremium = input.deal.usageCategory === 'CREATOR_CHANNELS_ONLY' ? 0 : scopeBase * rightsRate;
  const paidAdsRate = input.deal.paidAdRights
    ? Math.min(config.paidAdsBaseRate + (input.deal.paidAdDurationDays / 30) * config.paidAdsMonthlyRate, config.adsCap)
    : 0;
  const paidAdsPremium = scopeBase * paidAdsRate;
  const whitelistingPremium = input.deal.whitelisting ? scopeBase * config.whitelistingRate : 0;
  const exclusivityRate = input.deal.exclusivity
    ? Math.min((input.deal.exclusivityDurationDays / 30) * config.exclusivityMonthlyRate, config.exclusivityCap)
    : 0;
  const exclusivityPremium = scopeBase * exclusivityRate;
  const territoryRate = config.territoryRates[input.deal.territoryCategory];
  const territoryPremium = scopeBase * territoryRate;
  const rushRate = input.deal.turnaroundDays <= config.urgentThresholdDays
    ? config.urgentRate
    : input.deal.turnaroundDays <= config.rushThresholdDays ? config.rushRate : 0;
  const rushPremium = scopeBase * rushRate;
  const fitRate = input.deal.campaignFitScore == null
    ? 0
    : clamp(((input.deal.campaignFitScore - 50) / 50) * config.fitMaxAdjustment, -config.fitMaxAdjustment, config.fitMaxAdjustment);
  const fitAdjustment = scopeBase * fitRate;

  const rawMid = Math.max(
    config.minimumDealValue,
    scopeBase + organicRightsPremium + paidAdsPremium + whitelistingPremium
      + exclusivityPremium + territoryPremium + rushPremium + fitAdjustment,
  );
  const fairMid = roundTo(rawMid, config.roundingIncrement);
  const confidenceScore = calculateConfidence(input, benchmark);
  const rangeWidth = config.minRangeWidth + (1 - confidenceScore / 100) * (config.maxRangeWidth - config.minRangeWidth);
  const fairLow = Math.max(config.roundingIncrement, floorTo(fairMid * (1 - rangeWidth), config.roundingIncrement));
  const fairHigh = Math.max(fairMid, ceilTo(fairMid * (1 + rangeWidth), config.roundingIncrement));
  const productCredit = input.deal.creatorKeepsProduct
    ? roundTo(input.deal.productValue * config.productRealizationRate, config.roundingIncrement)
    : 0;
  const economicOfferValue = input.deal.cashOffer + productCredit;
  const verdict = economicOfferValue < fairLow ? 'BELOW_FAIR' : economicOfferValue > fairHigh ? 'ABOVE_FAIR' : 'FAIR';
  const dealScore = economicOfferValue < fairLow
    ? clamp(Math.round((economicOfferValue / fairLow) * 100), 0, 100)
    : economicOfferValue > fairHigh
      ? clamp(Math.round((fairHigh / Math.max(economicOfferValue, 1)) * 100), 0, 100)
      : 100;
  const recommendedCounter = verdict === 'FAIR'
    ? input.deal.cashOffer
    : Math.max(0, roundTo(fairMid - productCredit, config.roundingIncrement));

  if (input.deal.paidAdRights) risks.push('PAID_AD_RIGHTS');
  if (input.deal.whitelisting) risks.push('WHITELISTING_RIGHTS');
  if (input.deal.perpetualUsage) risks.push('PERPETUAL_USAGE');
  if (input.deal.exclusivityDurationDays > 90) risks.push('LONG_EXCLUSIVITY');
  if (rushRate > 0) risks.push('RUSH_TIMELINE');
  if (input.deal.creatorKeepsProduct && productCredit > input.deal.cashOffer) risks.push('PRODUCT_VALUE_DOMINANT');
  if (verdict === 'BELOW_FAIR') risks.push('OFFER_BELOW_FAIR_RANGE');
  if (verdict === 'ABOVE_FAIR') risks.push('OFFER_ABOVE_FAIR_RANGE');
  if (input.deal.campaignBudget != null && input.deal.campaignBudget < fairLow) risks.push('CAMPAIGN_BUDGET_BELOW_FAIR_RANGE');
  if (confidenceScore < 50) risks.push('LOW_CONFIDENCE');

  const factors: PricingFactor[] = [
    factor('PERFORMANCE', 'Performance baseline', `Effective views ${Math.round(effectiveViews).toLocaleString('en-IN')}; average views carry ${Math.round(config.avgViewsWeight * 100)}% of the blended signal.`, scopeBase, null),
    factor('ENGAGEMENT', 'Engagement adjustment', engagementAvailable ? 'Declared or verified engagement is applied against the configured internal reference range.' : 'No engagement multiplier was applied because engagement is unavailable.', 0, engagementMultiplier),
    factor('ORGANIC_RIGHTS', 'Organic usage rights', 'Rights are priced from the normalized usage category and duration, not interpreted from free text.', organicRightsPremium, rightsRate),
    factor('PAID_ADS', 'Paid advertising rights', 'Paid-media duration adds a separate, capped premium.', paidAdsPremium, paidAdsRate),
    factor('WHITELISTING', 'Whitelisting', 'Whitelisting adds a separately configured premium when selected.', whitelistingPremium, input.deal.whitelisting ? config.whitelistingRate : 0),
    factor('EXCLUSIVITY', 'Exclusivity', 'Exclusivity is priced by duration with a configured cap.', exclusivityPremium, exclusivityRate),
    factor('TERRITORY', 'Territory', 'Territory uses an explicit normalized category.', territoryPremium, territoryRate),
    factor('TURNAROUND', 'Turnaround', 'Short production timelines add a configured rush premium.', rushPremium, rushRate),
    factor('FIT', 'Campaign fit', input.deal.campaignFitScore == null ? 'No trusted persisted match score was applied.' : 'A capped adjustment was derived from the persisted campaign match score.', fitAdjustment, fitRate),
  ];

  const result: PricingResult = {
    fairLow: toSafeMoney(fairLow), fairMid: toSafeMoney(fairMid), fairHigh: toSafeMoney(fairHigh),
    dealScore, confidenceScore, recommendedCounter: toSafeMoney(recommendedCounter),
    economicOfferValue: toSafeMoney(economicOfferValue), verdict,
    riskFlags: [...new Set(risks)], factors,
    pricingEngineVersion: benchmark.engineVersion,
    benchmarkSource: benchmark.sourceLabel,
    benchmarkRefs: benchmark.benchmarkRefs,
    benchmarkConfigHash: benchmark.configHash,
  };
  assertResult(result);
  return result;
}

function calculateConfidence(input: DealAnalysisFormInput, benchmark: ResolvedPricingBenchmark) {
  const metric = (status: MetricStatus) => status === 'API_VERIFIED' ? 1 : status === 'CREATOR_DECLARED' ? 0.65 : 0;
  const metricScore = metric(input.creator.averageViewsStatus) * 30
    + metric(input.creator.engagementRateStatus) * 20
    + metric(input.creator.followersStatus) * 10;
  const benchmarkScore = 10 + clamp(benchmark.specificityScore, 0, 15);
  const structuredScore = 15;
  return Math.round(Math.min(metricScore + benchmarkScore + structuredScore, benchmark.configuration.confidenceCap));
}

function factor(key: string, label: string, explanation: string, amountImpact: number, multiplier: number | null): PricingFactor {
  return { key, label, explanation, amountImpact: Math.round(amountImpact), multiplier: multiplier == null ? null : roundDecimal(multiplier, 4) };
}

function interpolate(value: number, low: number, high: number, outputLow: number, outputHigh: number) {
  const position = clamp((value - low) / (high - low), 0, 1);
  return outputLow + (outputHigh - outputLow) * position;
}

function roundTo(value: number, increment: number) { return Math.round(value / increment) * increment; }
function floorTo(value: number, increment: number) { return Math.floor(value / increment) * increment; }
function ceilTo(value: number, increment: number) { return Math.ceil(value / increment) * increment; }
function roundDecimal(value: number, places: number) { const power = 10 ** places; return Math.round(value * power) / power; }
function clamp(value: number, low: number, high: number) { return Math.min(high, Math.max(low, value)); }
function toSafeMoney(value: number) {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) {
    throw new PricingInputError('PRICE_OUT_OF_RANGE', 'The calculated value is outside the supported range.');
  }
  return value;
}
function assertResult(result: PricingResult) {
  if (result.fairLow > result.fairMid || result.fairMid > result.fairHigh) {
    throw new PricingInputError('INVALID_PRICE_RANGE', 'The pricing range could not be calculated safely.');
  }
}
