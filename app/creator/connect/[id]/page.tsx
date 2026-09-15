import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeIndianRupee, Building2, CalendarDays, MessageSquareText, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { CommentComposer } from '@/components/connect/comment-composer';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatInr } from '@/lib/utils';

export const metadata: Metadata = { title: 'Connect deal' };

type CampaignRow = {
  id: string; brand_profile_id: string; title: string; description: string; status: string; platform: string;
  target_creator_niche: string; target_location: string | null; budget: number; product_name: string | null;
  product_value: number; deal_type: string; objective: string; starts_at: string | null; ends_at: string | null;
  submission_deadline: string | null; usage_rights: string | null; usage_duration_days: number | null;
  paid_ad_rights: boolean; exclusivity: boolean; exclusivity_duration_days: number | null; territory: string | null;
  additional_requirements: string | null; created_at: string;
};
type BrandRow = { brand_name: string; industry: string; description: string; location: string; website: string };
type CommentRow = { id: string; body: string; created_at: string; creator_profile_id: string };
type CreatorRow = { id: string; full_name: string; username: string };

export default async function CreatorConnectDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();

  const [{ data: profile, error: profileError }, { data: dealData, error: dealError }] = await Promise.all([
    supabase!.from('creator_profiles').select('id').eq('user_id', account.id).single(),
    supabase!.from('campaigns').select('*').eq('id', id).eq('status', 'PUBLISHED').maybeSingle(),
  ]);
  if (profileError || !profile) throw new Error('Creator profile is temporarily unavailable.');
  if (dealError) throw new Error('Deal details are temporarily unavailable.');
  if (!dealData) notFound();
  const deal = dealData as CampaignRow;

  const [brandResult, commentsResult] = await Promise.all([
    supabase!.from('brand_profiles').select('brand_name,industry,description,location,website').eq('id', deal.brand_profile_id).single(),
    supabase!.from('campaign_comments').select('id,body,created_at,creator_profile_id').eq('campaign_id', id).order('created_at', { ascending: false }),
  ]);
  if (brandResult.error || commentsResult.error) throw new Error('Connect details are temporarily unavailable.');
  const brand = brandResult.data as BrandRow;
  const comments = (commentsResult.data ?? []) as CommentRow[];
  const creatorIds = [...new Set(comments.map((comment) => comment.creator_profile_id))];
  const creatorsResult = creatorIds.length ? await supabase!.from('creator_profiles').select('id,full_name,username').in('id', creatorIds) : { data: [], error: null };
  if (creatorsResult.error) throw new Error('Creator comments are temporarily unavailable.');
  const creators = new Map(((creatorsResult.data ?? []) as CreatorRow[]).map((creator) => [creator.id, creator]));

  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950" href="/creator/connect"><ArrowLeft className="size-4" />Connect</Link>
    <div className="mt-3 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
      <div className="min-w-0">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Live deal</span><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{deal.platform} · {deal.deal_type.replaceAll('_', ' ')}</span></div><h1 className="mt-4 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">{deal.title}</h1><p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{deal.description}</p><dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Objective" value={deal.objective} /><Detail label="Creator niche" value={deal.target_creator_niche} /><Detail label="Target location" value={deal.target_location ?? 'Open'} /><Detail label="Timeline" value={formatRange(deal.starts_at, deal.ends_at)} /><Detail label="Deadline" value={deal.submission_deadline ? formatDate(deal.submission_deadline) : 'Not set'} /><Detail label="Territory" value={deal.territory ?? 'Not specified'} /></dl></section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-950">Terms and conditions</h2></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Detail label="Usage rights" value={deal.usage_rights ?? 'Not specified'} /><Detail label="Usage duration" value={deal.usage_duration_days != null ? `${deal.usage_duration_days} days` : 'Not specified'} /><Detail label="Paid advertising" value={deal.paid_ad_rights ? 'Included' : 'Not included'} /><Detail label="Exclusivity" value={deal.exclusivity ? `${deal.exclusivity_duration_days ?? '—'} days` : 'Not included'} /></dl>{deal.additional_requirements ? <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">{deal.additional_requirements}</p> : null}</section>
        <section className="mt-6"><CommentComposer campaignId={deal.id} creatorProfileId={profile.id} /></section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><MessageSquareText className="size-5 text-violet-600" /><h2 className="text-lg font-bold text-slate-950">Creator comments</h2></div>{comments.length ? <div className="mt-5 grid gap-3">{comments.map((comment) => { const creator = creators.get(comment.creator_profile_id); return <article className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={comment.id}><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{creator?.full_name ?? 'Creator'}</strong><span className="text-[11px] text-slate-400">{formatDate(comment.created_at)}</span></div>{creator ? <p className="mt-0.5 text-[11px] text-violet-600">@{creator.username}</p> : null}<p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{comment.body}</p></article>; })}</div> : <p className="mt-4 text-sm text-slate-500">No comments yet. You can be the first creator to show interest.</p>}</section>
      </div>
      <aside className="grid content-start gap-5 xl:sticky xl:top-24"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Brand</p><strong className="text-sm text-slate-950">{brand.brand_name}</strong></div></div><p className="mt-4 text-xs leading-5 text-slate-500">{brand.description}</p><p className="mt-3 text-xs text-slate-400">{brand.industry} · {brand.location}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-400"><BadgeIndianRupee className="size-4" />Deal value</div><strong className="mt-3 block text-3xl font-bold text-slate-950">{formatInr(Number(deal.budget) + Number(deal.product_value))}</strong><p className="mt-2 text-xs text-slate-500">{formatInr(Number(deal.budget))} cash{deal.product_name ? ` · ${deal.product_name}` : ''}</p></section></aside>
    </div>
  </AppShell>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold leading-6 text-slate-700">{value}</dd></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
function formatRange(start: string | null, end: string | null) { if (!start && !end) return 'Not specified'; if (start && end) return `${formatDate(start)} – ${formatDate(end)}`; return formatDate(start ?? end!); }
