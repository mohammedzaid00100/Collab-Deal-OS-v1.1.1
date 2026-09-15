import type { SupabaseClient } from '@supabase/supabase-js';
import { createPrivateAssetUrl } from '@/lib/supabase/admin';
import type { CreatorDiscoveryItem, CreatorSocialMetric, DealType, DeliverableItem, OpportunityFeedItem } from '@/types/marketplace';

interface OpportunityRow {
  campaign_id: string; title: string; description: string; platform: string; niche: string;
  target_location: string | null; target_followers_min: number; target_followers_max: number | null;
  target_engagement_min: number | null; target_engagement_max: number | null;
  budget: number; currency: string; deal_type: DealType; product_name: string | null; product_value: number;
  deadline: string | null; asset_path: string | null; brand_id: string; brand_name: string; brand_logo_path: string | null;
  match_score: number; match_explanation: string; deliverables: DeliverableItem[]; objective: string;
  starts_at: string | null; ends_at: string | null; usage_rights: string | null; usage_duration_days: number | null;
  paid_ad_rights: boolean; exclusivity: boolean; exclusivity_duration_days: number | null;
  territory: string | null; additional_requirements: string | null; created_at: string;
}

interface DiscoveryRow {
  creator_id: string; full_name: string; username: string; bio: string; niche: string; location: string;
  primary_audience_region: string; primary_content_format: string; average_views: number;
  average_views_status: CreatorSocialMetric['metric_status']; engagement_rate: number;
  engagement_rate_status: CreatorSocialMetric['metric_status']; expected_rate_low: number;
  expected_rate_high: number; currency: string; avatar_path: string | null;
  portfolio_url: string | null; media_kit_url: string | null;
  social_accounts: CreatorSocialMetric[]; best_match_score: number | null; best_campaign_id: string | null;
}

export async function getCreatorOpportunities(client: SupabaseClient, targetCampaignId?: string) {
  const { data, error } = await client.rpc('creator_opportunities_feed', {
    target_campaign_id: targetCampaignId ?? null,
    result_limit: targetCampaignId ? 1 : 50,
    result_offset: 0,
  });
  if (error) throw new Error('Matched opportunities are temporarily unavailable.');
  return Promise.all(((data ?? []) as OpportunityRow[]).map(async (row): Promise<OpportunityFeedItem> => ({
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    platform: row.platform,
    niche: row.niche,
    targetLocation: row.target_location,
    targetFollowersMin: Number(row.target_followers_min),
    targetFollowersMax: row.target_followers_max == null ? null : Number(row.target_followers_max),
    targetEngagementMin: row.target_engagement_min == null ? null : Number(row.target_engagement_min),
    targetEngagementMax: row.target_engagement_max == null ? null : Number(row.target_engagement_max),
    budget: Number(row.budget),
    currency: row.currency,
    dealType: row.deal_type,
    productName: row.product_name,
    productValue: Number(row.product_value),
    deadline: row.deadline,
    assetUrl: await createPrivateAssetUrl('campaign-assets', row.asset_path),
    brandId: row.brand_id,
    brandName: row.brand_name,
    brandLogoUrl: await createPrivateAssetUrl('brand-logos', row.brand_logo_path),
    matchScore: Number(row.match_score),
    matchExplanation: row.match_explanation,
    deliverables: row.deliverables ?? [],
    objective: row.objective,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    usageRights: row.usage_rights,
    usageDurationDays: row.usage_duration_days,
    paidAdRights: row.paid_ad_rights,
    exclusivity: row.exclusivity,
    exclusivityDurationDays: row.exclusivity_duration_days,
    territory: row.territory,
    additionalRequirements: row.additional_requirements,
    createdAt: row.created_at,
    saved: false,
  })));
}

export async function getCreatorDiscovery(client: SupabaseClient, targetCreatorId?: string) {
  const { data, error } = await client.rpc('creator_discovery_feed', {
    target_creator_id: targetCreatorId ?? null,
    filter_niche: null,
    filter_platform: null,
    filter_location: null,
    minimum_followers: null,
    maximum_followers: null,
    minimum_engagement: null,
    minimum_average_views: null,
    minimum_match_score: null,
    result_limit: targetCreatorId ? 1 : 50,
    result_offset: 0,
  });
  if (error) throw new Error('Creator discovery is temporarily unavailable.');
  return Promise.all(((data ?? []) as DiscoveryRow[]).map(async (row): Promise<CreatorDiscoveryItem> => ({
    creatorId: row.creator_id,
    fullName: row.full_name,
    username: row.username,
    bio: row.bio,
    niche: row.niche,
    location: row.location,
    audienceRegion: row.primary_audience_region,
    primaryContentFormat: row.primary_content_format,
    averageViews: Number(row.average_views),
    averageViewsStatus: row.average_views_status,
    engagementRate: Number(row.engagement_rate),
    engagementRateStatus: row.engagement_rate_status,
    expectedRateLow: Number(row.expected_rate_low),
    expectedRateHigh: Number(row.expected_rate_high),
    currency: row.currency,
    avatarUrl: await createPrivateAssetUrl('avatars', row.avatar_path),
    portfolioUrl: row.portfolio_url,
    mediaKitUrl: row.media_kit_url,
    socialAccounts: row.social_accounts ?? [],
    bestMatchScore: row.best_match_score == null ? null : Number(row.best_match_score),
    bestCampaignId: row.best_campaign_id,
  })));
}
