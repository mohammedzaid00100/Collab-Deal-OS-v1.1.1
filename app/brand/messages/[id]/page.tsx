import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { MessageComposer } from '@/components/messages/message-composer';
import { ServiceState } from '@/components/ui/service-state';
import { PayCreatorPrototype } from '@/components/wallet/pay-creator-prototype';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Conversation' };

type Conversation = { id: string; campaign_id: string; brand_profile_id: string; creator_profile_id: string };
type Message = { id: string; sender_user_id: string; body: string; created_at: string };

export default async function BrandConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();

  const { data: conversationData, error } = await supabase!.from('conversations').select('id,campaign_id,brand_profile_id,creator_profile_id').eq('id', id).maybeSingle();
  if (error) throw new Error('Conversation is temporarily unavailable.');
  if (!conversationData) notFound();
  const conversation = conversationData as Conversation;

  const [creatorResult, campaignResult, messagesResult] = await Promise.all([
    supabase!.from('creator_profiles').select('full_name,username,niche,location').eq('id', conversation.creator_profile_id).single(),
    supabase!.from('campaigns').select('title').eq('id', conversation.campaign_id).single(),
    supabase!.from('conversation_messages').select('id,sender_user_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
  ]);
  if (creatorResult.error || campaignResult.error || messagesResult.error) throw new Error('Conversation details are temporarily unavailable.');
  const creator = creatorResult.data;
  const messages = (messagesResult.data ?? []) as Message[];

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950" href="/brand/messages"><ArrowLeft className="size-4" />Messages</Link>
    <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-blue-100 font-bold text-violet-700">{creator.full_name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><h1 className="truncate text-sm font-bold text-slate-950">{creator.full_name}</h1><p className="truncate text-xs text-slate-500">@{creator.username} · {creator.niche} · {creator.location}</p></div><div className="flex items-center gap-2"><Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" href={`/brand/connect/${conversation.campaign_id}`}>View deal</Link><PayCreatorPrototype creatorName={creator.full_name} conversationId={conversation.id} campaignId={conversation.campaign_id} creatorProfileId={conversation.creator_profile_id} /></div></header>
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500 sm:px-5">Deal: {campaignResult.data.title} · Payment is currently prototype-only.</div>
      <div className="min-h-[420px] max-h-[62vh] overflow-y-auto p-4 sm:p-5">{messages.length ? <div className="grid gap-3">{messages.map((message) => { const own = message.sender_user_id === account.id; return <div className={`flex ${own ? 'justify-end' : 'justify-start'}`} key={message.id}><div className={`max-w-[80%] rounded-2xl px-4 py-3 ${own ? 'rounded-br-md bg-slate-950 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`} style={own ? { color: '#fff' } : undefined}><p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p><span className={`mt-1 block text-[10px] ${own ? 'text-slate-400' : 'text-slate-400'}`}>{formatTime(message.created_at)}</span></div></div>; })}</div> : <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><MessageCircle className="size-8 text-slate-300" /><h2 className="mt-3 text-sm font-bold text-slate-800">Start the conversation</h2><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Discuss the deal details, expectations, timeline, and next steps here. When the deal is finalized, use Pay Creator above.</p></div>}</div>
      <MessageComposer conversationId={conversation.id} senderUserId={account.id} />
    </section>
  </AppShell>;
}

function formatTime(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
