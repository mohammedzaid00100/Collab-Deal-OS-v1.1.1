export const accountTypes = ['creator', 'brand'] as const;
export type AccountType = (typeof accountTypes)[number];

export const metricStatuses = [
  'CREATOR_DECLARED',
  'API_VERIFIED',
  'UNAVAILABLE',
] as const;
export type MetricStatus = (typeof metricStatuses)[number];

export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM';

export interface AccountSummary {
  id: string;
  email: string;
  accountType: AccountType;
  plan: PlanTier;
  onboardingComplete: boolean;
  displayName: string | null;
}
