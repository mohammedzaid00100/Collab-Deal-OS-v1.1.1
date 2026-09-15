import type { SupabaseClient } from '@supabase/supabase-js';
import { getOffers } from '@/lib/marketplace/offers';
import { dealAnalysisInputSchema, type DealAnalysisFormInput } from '@/lib/validation/analysis';
import type { AccountType, MetricStatus } from '@/types/domain';

interface ResolveContextOptions {
  userId: string;
  role: AccountType;
  input: DealAnalysisFormInput;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
}

interface CreatorProfileRow {
  id: string;
  user_id: string;
  niche: string;
  location: string;
  primary_audience_region: string;
  average_views: number | string;
  average_views_status: MetricStatus;
  engagement_rate: number | string;
  engagement_rate_status: MetricStatus;
}

interface SocialRow { audience_count: number | string; metric_status: MetricStatus }
interface CampaignRow { platform: string; budget: number | string }

export async function resolveAnalysisContext(options: ResolveContextOptions): Promise<DealAnalysisFormInput> {
  const parsed = dealAnalysisInputSchema.parse(options.input);
  if (parsed.sourceOfferId) return resolveOfferContext(options, parsed);
  if (options.role === 'creator') {
    const profile = await getCreatorProfile(options.adminClient, options.userId, null);
    return dealAnalysisInputSchema.parse({
      ...parsed,
      creator: await authoritativeCreator(options.adminClient, profile, parsed.creator.platform),
      deal: { ...parsed.deal, campaignFitScore: undefined },
    });
  }
  return dealAnalysisInputSchema.parse({
    ...parsed,
    creator: {
      ...parsed.creator,
      creatorProfileId: undefined,
      followersStatus: manualMetricStatus(parsed.creator.followers, parsed.creator.followersStatus),
      averageViewsStatus: manualMetricStatus(parsed.creator.averageViews, parsed.creator.averageViewsStatus),
      engagementRateStatus: manualMetricStatus(parsed.creator.engagementRate, parsed.creator.engagementRateStatus),
    },
    deal: { ...parsed.deal, campaignFitScore: undefined },
  });
}

async function resolveOfferContext(options: ResolveContextOptions, parsed: DealAnalysisFormInput) {
  if (parsed.sourceOfferVersion == null) throw new AnalysisContextError('OFFER_VERSION_REQUIRED');
  const offers = await getOffers(options.userClient, parsed.sourceOfferId);
  const offer = offers[0];
  if (!offer || offer.version !== parsed.sourceOfferVersion) throw new AnalysisContextError('OFFER_STALE_OR_UNAVAILABLE');
  const profile = await getCreatorProfile(options.adminClient, null, offer.creatorId);
  let platform = parsed.creator.platform;
  let campaignBudget = parsed.deal.campaignBudget;
  let campaignFitScore: number | undefined;
  if (offer.campaignId) {
    const [{ data: campaign, error: campaignError }, { data: match, error: matchError }] = await Promise.all([
      options.adminClient.from('campaigns').select('platform,budget').eq('id', offer.campaignId).single(),
      options.adminClient.from('campaign_matches').select('score_components').eq('campaign_id', offer.campaignId).eq('creator_profile_id', offer.creatorId).maybeSingle(),
    ]);
    if (campaignError) throw new AnalysisContextError('CAMPAIGN_CONTEXT_UNAVAILABLE');
    const campaignRow = campaign as CampaignRow;
    platform = canonicalPlatform(campaignRow.platform);
    campaignBudget = Number(campaignRow.budget);
    if (!matchError && match?.score_components) campaignFitScore = nonBudgetFit(match.score_components as Record<string, unknown>);
  }
  const creator = await authoritativeCreator(options.adminClient, profile, platform);
  return dealAnalysisInputSchema.parse({
    ...parsed,
    sourceOfferId: offer.offerId,
    sourceOfferVersion: offer.version,
    currency: offer.currency,
    creator,
    deal: {
      ...parsed.deal,
      cashOffer: offer.cashPayment,
      productValue: offer.productValue,
      deliverables: offer.deliverables,
      usageRightsText: offer.usageRights ?? undefined,
      usageDurationDays: offer.usageDurationDays ?? parsed.deal.usageDurationDays,
      paidAdRights: offer.paidAdRights,
      paidAdDurationDays: offer.paidAdRights ? parsed.deal.paidAdDurationDays : 0,
      territoryText: offer.territory ?? parsed.deal.territoryText,
      exclusivity: offer.exclusivity,
      exclusivityDurationDays: offer.exclusivity ? (offer.exclusivityDurationDays ?? parsed.deal.exclusivityDurationDays) : 0,
      campaignBudget,
      campaignFitScore,
      context: offer.notes ?? parsed.deal.context,
    },
  });
}

async function getCreatorProfile(client: SupabaseClient, userId: string | null, profileId: string | null) {
  let query = client.from('creator_profiles').select('id,user_id,niche,location,primary_audience_region,average_views,average_views_status,engagement_rate,engagement_rate_status');
  query = userId ? query.eq('user_id', userId) : query.eq('id', profileId!);
  const { data, error } = await query.single();
  if (error || !data) throw new AnalysisContextError('CREATOR_METRICS_UNAVAILABLE');
  return data as CreatorProfileRow;
}

async function authoritativeCreator(client: SupabaseClient, profile: CreatorProfileRow, platform: DealAnalysisFormInput['creator']['platform']) {
  const { data, error } = await client.from('social_accounts')
    .select('audience_count,metric_status')
    .eq('creator_profile_id', profile.id)
    .eq('platform', platform.toUpperCase())
    .maybeSingle();
  if (error) throw new AnalysisContextError('CREATOR_METRICS_UNAVAILABLE');
  const social = data as SocialRow | null;
  return {
    creatorProfileId: profile.id,
    followers: social ? Number(social.audience_count) : 0,
    followersStatus: social?.metric_status ?? 'UNAVAILABLE' as MetricStatus,
    averageViews: Number(profile.average_views),
    averageViewsStatus: profile.average_views_status,
    engagementRate: Number(profile.engagement_rate),
    engagementRateStatus: profile.engagement_rate_status,
    niche: profile.niche,
    platform,
    audienceRegion: profile.primary_audience_region,
    location: profile.location,
  };
}

function manualMetricStatus(value: number, requested: MetricStatus): MetricStatus {
  if (value <= 0 || requested === 'UNAVAILABLE') return 'UNAVAILABLE';
  return 'CREATOR_DECLARED';
}

function canonicalPlatform(value: string): DealAnalysisFormInput['creator']['platform'] {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('instagram')) return 'Instagram';
  if (normalized.includes('youtube')) return 'YouTube';
  if (normalized.includes('tiktok')) return 'TikTok';
  if (normalized.includes('facebook')) return 'Facebook';
  return 'Other';
}

function nonBudgetFit(components: Record<string, unknown>) {
  const keys = ['niche', 'audienceLocation', 'creatorSize', 'engagement', 'platform'];
  const total = keys.reduce((sum, key) => sum + finiteNumber(components[key]), 0);
  return Math.round(Math.min(100, Math.max(0, (total / 90) * 100)) * 100) / 100;
}

function finiteNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }

export class AnalysisContextError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AnalysisContextError';
  }
}
