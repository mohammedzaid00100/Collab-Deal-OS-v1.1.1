import type { Metadata } from 'next';
import Link from 'next/link';
import { FilePlus2, FileText } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { OffersBrowser } from '@/components/offers/offers-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getOffers } from '@/lib/marketplace/offers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand offers' };
export default async function BrandOffersPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const offers = await getOffers(supabase!);

  return (
    <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Brand workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
            Offers
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5A5870] dark:text-[#9CA1BA]">
            Send explicit deal terms and respond to creator revisions through structured actions.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-sm font-semibold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]"
          style={{ color: '#fff' }}
          href="/brand/offers/new"
        >
          <FilePlus2 className="size-4" />
          Create offer
        </Link>
      </div>
      {offers.length ? (
        <OffersBrowser role="brand" offers={offers} />
      ) : (
        <section className="mt-7 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <EmptyState
            icon={FileText}
            title="No offers yet"
            description="Create a structured offer from a creator profile or a matched campaign."
          />
        </section>
      )}
    </AppShell>
  );
}

