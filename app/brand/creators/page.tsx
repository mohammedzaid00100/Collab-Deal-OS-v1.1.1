import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { CreatorDiscoveryBrowser } from '@/components/creators/creator-discovery-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getCreatorDiscovery } from '@/lib/marketplace/feeds';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Creator discovery' };

export default async function CreatorDiscoveryPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const creators = await getCreatorDiscovery(supabase!);

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Brand workspace</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Creator discovery</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Compare discoverable creators using declared or API-verified metrics. Match scores reflect only your active published campaigns.</p></div>
    {creators.length ? <CreatorDiscoveryBrowser creators={creators} /> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><EmptyState icon={Search} title="No creators to show yet" description="Completed, discoverable creator profiles will appear here. Publish a campaign to add campaign-specific match scores." /></section>}
  </AppShell>;
}
