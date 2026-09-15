import type { AccountType } from './domain';
import type { DealType, DeliverableItem } from './marketplace';

export type OfferStatus = 'DRAFT' | 'SENT' | 'UNDER_REVIEW' | 'REVISED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'COMPLETED';

export interface OfferFeedItem {
  offerId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorNiche: string;
  creatorAvatarUrl: string | null;
  cashPayment: number;
  currency: string;
  productName: string | null;
  productValue: number;
  dealType: DealType;
  deliverables: DeliverableItem[];
  usageRights: string | null;
  usageDurationDays: number | null;
  paidAdRights: boolean;
  exclusivity: boolean;
  exclusivityDurationDays: number | null;
  deadline: string | null;
  territory: string | null;
  notes: string | null;
  status: OfferStatus;
  pendingWith: AccountType | null;
  version: number;
  createdBy: string;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestAnalysisScore: number | null;
}

export interface OfferRevision {
  id: string;
  fromVersion: number;
  toVersion: number;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changedFields: string[];
  changedBy: string;
  createdAt: string;
}

export interface OfferEvent {
  id: number;
  eventType: string;
  fromStatus: OfferStatus | null;
  toStatus: OfferStatus;
  actorUserId: string | null;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
