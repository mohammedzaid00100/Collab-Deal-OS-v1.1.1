import { notFound } from 'next/navigation';
import { BarChart3, Bot, CircleDollarSign, Handshake, Megaphone, Settings, UserRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { FeaturePage } from '@/components/app/feature-page';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';

const sections = {
  opportunities: { icon: Megaphone, title: 'Opportunities', description: 'Campaigns matched to your niche, audience, size, engagement, budget, and active platforms.', emptyTitle: 'We haven’t found a strong match yet', emptyDescription: 'Relevant published campaigns will appear here with a transparent match score.', actionLabel: undefined, actionHref: undefined },
  offers: { icon: Handshake, title: 'Offers', description: 'Review every cash, product, deliverable, rights, exclusivity, and deadline term in one structured record.', emptyTitle: 'No offers yet', emptyDescription: 'Offers from brands—and every later revision—will appear here.', actionLabel: undefined, actionHref: undefined },
  'ai-advisor': { icon: Bot, title: 'AI Deal Advisor', description: 'Evaluate current terms against a deterministic fair range, then get a neutral explanation and suggested counter.', emptyTitle: 'Analyze your first deal', emptyDescription: 'You can start from an existing offer or enter a deal manually.', actionLabel: 'Start an analysis', actionHref: '/creator/ai-advisor/new' },
  analytics: { icon: BarChart3, title: 'Analytics', description: 'Track real account activity and accepted-deal patterns without invented revenue metrics.', emptyTitle: 'No analytics yet', emptyDescription: 'Real activity will appear after you receive, evaluate, or accept offers.', actionLabel: undefined, actionHref: undefined },
  subscription: { icon: CircleDollarSign, title: 'Subscription', description: 'Manage AI evaluation access while keeping marketplace browsing available on every plan.', emptyTitle: 'You are on the Free plan', emptyDescription: 'Your account includes five free AI evaluations. Upgrade options will appear here.', actionLabel: undefined, actionHref: undefined },
  settings: { icon: Settings, title: 'Settings', description: 'Update account preferences, privacy choices, and creator profile details.', emptyTitle: 'Settings are ready for your account', emptyDescription: 'Connect Supabase and complete onboarding to update persisted settings.', actionLabel: undefined, actionHref: undefined },
  profile: { icon: UserRound, title: 'Creator profile', description: 'Your declared metrics, portfolio links, niche, audience, and pricing expectations.', emptyTitle: 'Your profile will appear here', emptyDescription: 'Complete creator onboarding to build the profile brands can discover.', actionLabel: 'Complete profile', actionHref: '/onboarding/creator' },
} as const;

export default async function CreatorSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = sections[section as keyof typeof sections];
  if (!config) notFound();
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}><FeaturePage eyebrow="Creator workspace" {...config} /></AppShell>;
}
