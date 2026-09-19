import type { Metadata } from 'next';
import { ProductView } from '@/components/analytics/product-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Eye, Gauge, IndianRupee, MapPin, Sparkles, Target, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getCreatorDiscovery } from '@/lib/marketplace/feeds';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCompactNumber, formatInr } from '@/lib/utils';
import type { CreatorSocialMetric } from '@/types/marketplace';

export const metadata: Metadata = { title: 'Creator profile' };

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const creators = await getCreatorDiscovery(supabase!, id);
  const creator = creators[0];
  if (!creator) notFound();
  const topSocial = creator.socialAccounts[0];

  return (
    <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
      <ProductView event="creator viewed" />
      <Link
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#5A5870] transition-colors hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:text-[#F3F4F8]"
        href="/brand/creators"
      >
        <ArrowLeft className="size-4" />
        Back to Creator discovery
      </Link>
      <section className="mt-3 overflow-hidden rounded-[10px] border-2 border-[#0D0C1D] bg-white shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
        <div className="h-28 border-b-2 border-[#0D0C1D] bg-[#EEF2FF] dark:border-[#262A3D] dark:bg-[#1E1F3B]" />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <span
                className="flex size-24 items-center justify-center rounded-[10px] border-2 border-[#0D0C1D] bg-[#EEF2FF] bg-cover bg-center text-3xl font-bold text-[#4F46E5] shadow-[3px_3px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[3px_3px_0_#000000]"
                style={creator.avatarUrl ? { backgroundImage: `url(${JSON.stringify(creator.avatarUrl).slice(1, -1)})` } : undefined}
              >
                {!creator.avatarUrl ? creator.fullName.slice(0, 1).toUpperCase() : null}
              </span>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
                    {creator.fullName}
                  </h1>
                  {creator.bestMatchScore != null ? (
                    <span className="rounded-[6px] border-2 border-[#0D0C1D] bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-bold text-emerald-800 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#142A1E] dark:text-emerald-300 dark:shadow-none">
                      {creator.bestMatchScore}% match
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-semibold text-[#4F46E5] dark:text-[#818CF8]">
                  @{creator.username} · {creator.niche} · {creator.primaryContentFormat}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[#5A5870] dark:text-[#9CA1BA]">
                  <MapPin className="size-3.5 text-[#4F46E5] dark:text-[#818CF8]" />
                  {creator.location} · primary audience {creator.audienceRegion}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-sm font-semibold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]"
              style={{ color: '#fff' }}
              href={`/brand/offers/new?creator=${creator.creatorId}${creator.bestCampaignId ? `&campaign=${creator.bestCampaignId}` : ''}`}
            >
              <Sparkles className="size-4" />
              Create structured offer
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Creator metrics">
        <Metric
          icon={UsersRound}
          label={topSocial ? `${pretty(topSocial.platform)} ${topSocial.metric_label}` : 'Audience'}
          value={topSocial ? formatCompactNumber(Number(topSocial.audience_count)) : 'Unavailable'}
          status={topSocial?.metric_status}
        />
        <Metric
          icon={Gauge}
          label="Engagement rate"
          value={`${creator.engagementRate.toFixed(1)}%`}
          status={creator.engagementRateStatus}
        />
        <Metric
          icon={Eye}
          label="Average views"
          value={formatCompactNumber(creator.averageViews)}
          status={creator.averageViewsStatus}
        />
        <Metric
          icon={IndianRupee}
          label="Expected rate range"
          value={`${formatInr(creator.expectedRateLow)} – ${formatInr(creator.expectedRateHigh)}`}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="grid content-start gap-6">
          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
            <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Creator profile</p>
            <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
              About {creator.fullName.split(' ')[0]}
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#5A5870] dark:text-[#9CA1BA]">
              {creator.bio}
            </p>
          </section>

          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Declared & verified data</p>
                <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Platform presence</h2>
              </div>
              <span className="text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">
                Metrics are never guessed from URLs
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {creator.socialAccounts.map((social) => (
                <article
                  className="rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-4 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none"
                  key={social.platform}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
                        {pretty(social.platform)}
                      </strong>
                      <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#5A5870] dark:text-[#9CA1BA]">
                        {social.metric_status === 'API_VERIFIED' ? (
                          <BadgeCheck className="size-3.5 text-emerald-600" />
                        ) : null}
                        {statusLabel(social.metric_status)}
                      </span>
                    </div>
                    <strong className="text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
                      {formatCompactNumber(Number(social.audience_count))}
                    </strong>
                  </div>
                  {social.profile_url ? (
                    <a
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#4F46E5] hover:underline dark:text-[#818CF8]"
                      href={social.profile_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      Open profile
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-6">
          {creator.bestMatchScore != null ? (
            <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-[#F0FDF4] p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#142A1E] dark:shadow-[4px_4px_0_#000000]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-800 dark:text-emerald-300">
                    Best active campaign fit
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-emerald-950 dark:text-white">
                    {creator.bestMatchScore}%
                  </h2>
                </div>
                <Target className="size-7 text-emerald-600" />
              </div>
              {creator.bestCampaignId ? (
                <Link
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:underline dark:text-emerald-300"
                  href={`/brand/campaigns/${creator.bestCampaignId}`}
                >
                  View matched campaign
                  <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
            </section>
          ) : (
            <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
              <p className="text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">Campaign match</p>
              <h2 className="mt-1 font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">No active score yet</h2>
              <p className="mt-2 text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
                Publish a campaign with aligned criteria to generate a campaign-specific score.
              </p>
            </section>
          )}

          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
            <p className="text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">Work samples</p>
            <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Portfolio links</h2>
            <div className="mt-4 grid gap-2">
              {creator.portfolioUrl ? <ExternalLink href={creator.portfolioUrl} label="Open portfolio" /> : null}
              {creator.mediaKitUrl ? <ExternalLink href={creator.mediaKitUrl} label="Open media kit" /> : null}
              {!creator.portfolioUrl && !creator.mediaKitUrl ? (
                <p className="text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
                  No portfolio or media kit link has been provided.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-[#0D0C1D] p-5 text-white shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#111326] dark:shadow-[4px_4px_0_#000000]">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#818CF8]">No chat required</p>
            <h2 className="mt-2 text-base font-bold">Start with complete terms</h2>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Create an offer with cash, product value, deliverables, rights, deadlines, and exclusivity. Every later change becomes a structured revision.
            </p>
            <Link
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#262A3D]"
              href={`/brand/offers/new?creator=${creator.creatorId}${creator.bestCampaignId ? `&campaign=${creator.bestCampaignId}` : ''}`}
            >
              Create offer
              <ArrowUpRight className="size-3.5" />
            </Link>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
  status?: CreatorSocialMetric['metric_status'];
}) {
  return (
    <div className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">{label}</span>
        <span className="flex size-7 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
          <Icon className="size-3.5" />
        </span>
      </div>
      <strong className="mt-3 block truncate text-xl font-bold tracking-[-0.03em] text-[#0D0C1D] dark:text-[#F3F4F8]">
        {value}
      </strong>
      {status ? (
        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#5A5870] dark:text-[#9CA1BA]">
          {status === 'API_VERIFIED' ? <BadgeCheck className="size-3.5 text-emerald-600" /> : null}
          {statusLabel(status)}
        </span>
      ) : (
        <span className="mt-1 block text-[11px] text-[#5A5870] dark:text-[#9CA1BA]">Creator expected range</span>
      )}
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="flex min-h-11 items-center justify-between rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] px-3 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#F3F4F8] dark:shadow-none"
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
    >
      {label}
      <ArrowUpRight className="size-4" />
    </a>
  );
}

function statusLabel(value: CreatorSocialMetric['metric_status']) {
  return value === 'API_VERIFIED' ? 'API Verified' : value === 'CREATOR_DECLARED' ? 'Creator Declared' : 'Unavailable';
}

function pretty(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
