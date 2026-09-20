import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { ConversationThread } from '@/components/messages/conversation-thread';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ConversationMessage } from '@/types/messaging';

export const metadata: Metadata = { title: 'Conversation' };

type Conversation = { id: string; campaign_id: string; brand_profile_id: string; creator_profile_id: string };

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
    supabase!.from('conversation_messages').select('id,sender_user_id,body,created_at,reply_to_message_id').eq('conversation_id', id).order('created_at', { ascending: true }),
  ]);
  if (creatorResult.error || campaignResult.error || messagesResult.error) throw new Error('Conversation details are temporarily unavailable.');
  const creator = creatorResult.data;
  const messages = (messagesResult.data ?? []) as ConversationMessage[];

  return (
    <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <Link
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#5A5870] transition-colors hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:text-[#F3F4F8]"
        href="/brand/messages"
      >
        <ArrowLeft className="size-4" />
        Back to Messages
      </Link>
      <section className="mt-3 overflow-hidden rounded-[10px] border-2 border-[#0D0C1D] bg-white shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
        <header className="flex flex-wrap items-center gap-3 border-b-2 border-[#0D0C1D] px-4 py-4 dark:border-[#262A3D] sm:px-5">
          <span className="flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
            {creator.full_name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{creator.full_name}</h1>
            <p className="truncate text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">
              @{creator.username} · {creator.niche} · {creator.location}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="inline-flex min-h-9 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3 text-xs font-semibold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]"
              href={`/brand/connect/${conversation.campaign_id}`}
            >
              View deal
            </Link>
          </div>
        </header>
        <div className="border-b-2 border-[#0D0C1D] bg-[#F5F2EA] px-4 py-2 text-xs font-medium text-[#0D0C1D] dark:border-[#262A3D] dark:bg-[#1C1E30] dark:text-[#9CA1BA] sm:px-5">
          <span className="font-bold text-[#4F46E5] dark:text-[#818CF8]">Deal:</span> {campaignResult.data.title}
        </div>
        <ConversationThread
          conversationId={conversation.id}
          currentUserId={account.id}
          otherPartyName={creator.full_name}
          initialMessages={messages}
          emptyState={{
            title: 'Start the conversation',
            description: 'Discuss the deal details, deliverables, timeline, and collaboration expectations here.',
            iconTheme: 'indigo',
          }}
        />
      </section>
    </AppShell>
  );
}
