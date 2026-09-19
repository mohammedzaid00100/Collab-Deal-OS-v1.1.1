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

  return (
    <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <div>
        <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Brand workspace</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
          Creator discovery
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#5A5870] dark:text-[#9CA1BA]">
          Compare discoverable creators using declared or API-verified metrics. Match scores reflect only your active published campaigns.
        </p>
      </div>
      {creators.length ? (
        <CreatorDiscoveryBrowser creators={creators} />
      ) : (
        <section className="mt-7 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <EmptyState
            icon={Search}
            title="No creators to show yet"
            description="Completed, discoverable creator profiles will appear here. Publish a campaign to add campaign-specific match scores."
          />
        </section>
      )}
    </AppShell>
  );
}

