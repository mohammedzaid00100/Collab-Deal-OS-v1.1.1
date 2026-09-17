import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageSquareText, Plus, Radio } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Connect' };

type CampaignRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  platform: string;
  budget: number;
  product_value: number;
  created_at: string;
};

export default async function BrandConnectPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase!.from('brand_profiles').select('id').eq('user_id', account.id).single();
  if (profileError || !profile) throw new Error('Brand profile is temporarily unavailable.');

  const { data, error } = await supabase!
    .from('campaigns')
    .select('id,title,description,status,platform,budget,product_value,created_at')
    .eq('brand_profile_id', profile.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Your deals are temporarily unavailable.');

  const deals = (data ?? []) as CampaignRow[];
  const ids = deals.map((deal) => deal.id);
  const commentResult = ids.length
    ? await supabase!.from('campaign_comments').select('campaign_id').in('campaign_id', ids)
    : { data: [], error: null };
  if (commentResult.error) throw new Error('Deal comments are temporarily unavailable.');
  const commentCounts = (commentResult.data ?? []).reduce<Record<string, number>>((counts, row) => {
    counts[row.campaign_id] = (counts[row.campaign_id] ?? 0) + 1;
    return counts;
  }, {});

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Connect</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Your collaboration deals</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Publish deals, see which creators are interested, then start a direct conversation with the right person.</p></div>
      <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ color: '#fff' }} href="/brand/campaigns/new"><Plus className="size-4" />Add New Deal</Link>
    </div>

    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <Summary label="All deals" value={deals.length} />
      <Summary label="Live deals" value={deals.filter((deal) => deal.status === 'PUBLISHED').length} />
      <Summary label="Creator comments" value={Object.values(commentCounts).reduce((sum, count) => sum + count, 0)} />
    </section>

    {deals.length ? <section className="mt-6 grid gap-4" aria-label="Your deals">{deals.map((deal) => <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-200 hover:shadow-md" key={deal.id}>
      <div className="flex items-start gap-4"><span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl ${deal.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Radio className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${deal.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{deal.status}</span><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{deal.platform}</span></div><h2 className="mt-3 text-lg font-bold text-slate-950">{deal.title}</h2><p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{deal.description}</p><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500"><span>{formatInr(Number(deal.budget) + Number(deal.product_value))} total value</span><span className="inline-flex items-center gap-1"><MessageSquareText className="size-3.5" />{commentCounts[deal.id] ?? 0} comments</span><span>Created {formatDate(deal.created_at)}</span></div></div><Link className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-slate-950 group-hover:text-white" href={`/brand/connect/${deal.id}`} aria-label={`Open ${deal.title}`}><ArrowRight className="size-4" /></Link></div>
    </article>)}</section> : <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><EmptyState icon={Radio} title="No deals yet" description="Create your first deal, publish it, and it will appear in creators’ Connect feed." actionLabel="Add New Deal" actionHref="/brand/campaigns/new" /></section>}
  </AppShell>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><strong className="text-2xl font-bold text-slate-950">{value}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
