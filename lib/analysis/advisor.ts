import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAnalysisContext } from './context';
import { getAnalysisHistory, sweepStaleAnalyses } from './records';
import { getOffers } from '@/lib/marketplace/offers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DealAnalysisFormInput } from '@/lib/validation/analysis';
import type { AccountType } from '@/types/domain';

export async function getAdvisorPageData(client: SupabaseClient, userId: string, role: AccountType, offerId?: string) {
  await sweepStaleAnalyses(20);
  const [{ data: usageData, error: usageError }, history] = await Promise.all([
    client.from('usage_limits').select('free_evaluations_total,free_evaluations_used').eq('user_id', userId).single(),
    getAnalysisHistory(client, 8),
  ]);
  if (usageError) throw new Error('AI usage is temporarily unavailable.');
  let initial = blankAnalysisInput();
  let sourceLabel: string | null = null;
  if (offerId) {
    const offer = (await getOffers(client, offerId))[0];
    if (offer) {
      const usageCategory = offer.usageRights ? 'BRAND_ORGANIC' as const : 'CREATOR_CHANNELS_ONLY' as const;
      const usageDuration = usageCategory === 'CREATOR_CHANNELS_ONLY' ? 0 : (offer.usageDurationDays ?? 30);
      initial = {
        ...initial,
        sourceOfferId: offer.offerId,
        sourceOfferVersion: offer.version,
        currency: offer.currency,
        creator: { ...initial.creator, creatorProfileId: offer.creatorId, niche: offer.creatorNiche },
        deal: {
          ...initial.deal,
          cashOffer: offer.cashPayment,
          productValue: offer.productValue,
          deliverables: offer.deliverables.map((item) => ({ ...item, notes: item.notes ?? '' })),
          usageCategory,
          usageRightsText: offer.usageRights ?? '',
          usageDurationDays: usageDuration,
          paidAdRights: offer.paidAdRights,
          paidAdDurationDays: offer.paidAdRights ? Math.max(30, usageDuration) : 0,
          territoryText: offer.territory ?? 'India',
          exclusivity: offer.exclusivity,
          exclusivityDurationDays: offer.exclusivity ? (offer.exclusivityDurationDays ?? 30) : 0,
          context: offer.notes ?? '',
        },
      };
      sourceLabel = `offer with ${role === 'creator' ? offer.brandName : offer.creatorName}`;
    }
  }
  const admin = createSupabaseAdminClient();
  if (admin && (initial.sourceOfferId || role === 'creator')) {
    initial = await resolveAnalysisContext({ userId, role, input: initial, userClient: client, adminClient: admin });
  }
  const usage = usageData as { free_evaluations_total: number; free_evaluations_used: number };
  return {
    initial,
    sourceLabel,
    history,
    freeRemaining: Math.max(0, Number(usage.free_evaluations_total) - Number(usage.free_evaluations_used)),
    privilegedConfigurationReady: Boolean(admin),
  };
}

export function blankAnalysisInput(): DealAnalysisFormInput {
  return {
    currency: 'INR',
    creator: {
      followers: 0, followersStatus: 'UNAVAILABLE', averageViews: 0,
      averageViewsStatus: 'UNAVAILABLE', engagementRate: 0,
      engagementRateStatus: 'UNAVAILABLE', niche: '', platform: 'Instagram',
      audienceRegion: 'India', location: 'India',
    },
    deal: {
      cashOffer: 0, productValue: 0, creatorKeepsProduct: false,
      deliverables: [{ type: 'Instagram Reel', quantity: 1, notes: '' }],
      turnaroundDays: 14, usageCategory: 'CREATOR_CHANNELS_ONLY', usageRightsText: '',
      usageDurationDays: 0, perpetualUsage: false, paidAdRights: false,
      paidAdDurationDays: 0, whitelisting: false, territoryCategory: 'NATIONAL',
      territoryText: 'India', exclusivity: false, exclusivityDurationDays: 0,
      campaignBudget: 0, context: '',
    },
  };
}
