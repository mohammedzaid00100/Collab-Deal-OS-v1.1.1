import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { MessageComposer } from '@/components/messages/message-composer';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Conversation' };

type Conversation = { id: string; campaign_id: string; brand_profile_id: string; creator_profile_id: string };
type Message = { id: string; sender_user_id: string; body: string; created_at: string };

export default async function CreatorConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();

  const { data: conversationData, error } = await supabase!.from('conversations').select('id,campaign_id,brand_profile_id,creator_profile_id').eq('id', id).maybeSingle();
  if (error) throw new Error('Conversation is temporarily unavailable.');
  if (!conversationData) notFound();
  const conversation = conversationData as Conversation;

  const [brandResult, campaignResult, messagesResult] = await Promise.all([
    supabase!.from('brand_profiles').select('brand_name,industry,location').eq('id', conversation.brand_profile_id).single(),
    supabase!.from('campaigns').select('title').eq('id', conversation.campaign_id).single(),
    supabase!.from('conversation_messages').select('id,sender_user_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: true }),
  ]);
  if (brandResult.error || campaignResult.error || messagesResult.error) throw new Error('Conversation details are temporarily unavailable.');
  const brand = brandResult.data;
  const messages = (messagesResult.data ?? []) as Message[];

  return (
    <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
      <Link
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#5A5870] transition-colors hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:text-[#F3F4F8]"
        href="/creator/messages"
      >
        <ArrowLeft className="size-4" />
        Back to Messages
      </Link>
      <section className="mt-3 overflow-hidden rounded-[10px] border-2 border-[#0D0C1D] bg-white shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
        <header className="flex items-center gap-3 border-b-2 border-[#0D0C1D] px-4 py-4 dark:border-[#262A3D] sm:px-5">
          <span className="flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EFF6FF] font-bold text-[#2563EB] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E293B] dark:text-[#60A5FA] dark:shadow-[2px_2px_0_#000000]">
            {brand.brand_name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{brand.brand_name}</h1>
            <p className="truncate text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">
              {brand.industry} · {brand.location}
            </p>
          </div>
          <Link
            className="inline-flex min-h-9 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3 text-xs font-semibold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]"
            href={`/creator/connect/${conversation.campaign_id}`}
          >
            View deal
          </Link>
        </header>
        <div className="border-b-2 border-[#0D0C1D] bg-[#F5F2EA] px-4 py-2 text-xs font-medium text-[#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] sm:px-5">
          <span className="font-bold text-[#4F46E5] dark:text-[#818CF8]">Deal:</span> {campaignResult.data.title}
        </div>
        <div className="min-h-[420px] max-h-[62vh] overflow-y-auto p-4 sm:p-5">
          {messages.length ? (
            <div className="grid gap-3">
              {messages.map((message) => {
                const own = message.sender_user_id === account.id;
                return (
                  <div className={`flex ${own ? 'justify-end' : 'justify-start'}`} key={message.id}>
                    <div
                      className={`max-w-[80%] rounded-[10px] border-2 border-[#0D0C1D] px-4 py-3 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] ${
                        own
                          ? 'bg-[#4F46E5] text-white dark:bg-[#6366F1]'
                          : 'bg-[#F5F2EA] text-[#0D0C1D] dark:bg-[#1E2134] dark:text-[#F3F4F8]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                      <span className={`mt-1 block text-[11px] ${own ? 'text-indigo-100' : 'text-[#5A5870] dark:text-[#9CA1BA]'}`}>
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <span className="flex size-12 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EFF6FF] text-[#2563EB] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E293B] dark:text-[#60A5FA] dark:shadow-[2px_2px_0_#000000]">
                <MessageCircle className="size-6" />
              </span>
              <h2 className="mt-3 text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">The brand opened this conversation</h2>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
                Reply here to discuss collaboration details and next steps.
              </p>
            </div>
          )}
        </div>
        <MessageComposer conversationId={conversation.id} senderUserId={account.id} />
      </section>
    </AppShell>
  );
}

function formatTime(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
