import type { PlanTier } from '@/types/domain';

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  monthlyPriceInr: number;
  freeAiEvaluations: number;
  monthlyAiLimit: number | null;
  features: readonly string[];
}

// Entitlements live in one configuration module so the UI and future
// server-side usage guard cannot silently diverge. Paid monthly limits remain
// null until the business approves them; the product must not invent quotas.
export const planCatalog: Record<PlanTier, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    monthlyPriceInr: 0,
    freeAiEvaluations: 5,
    monthlyAiLimit: null,
    features: ['5 AI deal evaluations', 'Marketplace and discovery access', 'Structured offers', 'Core account profile'],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    monthlyPriceInr: 299,
    freeAiEvaluations: 0,
    monthlyAiLimit: null,
    features: ['Expanded AI evaluation access', 'Full analysis history', 'Suggested counters', 'Priority deal insights'],
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium',
    monthlyPriceInr: 599,
    freeAiEvaluations: 0,
    monthlyAiLimit: null,
    features: ['Highest AI access tier', 'Advanced analysis history', 'Premium support', 'Early access to new tools'],
  },
};

export const publicPlans = [planCatalog.FREE, planCatalog.PRO, planCatalog.PREMIUM] as const;
