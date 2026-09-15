export type DealType = 'PAID' | 'PRODUCT_ONLY' | 'HYBRID';
export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';

export interface DeliverableItem {
  type: string;
  quantity: number;
  notes?: string | null;
}

export interface OpportunityFeedItem {
  campaignId: string;
  title: string;
  description: string;
  platform: string;
  niche: string;
  targetLocation: string | null;
  targetFollowersMin: number;
  targetFollowersMax: number | null;
  targetEngagementMin: number | null;
  targetEngagementMax: number | null;
  budget: number;
  currency: string;
  dealType: DealType;
  productName: string | null;
  productValue: number;
  deadline: string | null;
  assetUrl: string | null;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  matchScore: number;
  matchExplanation: string;
  deliverables: DeliverableItem[];
  objective: string;
  startsAt: string | null;
  endsAt: string | null;
  usageRights: string | null;
  usageDurationDays: number | null;
  paidAdRights: boolean;
  exclusivity: boolean;
  exclusivityDurationDays: number | null;
  territory: string | null;
  additionalRequirements: string | null;
  createdAt: string;
  saved: boolean;
}

export interface CreatorSocialMetric {
  platform: string;
  profile_url?: string | null;
  audience_count: number;
  metric_label: string;
  metric_status: 'CREATOR_DECLARED' | 'API_VERIFIED' | 'UNAVAILABLE';
}

export interface CreatorDiscoveryItem {
  creatorId: string;
  fullName: string;
  username: string;
  bio: string;
  niche: string;
  location: string;
  audienceRegion: string;
  primaryContentFormat: string;
  averageViews: number;
  averageViewsStatus: CreatorSocialMetric['metric_status'];
  engagementRate: number;
  engagementRateStatus: CreatorSocialMetric['metric_status'];
  expectedRateLow: number;
  expectedRateHigh: number;
  currency: string;
  avatarUrl: string | null;
  portfolioUrl: string | null;
  mediaKitUrl: string | null;
  socialAccounts: CreatorSocialMetric[];
  bestMatchScore: number | null;
  bestCampaignId: string | null;
}
