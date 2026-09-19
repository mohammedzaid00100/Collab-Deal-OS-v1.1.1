import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Messages' };

type Conversation = { id: string; campaign_id: string; creator_profile_id: string; updated_at: string };
type Creator = { id: string; full_name: string; username: string; niche: string };
type Campaign = { id: string; title: string };

export default async function BrandMessagesPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data: brand, error: brandError } = await supabase!.from('brand_profiles').select('id').eq('user_id', account.id).single();
  if (brandError || !brand) throw new Error('Brand profile is temporarily unavailable.');
  const { data, error } = await supabase!.from('conversations').select('id,campaign_id,creator_profile_id,updated_at').eq('brand_profile_id', brand.id).order('updated_at', { ascending: false });
  if (error) throw new Error('Messages are temporarily unavailable.');
  const conversations = (data ?? []) as Conversation[];
  const creatorIds = [...new Set(conversations.map((item) => item.creator_profile_id))];
  const campaignIds = [...new Set(conversations.map((item) => item.campaign_id))];
  const [creatorResult, campaignResult] = await Promise.all([
    creatorIds.length ? supabase!.from('creator_profiles').select('id,full_name,username,niche').in('id', creatorIds) : Promise.resolve({ data: [], error: null }),
    campaignIds.length ? supabase!.from('campaigns').select('id,title').in('id', campaignIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (creatorResult.error || campaignResult.error) throw new Error('Conversation details are temporarily unavailable.');
  const creators = new Map(((creatorResult.data ?? []) as Creator[]).map((item) => [item.id, item]));
  const campaigns = new Map(((campaignResult.data ?? []) as Campaign[]).map((item) => [item.id, item]));

  return (
    <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <div>
        <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Messages</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
          Creator conversations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5A5870] dark:text-[#9CA1BA]">
          Private conversations started from creators who commented on your deals.
        </p>
      </div>

      {conversations.length ? (
        <section className="mt-7 grid gap-4" aria-label="Creator conversations">
          {conversations.map((conversation) => {
            const creator = creators.get(conversation.creator_profile_id);
            const campaign = campaigns.get(conversation.campaign_id);
            return (
              <Link
                key={conversation.id}
                href={`/brand/messages/${conversation.id}`}
                className="group flex items-center gap-4 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:bg-[#FBF9F5] hover:shadow-[6px_6px_0_#0D0C1D] sm:p-5 dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] dark:hover:border-[#6366F1] dark:hover:bg-[#1C1E30]"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-base font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
                  {creator?.full_name?.slice(0, 1).toUpperCase() ?? 'C'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-base font-bold text-[#0D0C1D] transition-colors group-hover:text-[#4F46E5] dark:text-[#F3F4F8] dark:group-hover:text-[#818CF8]">
                      {creator?.full_name ?? 'Creator'}
                    </strong>
                    <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2.5 py-0.5 text-xs font-semibold text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                      {formatDate(conversation.updated_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">
                    @{creator?.username ?? 'creator'} · {creator?.niche ?? 'Creator'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2.5 py-1 text-xs font-medium text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                      <span className="font-bold text-[#4F46E5] dark:text-[#818CF8]">Deal:</span>
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
            description="Open one of your deals in Connect and message a creator who has commented."
            actionLabel="Open Connect"
            actionHref="/brand/connect"
          />
        </section>
      )}
    </AppShell>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
