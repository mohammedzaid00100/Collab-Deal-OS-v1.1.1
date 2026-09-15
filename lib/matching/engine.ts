export const MATCHING_ENGINE_VERSION = 'match-v1.0.0';

export const MATCH_WEIGHTS = {
  niche: 30,
  audienceLocation: 20,
  creatorSize: 15,
  engagement: 15,
  budget: 10,
  platform: 10,
} as const;

export interface CampaignMatchInput {
  niche: string;
  targetLocation?: string | null;
  platform: string;
  followersMin: number;
  followersMax?: number | null;
  engagementMin?: number | null;
  engagementMax?: number | null;
  cashBudget: number;
  productValue: number;
}

export interface CreatorMatchInput {
  niche: string;
  location: string;
  audienceRegion: string;
  engagementRate: number;
  expectedRateLow: number;
  expectedRateHigh: number;
  platforms: Array<{ platform: string; audienceCount: number; available: boolean }>;
}

export interface MatchResult {
  score: number;
  components: {
    niche: number;
    audienceLocation: number;
    creatorSize: number;
    engagement: number;
    budget: number;
    platform: number;
  };
  explanation: string;
  engineVersion: typeof MATCHING_ENGINE_VERSION;
}

export function calculateMatch(campaign: CampaignMatchInput, creator: CreatorMatchInput): MatchResult {
  const platform = creator.platforms.find((item) => normalize(item.platform) === normalize(campaign.platform));
  const audienceCount = platform?.audienceCount ?? 0;
  const targetLocation = normalize(campaign.targetLocation ?? '');
  const niche = nicheScore(campaign.niche, creator.niche);
  const audienceLocation = !targetLocation || [creator.location, creator.audienceRegion].some((value) => fuzzyIncludes(value, targetLocation)) ? MATCH_WEIGHTS.audienceLocation : 0;
  const creatorSize = rangeScore(audienceCount, campaign.followersMin, campaign.followersMax ?? null, MATCH_WEIGHTS.creatorSize, 0.2, true);
  const engagement = campaign.engagementMin == null && campaign.engagementMax == null
    ? MATCH_WEIGHTS.engagement
    : rangeScore(creator.engagementRate, campaign.engagementMin ?? 0, campaign.engagementMax ?? 100, MATCH_WEIGHTS.engagement, 1);
  const dealValue = campaign.cashBudget + campaign.productValue;
  const budget = rangeScore(dealValue, creator.expectedRateLow, creator.expectedRateHigh, MATCH_WEIGHTS.budget, 0.25, true);
  const platformScore = platform?.available ? MATCH_WEIGHTS.platform : 0;

  // Platform presence and at least partial niche alignment are eligibility
  // gates. Optional criteria can be neutral without admitting unrelated users.
  if (!platform?.available || niche === 0) {
    return {
      score: 0,
      components: { niche, audienceLocation, creatorSize: 0, engagement: 0, budget: 0, platform: platformScore },
      explanation: !platform?.available
        ? `Not eligible: no available ${campaign.platform} account is present.`
        : 'Not eligible: the creator niche does not align with this campaign.',
      engineVersion: MATCHING_ENGINE_VERSION,
    };
  }

  const components = {
    niche,
    audienceLocation,
    creatorSize,
    engagement,
    budget,
    platform: platformScore,
  };
  const score = round(Object.values(components).reduce((total, value) => total + value, 0));
  const strong = Object.entries(components)
    .filter(([key, value]) => value === MATCH_WEIGHTS[key as keyof typeof MATCH_WEIGHTS])
    .map(([key]) => componentLabel(key));

  return {
    score,
    components,
    explanation: strong.length
      ? `Strong match on ${joinNatural(strong)}. Creator size, engagement, budget, and platform availability are all included in the score.`
      : 'Limited direct alignment across the weighted campaign criteria. Review the component scores before making an offer.',
    engineVersion: MATCHING_ENGINE_VERSION,
  };
}

function nicheScore(target: string, actual: string) {
  if (normalize(target) === normalize(actual)) return MATCH_WEIGHTS.niche;
  return fuzzyIncludes(target, actual) ? MATCH_WEIGHTS.niche / 2 : 0;
}

function rangeScore(
  value: number,
  min: number,
  max: number | null,
  weight: number,
  tolerance: number,
  proportionalTolerance = false,
) {
  if (value >= min && (max == null || value <= max)) return weight;
  const lowerTolerance = proportionalTolerance ? min * tolerance : tolerance <= 1 && min > 100 ? min * tolerance : tolerance;
  const upperTolerance = proportionalTolerance
    ? (max ?? Math.max(min, value)) * tolerance
    : tolerance <= 1 && (max ?? min) > 100
      ? (max ?? min) * tolerance
      : tolerance;
  if (value >= Math.max(0, min - lowerTolerance) && (max == null || value <= max + upperTolerance)) return weight / 2;
  return 0;
}

function fuzzyIncludes(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('en-IN');
}

function componentLabel(key: string) {
  const labels: Record<string, string> = {
    niche: 'niche',
    audienceLocation: 'audience/location',
    creatorSize: 'creator size',
    engagement: 'engagement',
    budget: 'budget',
    platform: 'platform',
  };
  return labels[key] ?? key;
}

function joinNatural(values: string[]) {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
