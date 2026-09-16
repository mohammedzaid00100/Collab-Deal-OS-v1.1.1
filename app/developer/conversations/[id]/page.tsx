import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessagesSquare, ShieldAlert } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { requireDeveloperAccess } from '@/lib/developer/access';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Developer conversation' };
export const dynamic = 'force-dynamic';

type Conversation = { id: string; campaign_id: string; brand_profile_id: string; creator_profile_id: string; created_at: string; updated_at: string };
type Message = { id: string; sender_user_id: string; body: string; created_at: string };

export default async function DeveloperConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDeveloperAccess();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  if (!supabase) return <State title="Developer data access is not configured" />;

  const { data: conversationData, error } = await supabase
    .from('conversations')
    .select('id,campaign_id,brand_profile_id,creator_profile_id,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !conversationData) return <State title="Conversation not found" />;
  const conversation = conversationData as Conversation;

  const [brandResult, creatorResult, campaignResult, messagesResult] = await Promise.all([
    supabase.from('brand_profiles').select('brand_name,user_id').eq('id', conversation.brand_profile_id).maybeSingle(),
    supabase.from('creator_profiles').select('full_name,username,user_id').eq('id', conversation.creator_profile_id).maybeSingle(),
    supabase.from('campaigns').select('title,status,budget,currency').eq('id', conversation.campaign_id).maybeSingle(),
    supabase.from('conversation_messages').select('id,sender_user_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
  ]);

  const brand = brandResult.data as { brand_name?: string; user_id?: string } | null;
  const creator = creatorResult.data as { full_name?: string; username?: string; user_id?: string } | null;
  const campaign = campaignResult.data as { title?: string; status?: string; budget?: number; currency?: string } | null;
  const messages = (messagesResult.data ?? []) as Message[];

  return <main className="min-h-svh bg-[#070b14] text-slate-100">
    <header className="border-b border-slate-800 bg-[#090e19]/95 px-5 py-4"><div className="mx-auto flex w-full max-w-5xl items-center justify-between"><BrandLogo /><Link className="text-xs font-bold text-slate-400 hover:text-white" href="/developer">Developer Tool</Link></div></header>
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:py-10">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white" href="/developer"><ArrowLeft className="size-4" />Back to developer dashboard</Link>

      <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-400">Private deal conversation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-white">{brand?.brand_name ?? 'Brand'} ↔ {creator?.full_name ?? 'Creator'}</h1>
        <p className="mt-2 text-sm text-slate-400">{campaign?.title ?? 'Campaign'} · {campaign?.status ?? 'Unknown'} · Budget ₹{Number(campaign?.budget ?? 0).toLocaleString('en-IN')}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-lg bg-slate-950 px-3 py-2">Brand: {brand?.brand_name ?? 'Unknown'}</span><span className="rounded-lg bg-slate-950 px-3 py-2">Creator: @{creator?.username ?? 'unknown'}</span><span className="rounded-lg bg-slate-950 px-3 py-2">Messages: {messages.length}</span></div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4"><MessagesSquare className="size-5 text-violet-400" /><div><h2 className="font-bold text-white">Full message history</h2><p className="text-xs text-slate-500">Read-only operator view</p></div></div>
        <div className="grid min-h-[420px] gap-3 p-4 sm:p-5">
          {messages.length ? messages.map((message) => {
            const senderIsBrand = message.sender_user_id === brand?.user_id;
            const sender = senderIsBrand ? brand?.brand_name ?? 'Brand' : message.sender_user_id === creator?.user_id ? creator?.full_name ?? 'Creator' : 'Participant';
            return <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4" key={message.id}><div className="flex items-center justify-between gap-4"><strong className={senderIsBrand ? 'text-blue-300' : 'text-violet-300'}>{sender}</strong><span className="text-[10px] text-slate-600">{formatDate(message.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.body}</p></article>;
          }) : <div className="m-auto text-center"><MessagesSquare className="mx-auto size-8 text-slate-700" /><p className="mt-3 text-sm text-slate-500">No messages in this conversation yet.</p></div>}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-violet-900/40 bg-violet-950/20 p-4"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-violet-400" /><p className="text-xs leading-5 text-violet-300/80">Internal operator access to private DMs should be restricted, audited and disclosed before a production launch. This prototype view is read-only.</p></div></section>
    </div>
  </main>;
}

function State({ title }: { title: string }) {
  return <main className="flex min-h-svh items-center justify-center bg-[#070b14] p-6 text-slate-100"><div className="text-center"><BrandLogo /><h1 className="mt-8 text-2xl font-bold">{title}</h1><Link className="mt-5 inline-block text-sm font-bold text-violet-400" href="/developer">Return to Developer Tool</Link></div></main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
