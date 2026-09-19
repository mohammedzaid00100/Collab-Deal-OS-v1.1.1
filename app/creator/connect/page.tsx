import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeIndianRupee, Building2, Radio } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Connect' };

type CampaignRow = {
  id: string;
  brand_profile_id: string;
  title: string;
  description: string;
  platform: string;
  target_creator_niche: string;
  budget: number;
  product_value: number;
  deal_type: string;
  created_at: string;
};

type BrandRow = { id: string; brand_name: string; industry: string; location: string };

export default async function CreatorConnectPage() {
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!
    .from('campaigns')
    .select('id,brand_profile_id,title,description,platform,target_creator_niche,budget,product_value,deal_type,created_at')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false });
  if (error) throw new Error('Connect deals are temporarily unavailable.');

  const deals = (data ?? []) as CampaignRow[];
  const brandIds = [...new Set(deals.map((deal) => deal.brand_profile_id))];
  const brandResult = brandIds.length
    ? await supabase!.from('brand_profiles').select('id,brand_name,industry,location').in('id', brandIds)
    : { data: [], error: null };
  if (brandResult.error) throw new Error('Brand information is temporarily unavailable.');
  const brands = new Map(((brandResult.data ?? []) as BrandRow[]).map((brand) => [brand.id, brand]));

  return (
    <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5] dark:text-[#818CF8]">Connect</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">Live brand deals</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#5A5870] dark:text-[#9CA1BA]">
          Every item here is a real published deal from a registered brand account. Open one, review the terms, and comment if you are interested.
        </p>
      </div>

      {deals.length ? (
        <section className="mt-7 grid gap-4 lg:grid-cols-2" aria-label="Published deals">
          {deals.map((deal) => {
            const brand = brands.get(deal.brand_profile_id);
            return (
              <Link
                className="group flex flex-col justify-between rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:bg-[#FBF9F5] hover:shadow-[6px_6px_0_#0D0C1D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] dark:hover:border-[#6366F1] dark:hover:bg-[#1C1E30]"
                href={`/creator/connect/${deal.id}`}
                key={deal.id}
                aria-label={`Open ${deal.title}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-[6px] border-2 border-[#0D0C1D] bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#059669] shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#064E3B]/40 dark:text-[#34D399] dark:shadow-[1.5px_1.5px_0_#000000]">
                          <Radio className="size-3" />
                          Live deal
                        </span>
                        <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                          {deal.platform} · {deal.deal_type.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-bold tracking-[-0.03em] text-[#0D0C1D] transition-colors group-hover:text-[#4F46E5] dark:text-[#F3F4F8] dark:group-hover:text-[#818CF8]">
                        {deal.title}
                      </h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#5A5870] dark:text-[#9CA1BA]">
                        {deal.description}
                      </p>
                    </div>
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all group-hover:bg-[#4F46E5] group-hover:text-white dark:border-[#383E5E] dark:bg-[#1E2134] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000] dark:group-hover:bg-[#6366F1] dark:group-hover:text-white"
                      aria-hidden="true"
                    >
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 border-t-2 border-[#0D0C1D] pt-4 dark:border-[#383E5E] sm:grid-cols-3">
                    <Data icon={Building2} label="Brand" value={brand?.brand_name ?? 'Brand'} />
                    <Data icon={BadgeIndianRupee} label="Deal value" value={formatInr(Number(deal.budget) + Number(deal.product_value))} />
                    <Data icon={Radio} label="Creator niche" value={deal.target_creator_niche} />
                  </div>
                </div>

                {brand ? (
                  <p className="mt-4 border-t border-dashed border-[#0D0C1D]/20 pt-3 text-xs font-medium text-[#5A5870] dark:border-[#383E5E] dark:text-[#9CA1BA]">
                    {brand.industry} · {brand.location} · Posted {formatDate(deal.created_at)}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="mt-7 rounded-[10px] border-2 border-dashed border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#121422] dark:shadow-[4px_4px_0_#000000]">
          <EmptyState
            icon={Radio}
            title="No live deals yet"
            description="Published deals from real brand accounts will appear here as soon as brands post them."
          />
        </section>
      )}
    </AppShell>
  );
}

function Data({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">
        <Icon className="size-3.5 text-[#4F46E5] dark:text-[#818CF8]" />
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
        {value}
      </strong>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
