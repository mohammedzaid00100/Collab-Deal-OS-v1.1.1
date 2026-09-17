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

  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
    <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Connect</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Live brand deals</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Every item here is a real published deal from a registered brand account. Open one, review the terms, and comment if you are interested.</p></div>

    {deals.length ? <section className="mt-7 grid gap-4 lg:grid-cols-2" aria-label="Published deals">{deals.map((deal) => {
      const brand = brands.get(deal.brand_profile_id);
      return <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md" key={deal.id}>
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700"><Radio className="size-3" />Live deal</span><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{deal.platform} · {deal.deal_type.replaceAll('_', ' ')}</span></div><h2 className="mt-3 text-lg font-bold tracking-[-0.025em] text-slate-950">{deal.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{deal.description}</p></div><Link className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 transition-colors group-hover:bg-slate-950 focus-visible:bg-slate-950" href={`/creator/connect/${deal.id}`} aria-label={`Open ${deal.title}`}><ArrowRight className="size-4 stroke-slate-500 transition-colors group-hover:stroke-white group-focus-visible:stroke-white" /></Link></div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3"><Data icon={Building2} label="Brand" value={brand?.brand_name ?? 'Brand'} /><Data icon={BadgeIndianRupee} label="Deal value" value={formatInr(Number(deal.budget) + Number(deal.product_value))} /><Data icon={Radio} label="Creator niche" value={deal.target_creator_niche} /></div>
        {brand ? <p className="mt-4 text-[11px] text-slate-400">{brand.industry} · {brand.location} · Posted {formatDate(deal.created_at)}</p> : null}
      </article>;
    })}</section> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><EmptyState icon={Radio} title="No live deals yet" description="Published deals from real brand accounts will appear here as soon as brands post them." /></section>}
  </AppShell>;
}

function Data({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) { return <div className="min-w-0"><span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400"><Icon className="size-3" />{label}</span><strong className="mt-1 block truncate text-xs text-slate-800">{value}</strong></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
