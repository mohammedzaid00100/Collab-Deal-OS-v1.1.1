import type { Metadata } from 'next';
import { Handshake } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { OffersBrowser } from '@/components/offers/offers-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getOffers } from '@/lib/marketplace/offers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Creator offers' };
export default async function CreatorOffersPage() {
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const offers = await getOffers(supabase!);

  return (
    <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
      <div>
        <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Creator workspace</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
          Offers
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5A5870] dark:text-[#9CA1BA]">
          Review value, deliverables, rights, revisions, and decisions as structured versions—never messages.
        </p>
      </div>
      {offers.length ? (
        <OffersBrowser role="creator" offers={offers} />
      ) : (
        <section className="mt-7 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <EmptyState
            icon={Handshake}
            title="No offers yet"
            description="Offers from brands—and every later structured revision—will appear here."
          />
        </section>
      )}
    </AppShell>
  );
}

