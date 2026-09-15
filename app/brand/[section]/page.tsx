import { notFound } from 'next/navigation';
import { BarChart3, BriefcaseBusiness, CircleDollarSign, FileText, Search, Settings, UserRound, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { FeaturePage } from '@/components/app/feature-page';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';

const sections = {
  campaigns: { icon: BriefcaseBusiness, title: 'Campaigns', description: 'Create and manage structured creator campaigns with explicit value, deliverables, rights, and timelines.', emptyTitle: 'No campaigns yet', emptyDescription: 'Create your first campaign to begin matching with creators.', actionLabel: 'Create your first campaign', actionHref: '/brand/campaigns/new' },
  creators: { icon: Search, title: 'Creator discovery', description: 'Compare eligible creators using declared or verified metrics and an explainable fit score.', emptyTitle: 'No creators to show yet', emptyDescription: 'Completed creator profiles matching your preferences will appear here.', actionLabel: undefined, actionHref: undefined },
  matches: { icon: UsersRound, title: 'Matches', description: 'Review transparent creator scores across niche, location, size, engagement, budget, and platform fit.', emptyTitle: 'No matches yet', emptyDescription: 'Publish a campaign to generate explainable creator matches.', actionLabel: 'Create a campaign', actionHref: '/brand/campaigns/new' },
  offers: { icon: FileText, title: 'Offers', description: 'Track sent terms, revision requests, and decisions as structured versions—not messages.', emptyTitle: 'No offers yet', emptyDescription: 'Create an offer from a campaign or creator profile. Every revision stays auditable.', actionLabel: undefined, actionHref: undefined },
  analytics: { icon: BarChart3, title: 'Analytics', description: 'Measure real campaign and accepted-deal activity without speculative ROI figures.', emptyTitle: 'No analytics yet', emptyDescription: 'Real campaign activity will appear after you publish campaigns and send offers.', actionLabel: undefined, actionHref: undefined },
  subscription: { icon: CircleDollarSign, title: 'Subscription / Billing', description: 'Manage AI evaluation access and verified subscription state.', emptyTitle: 'You are on the Free plan', emptyDescription: 'Your account includes five free AI evaluations. Paid access is activated only by verified payment events.', actionLabel: undefined, actionHref: undefined },
  settings: { icon: Settings, title: 'Settings', description: 'Update account preferences, security, notifications, and brand profile details.', emptyTitle: 'Settings are ready for your account', emptyDescription: 'Connect Supabase and complete onboarding to update persisted settings.', actionLabel: undefined, actionHref: undefined },
  profile: { icon: UserRound, title: 'Brand profile', description: 'Your public brand context and baseline creator preferences.', emptyTitle: 'Your brand profile will appear here', emptyDescription: 'Complete brand onboarding to create the profile creators will see.', actionLabel: 'Complete profile', actionHref: '/onboarding/brand' },
} as const;

export default async function BrandSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = sections[section as keyof typeof sections];
  if (!config) notFound();
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}><FeaturePage eyebrow="Brand workspace" {...config} /></AppShell>;
}
