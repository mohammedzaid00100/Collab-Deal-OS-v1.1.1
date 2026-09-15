import type { SupabaseClient } from '@supabase/supabase-js';
import { createPrivateAssetUrl } from '@/lib/supabase/admin';
import type { AccountType } from '@/types/domain';
import type { DealType, DeliverableItem } from '@/types/marketplace';
import type { OfferEvent, OfferFeedItem, OfferRevision, OfferStatus } from '@/types/offers';

interface OfferRow {
  offer_id: string; campaign_id: string | null; campaign_title: string | null;
  brand_id: string; brand_name: string; brand_logo_path: string | null;
  creator_id: string; creator_name: string; creator_username: string; creator_niche: string; creator_avatar_path: string | null;
  cash_payment: number; currency: string; product_name: string | null; product_value: number; deal_type: DealType;
  deliverables: DeliverableItem[]; usage_rights: string | null; usage_duration_days: number | null;
  paid_ad_rights: boolean; exclusivity: boolean; exclusivity_duration_days: number | null;
  deadline: string | null; territory: string | null; notes: string | null; status: OfferStatus;
  pending_with: AccountType | null; version: number; created_by: string; sent_at: string | null;
  responded_at: string | null; created_at: string; updated_at: string; latest_analysis_score: number | null;
}

interface RevisionRow {
  id: string; from_version: number; to_version: number; old_values: Record<string, unknown>;
  new_values: Record<string, unknown>; changed_fields: string[]; changed_by: string; created_at: string;
}

export async function getOffers(client: SupabaseClient, targetOfferId?: string) {
  const { data, error } = await client.rpc('offers_feed', {
    target_offer_id: targetOfferId ?? null,
    result_limit: targetOfferId ? 1 : 50,
    result_offset: 0,
  });
  if (error) throw new Error('Offers are temporarily unavailable.');
  return Promise.all(((data ?? []) as OfferRow[]).map(async (row): Promise<OfferFeedItem> => ({
    offerId: row.offer_id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    brandId: row.brand_id,
    brandName: row.brand_name,
    brandLogoUrl: await createPrivateAssetUrl('brand-logos', row.brand_logo_path),
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorUsername: row.creator_username,
    creatorNiche: row.creator_niche,
    creatorAvatarUrl: await createPrivateAssetUrl('avatars', row.creator_avatar_path),
    cashPayment: Number(row.cash_payment),
    currency: row.currency,
    productName: row.product_name,
    productValue: Number(row.product_value),
    dealType: row.deal_type,
    deliverables: row.deliverables ?? [],
    usageRights: row.usage_rights,
    usageDurationDays: row.usage_duration_days,
    paidAdRights: row.paid_ad_rights,
    exclusivity: row.exclusivity,
    exclusivityDurationDays: row.exclusivity_duration_days,
    deadline: row.deadline,
    territory: row.territory,
    notes: row.notes,
    status: row.status,
    pendingWith: row.pending_with,
    version: Number(row.version),
    createdBy: row.created_by,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestAnalysisScore: row.latest_analysis_score == null ? null : Number(row.latest_analysis_score),
  })));
}

export async function getOfferRevisions(client: SupabaseClient, offerId: string): Promise<OfferRevision[]> {
  const { data, error } = await client.from('offer_revisions').select('id,from_version,to_version,old_values,new_values,changed_fields,changed_by,created_at').eq('offer_id', offerId).order('to_version', { ascending: false });
  if (error) throw new Error('Offer revision history is temporarily unavailable.');
  return ((data ?? []) as RevisionRow[]).map((row) => ({
    id: row.id,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    oldValues: row.old_values,
    newValues: row.new_values,
    changedFields: row.changed_fields,
    changedBy: row.changed_by,
    createdAt: row.created_at,
  }));
}

export async function getOfferEvents(client: SupabaseClient, offerId: string): Promise<OfferEvent[]> {
  const { data, error } = await client.from('offer_events').select('id,event_type,from_status,to_status,actor_user_id,version,metadata,created_at').eq('offer_id', offerId).order('created_at', { ascending: false });
  if (error) throw new Error('Offer decision history is temporarily unavailable.');
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    eventType: String(row.event_type),
    fromStatus: row.from_status as OfferStatus | null,
    toStatus: row.to_status as OfferStatus,
    actorUserId: row.actor_user_id as string | null,
    version: Number(row.version),
    metadata: row.metadata as Record<string, unknown>,
    createdAt: String(row.created_at),
  }));
}
