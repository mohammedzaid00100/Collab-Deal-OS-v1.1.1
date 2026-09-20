import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Messages' };

type Conversation = {
  id: string;
  campaign_id: string;
  brand_profile_id: string | null;
  creator_profile_id: string;
  participant_creator_profile_id: string | null;
  conversation_type: 'BRAND_CREATOR' | 'CREATOR_CREATOR';
  updated_at: string;
};
type Brand = { id: string; brand_name: string; industry: string };
type OtherCreator = { id: string; full_name: string; username: string; niche: string };
type Campaign = { id: string; title: string };

export default async function CreatorMessagesPage() {
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data: creator, error: creatorError } = await supabase!.from('creator_profiles').select('id').eq('user_id', account.id).single();
  if (creatorError || !creator) throw new Error('Creator profile is temporarily unavailable.');
  const { data, error } = await supabase!
    .from('conversations')
    .select('id,campaign_id,brand_profile_id,creator_profile_id,participant_creator_profile_id,conversation_type,updated_at')
    .or(`creator_profile_id.eq.${creator.id},participant_creator_profile_id.eq.${creator.id}`)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('Messages are temporarily unavailable.');
  const conversations = (data ?? []) as Conversation[];
  const brandIds = [...new Set(conversations.map((item) => item.brand_profile_id).filter(Boolean) as string[])];
  const otherCreatorIds = [
    ...new Set(
      conversations
        .filter((item) => item.conversation_type === 'CREATOR_CREATOR')
        .map((item) => (item.creator_profile_id === creator.id ? item.participant_creator_profile_id : item.creator_profile_id))
        .filter(Boolean) as string[]
    ),
  ];
  const campaignIds = [...new Set(conversations.map((item) => item.campaign_id))];
  const [brandResult, creatorResult, campaignResult] = await Promise.all([
    brandIds.length ? supabase!.from('brand_profiles').select('id,brand_name,industry').in('id', brandIds) : Promise.resolve({ data: [], error: null }),
    otherCreatorIds.length ? supabase!.from('creator_profiles').select('id,full_name,username,niche').in('id', otherCreatorIds) : Promise.resolve({ data: [], error: null }),
    campaignIds.length ? supabase!.from('campaigns').select('id,title').in('id', campaignIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (brandResult.error || creatorResult.error || campaignResult.error) throw new Error('Conversation details are temporarily unavailable.');
  const brands = new Map(((brandResult.data ?? []) as Brand[]).map((item) => [item.id, item]));
  const otherCreators = new Map(((creatorResult.data ?? []) as OtherCreator[]).map((item) => [item.id, item]));
  const campaigns = new Map(((campaignResult.data ?? []) as Campaign[]).map((item) => [item.id, item]));

  return (
    <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
      <div>
        <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Messages</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
          Conversations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5A5870] dark:text-[#9CA1BA]">
          Private conversations with brands and fellow creators from deals you commented on.
        </p>
      </div>

      {conversations.length ? (
        <section className="mt-7 grid gap-4" aria-label="Conversations">
          {conversations.map((conversation) => {
            const isCreatorConnect = conversation.conversation_type === 'CREATOR_CREATOR';
            const campaign = campaigns.get(conversation.campaign_id);

            let displayName = 'Conversation';
            let initial = 'C';
            let subtitle = '';
            let avatarClass = 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E293B] dark:text-[#60A5FA]';
            let badgeText = 'Brand';
            let badgeClass = 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E293B] dark:text-[#60A5FA]';

            if (isCreatorConnect) {
              const otherCreatorId = conversation.creator_profile_id === creator.id
                ? conversation.participant_creator_profile_id
                : conversation.creator_profile_id;
              const otherCreator = otherCreatorId ? otherCreators.get(otherCreatorId) : null;
              displayName = otherCreator?.full_name ?? 'Creator';
              initial = displayName.slice(0, 1).toUpperCase();
              subtitle = otherCreator ? `@${otherCreator.username}${otherCreator.niche ? ` · ${otherCreator.niche}` : ''}` : 'Creator';
              avatarClass = 'bg-[#ECFDF5] text-[#059669] dark:bg-[#064E3B]/40 dark:text-[#34D399]';
              badgeText = 'Creator';
              badgeClass = 'bg-[#ECFDF5] text-[#059669] dark:bg-[#064E3B]/40 dark:text-[#34D399]';
            } else {
              const brand = conversation.brand_profile_id ? brands.get(conversation.brand_profile_id) : null;
              displayName = brand?.brand_name ?? 'Brand';
              initial = displayName.slice(0, 1).toUpperCase();
              subtitle = brand?.industry ?? 'Brand';
            }

            return (
              <Link
                key={conversation.id}
                href={`/creator/messages/${conversation.id}`}
                className="group flex items-center gap-4 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:bg-[#FBF9F5] hover:shadow-[6px_6px_0_#0D0C1D] sm:p-5 dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] dark:hover:border-[#6366F1] dark:hover:bg-[#1C1E30]"
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] text-base font-bold shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:shadow-[2px_2px_0_#000000] ${avatarClass}`}>
                  {initial}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-base font-bold text-[#0D0C1D] transition-colors group-hover:text-[#4F46E5] dark:text-[#F3F4F8] dark:group-hover:text-[#818CF8]">
                        {displayName}
                      </strong>
                      <span className={`rounded-[4px] border border-[#0D0C1D] px-1.5 py-0.5 text-[10px] font-bold shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:shadow-none ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                    <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2.5 py-0.5 text-xs font-semibold text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                      {formatDate(conversation.updated_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">
                    {subtitle}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2.5 py-1 text-xs font-medium text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                      <span className="font-bold text-[#4F46E5] dark:text-[#818CF8]">{isCreatorConnect ? 'From deal:' : 'Deal:'}</span>
                      <span className="truncate">{campaign?.title ?? 'Collaboration deal'}</span>
                    </span>
                  </div>
                </div>
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all group-hover:bg-[#4F46E5] group-hover:text-white sm:size-10 dark:border-[#262A3D] dark:bg-[#11131E] dark:text-slate-300 dark:shadow-[2px_2px_0_#000000] dark:group-hover:bg-[#6366F1] dark:group-hover:text-white"
                  aria-hidden="true"
                >
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="mt-7 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet"
            description="Comment on deals in Connect to start conversations with brands or fellow creators."
            actionLabel="Browse Connect"
            actionHref="/creator/connect"
          />
        </section>
      )}
    </AppShell>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
