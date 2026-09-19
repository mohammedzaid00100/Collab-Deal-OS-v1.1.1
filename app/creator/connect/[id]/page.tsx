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

  return (
    <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
      <Link
        className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3.5 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none dark:border-[#383E5E] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]"
        href="/creator/connect"
      >
        <ArrowLeft className="size-4" />
        Back to live deals
      </Link>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-[6px] border-2 border-[#0D0C1D] bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-[#059669] shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#064E3B]/40 dark:text-[#34D399] dark:shadow-[1.5px_1.5px_0_#000000]">
                Live deal
              </span>
              <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E2134] dark:text-[#9CA1BA] dark:shadow-none">
                {deal.platform} · {deal.deal_type.replaceAll('_', ' ')}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl lg:text-4xl dark:text-[#F3F4F8]">
              {deal.title}
            </h1>
            <p className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-[#5A5870] dark:text-[#9CA1BA]">
              {deal.description}
            </p>
            <dl className="mt-6 grid gap-4 border-t-2 border-[#0D0C1D] pt-5 dark:border-[#383E5E] sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Objective" value={deal.objective} />
              <Detail label="Creator niche" value={deal.target_creator_niche} />
              <Detail label="Target location" value={deal.target_location ?? 'Open'} />
              <Detail label="Timeline" value={formatRange(deal.starts_at, deal.ends_at)} />
              <Detail label="Deadline" value={deal.submission_deadline ? formatDate(deal.submission_deadline) : 'Not set'} />
              <Detail label="Territory" value={deal.territory ?? 'Not specified'} />
            </dl>
          </section>

          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#ECFDF5] text-[#059669] shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#064E3B]/40 dark:text-[#34D399] dark:shadow-[1.5px_1.5px_0_#000000]">
                <ShieldCheck className="size-4" />
              </span>
              <h2 className="text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Terms and conditions</h2>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Usage rights" value={deal.usage_rights ?? 'Not specified'} />
              <Detail label="Usage duration" value={deal.usage_duration_days != null ? `${deal.usage_duration_days} days` : 'Not specified'} />
              <Detail label="Paid advertising" value={deal.paid_ad_rights ? 'Included' : 'Not included'} />
              <Detail label="Exclusivity" value={deal.exclusivity ? `${deal.exclusivity_duration_days ?? '—'} days` : 'Not included'} />
            </dl>
            {deal.additional_requirements ? (
              <p className="mt-5 border-t border-dashed border-[#0D0C1D]/20 pt-4 text-sm font-medium leading-6 text-[#5A5870] dark:border-[#383E5E] dark:text-[#9CA1BA]">
                {deal.additional_requirements}
              </p>
            ) : null}
          </section>

          <section>
            <CommentComposer campaignId={deal.id} creatorProfileId={profile.id} />
          </section>

          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E1F3B] dark:text-[#818CF8]">
                <MessageSquareText className="size-4" />
              </span>
              <h2 className="text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Creator comments</h2>
            </div>
            {comments.length ? (
              <div className="mt-5 grid gap-3">
                {comments.map((comment) => {
                  const creator = creators.get(comment.creator_profile_id);
                  return (
                    <article
                      className="rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-4 shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E2134] dark:shadow-[2px_2px_0_#000000]"
                      key={comment.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
                          {creator?.full_name ?? 'Creator'}
                        </strong>
                        <span className="rounded-[4px] border border-[#0D0C1D] bg-white px-2 py-0.5 text-[10px] font-bold text-[#5A5870] shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:text-[#9CA1BA] dark:shadow-none">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      {creator ? (
                        <p className="mt-1 text-xs font-bold text-[#4F46E5] dark:text-[#818CF8]">
                          @{creator.username}
                        </p>
                      ) : null}
                      <p className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-[#0D0C1D] dark:text-[#F3F4F8]">
                        {comment.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm font-medium text-[#5A5870] dark:text-[#9CA1BA]">
                No comments yet. You can be the first creator to show interest.
              </p>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-5 xl:sticky xl:top-24">
          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">Brand</p>
                <strong className="block truncate text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
                  {brand.brand_name}
                </strong>
              </div>
            </div>
            <p className="mt-4 text-xs font-medium leading-5 text-[#5A5870] dark:text-[#9CA1BA]">{brand.description}</p>
            <p className="mt-3 border-t border-dashed border-[#0D0C1D]/20 pt-3 text-xs font-semibold text-[#5A5870] dark:border-[#383E5E] dark:text-[#9CA1BA]">
              {brand.industry} · {brand.location}
            </p>
          </section>

          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">
              <BadgeIndianRupee className="size-4 text-[#4F46E5] dark:text-[#818CF8]" />
              Deal value
            </div>
            <strong className="mt-3 block text-3xl font-bold tracking-tight text-[#0D0C1D] dark:text-[#F3F4F8]">
              {formatInr(Number(deal.budget) + Number(deal.product_value))}
            </strong>
            <p className="mt-2 text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">
              {formatInr(Number(deal.budget))} cash{deal.product_name ? ` · ${deal.product_name}` : ''}
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">{label}</dt>
      <dd className="mt-1 text-sm font-bold leading-6 text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return 'Not specified';
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end!);
}
