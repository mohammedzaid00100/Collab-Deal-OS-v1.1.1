import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Messages' };

type Conversation = { id: string; campaign_id: string; brand_profile_id: string; updated_at: string };
type Brand = { id: string; brand_name: string; industry: string };
type Campaign = { id: string; title: string };

export default async function CreatorMessagesPage() {
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data: creator, error: creatorError } = await supabase!.from('creator_profiles').select('id').eq('user_id', account.id).single();
  if (creatorError || !creator) throw new Error('Creator profile is temporarily unavailable.');
  const { data, error } = await supabase!.from('conversations').select('id,campaign_id,brand_profile_id,updated_at').eq('creator_profile_id', creator.id).order('updated_at', { ascending: false });
  if (error) throw new Error('Messages are temporarily unavailable.');
  const conversations = (data ?? []) as Conversation[];
  const brandIds = [...new Set(conversations.map((item) => item.brand_profile_id))];
  const campaignIds = [...new Set(conversations.map((item) => item.campaign_id))];
  const [brandResult, campaignResult] = await Promise.all([
    brandIds.length ? supabase!.from('brand_profiles').select('id,brand_name,industry').in('id', brandIds) : Promise.resolve({ data: [], error: null }),
    campaignIds.length ? supabase!.from('campaigns').select('id,title').in('id', campaignIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (brandResult.error || campaignResult.error) throw new Error('Conversation details are temporarily unavailable.');
  const brands = new Map(((brandResult.data ?? []) as Brand[]).map((item) => [item.id, item]));
  const campaigns = new Map(((campaignResult.data ?? []) as Campaign[]).map((item) => [item.id, item]));

  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
    <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Messages</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Brand conversations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Private conversations with brands that contacted you after you commented on a deal.</p></div>
    {conversations.length ? <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{conversations.map((conversation, index) => { const brand = brands.get(conversation.brand_profile_id); const campaign = campaigns.get(conversation.campaign_id); return <Link className={`group flex items-center gap-4 p-4 transition hover:bg-slate-50 sm:p-5 ${index ? 'border-t border-slate-100' : ''}`} href={`/creator/messages/${conversation.id}`} key={conversation.id}><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-sm font-bold text-blue-700">{brand?.brand_name?.slice(0, 1).toUpperCase() ?? 'B'}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><strong className="truncate text-sm text-slate-950">{brand?.brand_name ?? 'Brand'}</strong><span className="text-[11px] text-slate-400">{formatDate(conversation.updated_at)}</span></div><p className="mt-0.5 truncate text-xs text-violet-600">{brand?.industry ?? 'Brand'}</p><p className="mt-1 truncate text-xs text-slate-500">Deal: {campaign?.title ?? 'Collaboration deal'}</p></div><ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-slate-700" /></Link>; })}</section> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><EmptyState icon={MessageCircle} title="No conversations yet" description="Comment on deals in Connect. If a brand wants to continue, its message will appear here." actionLabel="Browse Connect" actionHref="/creator/connect" /></section>}
  </AppShell>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
