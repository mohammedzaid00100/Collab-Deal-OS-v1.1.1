import type { AccountType, MetricStatus } from './domain';
import type { DeliverableItem } from './marketplace';

export type AnalysisVerdict = 'BELOW_FAIR' | 'FAIR' | 'ABOVE_FAIR' | 'NEEDS_REVIEW';
export type UsageCategory = 'CREATOR_CHANNELS_ONLY' | 'BRAND_ORGANIC' | 'MULTI_CHANNEL_ORGANIC';
export type TerritoryCategory = 'LOCAL' | 'NATIONAL' | 'MULTI_COUNTRY' | 'GLOBAL';

export interface PricingCreatorInput {
  creatorProfileId?: string;
  followers: number;
  followersStatus: MetricStatus;
  averageViews: number;
  averageViewsStatus: MetricStatus;
  engagementRate: number;
  engagementRateStatus: MetricStatus;
  niche: string;
  platform: string;
  audienceRegion: string;
  location: string;
}

export interface PricingDealInput {
  cashOffer: number;
  productValue: number;
  creatorKeepsProduct: boolean;
  deliverables: DeliverableItem[];
  turnaroundDays: number;
  usageCategory: UsageCategory;
  usageRightsText?: string;
  usageDurationDays: number;
  perpetualUsage: boolean;
  paidAdRights: boolean;
  paidAdDurationDays: number;
  whitelisting: boolean;
  territoryCategory: TerritoryCategory;
  territoryText: string;
  exclusivity: boolean;
  exclusivityDurationDays: number;
  campaignBudget?: number;
  campaignFitScore?: number;
  context?: string;
}

export interface DealAnalysisInput {
  sourceOfferId?: string;
  sourceOfferVersion?: number;
  currency: string;
  creator: PricingCreatorInput;
  deal: PricingDealInput;
}

export interface PricingFactor {
  key: string;
  label: string;
  explanation: string;
  amountImpact: number;
  multiplier: number | null;
}

export interface PricingResult {
  fairLow: number;
  fairMid: number;
  fairHigh: number;
  dealScore: number;
  confidenceScore: number;
  recommendedCounter: number;
  economicOfferValue: number;
  verdict: Exclude<AnalysisVerdict, 'NEEDS_REVIEW'>;
  riskFlags: string[];
  factors: PricingFactor[];
  pricingEngineVersion: string;
  benchmarkSource: string;
  benchmarkRefs: string[];
  benchmarkConfigHash: string;
}

export interface AiVerdict {
  verdict: AnalysisVerdict;
  summary: string;
  strengths: string[];
  risks: string[];
  recommended_counter: number;
  reasoning_points: string[];
  confidence_message: string;
}

export type AnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface DealAnalysisRecord {
  id: string;
  requestedBy: string;
  offerId: string | null;
  offerVersion: number | null;
  status: AnalysisStatus;
  accountPerspective: AccountType;
  offerSnapshot: DealAnalysisInput;
  creatorMetricsSnapshot: PricingCreatorInput;
  pricingInputsSnapshot: Record<string, unknown>;
  fairLow: number | null;
  fairMid: number | null;
  fairHigh: number | null;
  dealScore: number | null;
  confidenceScore: number | null;
  pricingEngineVersion: string;
  aiModel: string | null;
  aiVerdict: AiVerdict | null;
  recommendedCounter: number | null;
  providerErrorCode: string | null;
  completedAt: string | null;
  createdAt: string;
}
