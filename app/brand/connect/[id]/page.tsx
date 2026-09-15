import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeIndianRupee, MessageSquareText, UserRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { StartConversationButton } from '@/components/connect/start-conversation-button';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Connect deal' };

type CampaignRow = {
  id: string; brand_profile_id: string; title: string; description: string; status: string; platform: string;
  budget: number; product_value: number; deal_type: string; target_creator_niche: string; created_at: string;
};
type CommentRow = { id: string; creator_profile_id: string; body: string; created_at: string };
type CreatorRow = {
  id: string; full_name: string; username: string; bio: string; niche: string; location: string;
  average_views: number; engagement_rate: number; expected_rate_low: number; expected_rate_high: number;
};

export default async function BrandConnectDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();

  const { data: brandProfile, error: profileError } = await supabase!.from('brand_profiles').select('id').eq('user_id', account.id).single();
  if (profileError || !brandProfile) throw new Error('Brand profile is temporarily unavailable.');
  const { data: dealData, error: dealError } = await supabase!.from('campaigns').select('id,brand_profile_id,title,description,status,platform,budget,product_value,deal_type,target_creator_niche,created_at').eq('id', id).eq('brand_profile_id', brandProfile.id).maybeSingle();
  if (dealError) throw new Error('Deal details are temporarily unavailable.');
  if (!dealData) notFound();
  const deal = dealData as CampaignRow;

  const { data: commentsData, error: commentsError } = await supabase!.from('campaign_comments').select('id,creator_profile_id,body,created_at').eq('campaign_id', id).order('created_at', { ascending: false });
  if (commentsError) throw new Error('Creator comments are temporarily unavailable.');
  const comments = (commentsData ?? []) as CommentRow[];
  const creatorIds = [...new Set(comments.map((comment) => comment.creator_profile_id))];
  const creatorResult = creatorIds.length
    ? await supabase!.from('creator_profiles').select('id,full_name,username,bio,niche,location,average_views,engagement_rate,expected_rate_low,expected_rate_high').in('id', creatorIds)
    : { data: [], error: null };
  if (creatorResult.error) throw new Error('Creator profiles are temporarily unavailable.');
  const creators = new Map(((creatorResult.data ?? []) as CreatorRow[]).map((creator) => [creator.id, creator]));

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950" href="/brand/connect"><ArrowLeft className="size-4" />Connect</Link>
    <div className="mt-3 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${deal.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{deal.status}</span><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{deal.platform} · {deal.deal_type.replaceAll('_', ' ')}</span></div><h1 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">{deal.title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{deal.description}</p></div><div className="rounded-xl bg-slate-950 px-4 py-3 text-white"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Total value</span><strong className="block text-lg">{formatInr(Number(deal.budget) + Number(deal.product_value))}</strong></div></div>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Interest</p><h2 className="mt-1 text-lg font-bold text-slate-950">Creator comments</h2><p className="mt-1 text-xs leading-5 text-slate-500">Review creators who showed interest. Open their profile details here and start a private conversation when there is a fit.</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><MessageSquareText className="size-5" /></span></div>
      {comments.length ? <div className="mt-5 grid gap-4">{comments.map((comment) => {
        const creator = creators.get(comment.creator_profile_id);
        return <article className="rounded-2xl border border-slate-200 p-4 sm:p-5" key={comment.id}><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><div><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 font-bold text-violet-700"><UserRound className="size-5" /></span><div><h3 className="font-bold text-slate-950">{creator?.full_name ?? 'Creator'}</h3>{creator ? <p className="mt-0.5 text-xs text-violet-700">@{creator.username} · {creator.niche} · {creator.location}</p> : null}</div></div><p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{comment.body}</p><p className="mt-3 text-[11px] text-slate-400">Commented {formatDate(comment.created_at)}</p></div>{creator ? <aside className="rounded-xl bg-slate-50 p-4"><p className="line-clamp-3 text-xs leading-5 text-slate-500">{creator.bio}</p><dl className="mt-3 grid grid-cols-2 gap-3"><Mini label="Avg. views" value={formatCompact(creator.average_views)} /><Mini label="Engagement" value={`${creator.engagement_rate}%`} /><Mini label="Rate from" value={formatInr(creator.expected_rate_low)} /><Mini label="Rate to" value={formatInr(creator.expected_rate_high)} /></dl><div className="mt-4 flex flex-wrap gap-2"><Link className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800" href={`/brand/creators/${creator.id}`}>View profile</Link><StartConversationButton campaignId={deal.id} creatorProfileId={creator.id} /></div></aside> : null}</div></article>;
      })}</div> : <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center"><MessageSquareText className="mx-auto size-6 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-700">No creator comments yet</p><p className="mt-1 text-xs text-slate-500">Once creators comment on this deal, they will appear here.</p></div>}
    </section>

    <section className="mt-6 grid gap-3 sm:grid-cols-3"><Info label="Creator niche" value={deal.target_creator_niche} /><Info label="Cash value" value={formatInr(Number(deal.budget))} /><Info label="Posted" value={formatDate(deal.created_at)} /></section>
  </AppShell>;
}

function Mini({ label, value }: { label: string; value: string }) { return <div><dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1 text-xs font-semibold text-slate-700">{value}</dd></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</span><strong className="mt-1 block text-sm text-slate-900">{value}</strong></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
function formatCompact(value: number) { return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
