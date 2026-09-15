import type { Metadata } from 'next';
import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { CreatorDiscoveryBrowser } from '@/components/creators/creator-discovery-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getCreatorDiscovery } from '@/lib/marketplace/feeds';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Creator matches' };

export default async function MatchesPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const client = await createSupabaseServerClient();
  const creators = (await getCreatorDiscovery(client!))
    .filter((creator) => creator.bestMatchScore !== null && creator.bestMatchScore >= 40)
    .sort((a, b) => b.bestMatchScore! - a.bestMatchScore!);
  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <h1 className="text-3xl font-bold tracking-tight text-slate-950">Your creator matches</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Eligible creators with a match score of at least 40 for your active published campaigns. Scores reflect niche, audience, size, engagement, budget, and platform fit—not a guarantee of campaign performance.</p>
    <Link href="/brand/campaigns" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">Manage campaign preferences</Link>
    {creators.length ? <CreatorDiscoveryBrowser creators={creators} /> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6"><EmptyState icon={UsersRound} title="No strong matches yet" description="Publish a campaign or adjust its preferences to discover eligible creators." /></section>}
  </AppShell>;
}
