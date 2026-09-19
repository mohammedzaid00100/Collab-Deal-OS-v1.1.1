'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Filter, MapPin, Search, Sparkles } from 'lucide-react';
import { SelectInput, TextInput } from '@/components/ui/form-field';
import { formatCompactNumber, formatInr } from '@/lib/utils';
import type { CreatorDiscoveryItem, CreatorSocialMetric } from '@/types/marketplace';

export function CreatorDiscoveryBrowser({ creators }: { creators: CreatorDiscoveryItem[] }) {
  const [query, setQuery] = useState('');
  const [niche, setNiche] = useState('');
  const [platform, setPlatform] = useState('');
  const [location, setLocation] = useState('');
  const [minimumFollowers, setMinimumFollowers] = useState(0);
  const [maximumFollowers, setMaximumFollowers] = useState(0);
  const [minimumEngagement, setMinimumEngagement] = useState(0);
  const [minimumViews, setMinimumViews] = useState(0);
  const [minimumMatch, setMinimumMatch] = useState(0);
  const [sort, setSort] = useState('match');
  const niches = unique(creators.map((creator) => creator.niche));
  const platforms = unique(creators.flatMap((creator) => creator.socialAccounts.map((social) => pretty(social.platform))));

  const visible = useMemo(() => creators.filter((creator) => {
    const selectedSocial = platform
      ? creator.socialAccounts.find((social) => pretty(social.platform) === platform)
      : creator.socialAccounts[0];
    const followerValue = Number(selectedSocial?.audience_count ?? 0);
    return (!query || `${creator.fullName} ${creator.username} ${creator.niche}`.toLowerCase().includes(query.toLowerCase()))
      && (!niche || creator.niche === niche)
      && (!platform || Boolean(selectedSocial))
      && (!location || `${creator.location} ${creator.audienceRegion}`.toLowerCase().includes(location.toLowerCase()))
      && followerValue >= minimumFollowers
      && (!maximumFollowers || followerValue <= maximumFollowers)
      && creator.engagementRate >= minimumEngagement
      && creator.averageViews >= minimumViews
      && (creator.bestMatchScore ?? 0) >= minimumMatch;
  }).sort((left, right) => {
    if (sort === 'followers') return topFollowers(right) - topFollowers(left);
    if (sort === 'engagement') return right.engagementRate - left.engagementRate;
    if (sort === 'views') return right.averageViews - left.averageViews;
    if (sort === 'rate-low') return left.expectedRateLow - right.expectedRateLow;
    return (right.bestMatchScore ?? -1) - (left.bestMatchScore ?? -1);
  }), [creators, location, maximumFollowers, minimumEngagement, minimumFollowers, minimumMatch, minimumViews, niche, platform, query, sort]);

  const filtered = Boolean(query || niche || platform || location || minimumFollowers || maximumFollowers || minimumEngagement || minimumViews || minimumMatch);

  return (
    <>
      <section className="mt-6 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] sm:p-5 dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#0D0C1D] dark:text-[#F3F4F8]">
          <span className="flex size-6 items-center justify-center rounded-[4px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
            <Filter className="size-3.5" />
          </span>
          Compare creator fit
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="relative sm:col-span-2">
            <span className="sr-only">Search creators</span>
            <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[#5A5870] dark:text-[#9CA1BA]" />
            <TextInput
              className="pl-10 shadow-[2px_2px_0_#0D0C1D] dark:shadow-none"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, handle, or niche"
            />
          </label>
          <FilterSelect label="niches" value={niche} onChange={setNiche} options={niches} />
          <FilterSelect label="platforms" value={platform} onChange={setPlatform} options={platforms} />
          <label>
            <span className="sr-only">Creator location</span>
            <TextInput
              className="shadow-[2px_2px_0_#0D0C1D] dark:shadow-none"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location or audience region"
            />
          </label>
          <NumberFilter
            label="Minimum followers"
            value={minimumFollowers}
            onChange={setMinimumFollowers}
            options={[
              [0, 'Any followers'],
              [10_000, '10K+ followers'],
              [50_000, '50K+ followers'],
              [100_000, '100K+ followers'],
              [500_000, '500K+ followers'],
            ]}
          />
          <NumberFilter
            label="Maximum followers"
            value={maximumFollowers}
            onChange={setMaximumFollowers}
            options={[
              [0, 'No follower maximum'],
              [50_000, 'Up to 50K'],
              [100_000, 'Up to 100K'],
              [500_000, 'Up to 500K'],
              [1_000_000, 'Up to 1M'],
            ]}
          />
          <NumberFilter
            label="Minimum engagement"
            value={minimumEngagement}
            onChange={setMinimumEngagement}
            options={[
              [0, 'Any engagement'],
              [2, '2%+ engagement'],
              [4, '4%+ engagement'],
              [6, '6%+ engagement'],
              [10, '10%+ engagement'],
            ]}
          />
          <NumberFilter
            label="Minimum average views"
            value={minimumViews}
            onChange={setMinimumViews}
            options={[
              [0, 'Any average views'],
              [5_000, '5K+ avg. views'],
              [25_000, '25K+ avg. views'],
              [100_000, '100K+ avg. views'],
            ]}
          />
          <NumberFilter
            label="Minimum match"
            value={minimumMatch}
            onChange={setMinimumMatch}
            options={[
              [0, 'Any match score'],
              [60, '60%+ match'],
              [75, '75%+ match'],
              [90, '90%+ match'],
            ]}
          />
          <label>
            <span className="sr-only">Sort creators</span>
            <SelectInput
              className="shadow-[2px_2px_0_#0D0C1D] dark:shadow-none"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="match">Best campaign match</option>
              <option value="followers">Most followers</option>
              <option value="engagement">Highest engagement</option>
              <option value="views">Highest average views</option>
              <option value="rate-low">Lowest expected rate</option>
            </SelectInput>
          </label>
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">
          {visible.length} of {creators.length} discoverable creators
        </p>
        {filtered ? (
          <button
            className="rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] px-2.5 py-1 text-xs font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none"
            type="button"
            onClick={() => {
              setQuery('');
              setNiche('');
              setPlatform('');
              setLocation('');
              setMinimumFollowers(0);
              setMaximumFollowers(0);
              setMinimumEngagement(0);
              setMinimumViews(0);
              setMinimumMatch(0);
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {visible.length ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Creator discovery results">
          {visible.map((creator) => (
            <article
              className="group rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:bg-[#FBF9F5] hover:shadow-[6px_6px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] dark:hover:border-[#6366F1] dark:hover:bg-[#1C1E30]"
              key={creator.creatorId}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] bg-cover bg-center text-base font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]"
                  style={creator.avatarUrl ? { backgroundImage: `url(${JSON.stringify(creator.avatarUrl).slice(1, -1)})` } : undefined}
                >
                  {!creator.avatarUrl ? creator.fullName.slice(0, 1).toUpperCase() : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="truncate text-base font-bold text-[#0D0C1D] transition-colors group-hover:text-[#4F46E5] dark:text-[#F3F4F8] dark:group-hover:text-[#818CF8]">
                        {creator.fullName}
                      </h2>
                      <p className="mt-0.5 truncate text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8]">
                        @{creator.username} · {creator.niche}
                      </p>
                    </div>
                    {creator.bestMatchScore != null ? (
                      <span className="shrink-0 rounded-[6px] border-2 border-[#0D0C1D] bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-bold text-emerald-800 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#142A1E] dark:text-emerald-300 dark:shadow-none">
                        {creator.bestMatchScore}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-[#5A5870] dark:text-[#9CA1BA]">
                    <MapPin className="size-3.5 shrink-0 text-[#4F46E5] dark:text-[#818CF8]" />
                    <span className="truncate">{creator.location} · audience {creator.audienceRegion}</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-y-2 border-[#0D0C1D]/10 py-3.5 dark:border-[#262A3D]">
                <Metric label="Avg. views" value={formatCompactNumber(creator.averageViews)} status={creator.averageViewsStatus} />
                <Metric label="Engagement" value={`${creator.engagementRate.toFixed(1)}%`} status={creator.engagementRateStatus} />
                <Metric label="Expected rate" value={formatInr(creator.expectedRateLow)} />
              </div>

              <div className="mt-4 grid gap-2">
                {creator.socialAccounts.slice(0, 3).map((social) => (
                  <SocialMetric social={social} key={social.platform} />
                ))}
                {!creator.socialAccounts.length ? (
                  <p className="text-xs text-[#5A5870] dark:text-[#9CA1BA]">No available platform metrics</p>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]"
                  href={`/brand/creators/${creator.creatorId}`}
                >
                  View creator
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] text-xs font-bold text-white shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#6366F1] dark:shadow-[2px_2px_0_#000000]"
                  style={{ color: '#fff' }}
                  href={`/brand/offers/new?creator=${creator.creatorId}${creator.bestCampaignId ? `&campaign=${creator.bestCampaignId}` : ''}`}
                >
                  <Sparkles className="size-3.5" />
                  Create offer
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-4 rounded-[10px] border-2 border-dashed border-[#0D0C1D] bg-white p-10 text-center shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <h2 className="text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">No creators match these filters</h2>
          <p className="mt-2 text-sm text-[#5A5870] dark:text-[#9CA1BA]">Broaden one or more criteria to compare more creator profiles.</p>
        </div>
      )}
    </>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label>
      <span className="sr-only">Filter by {label}</span>
      <SelectInput
        className="shadow-[2px_2px_0_#0D0C1D] dark:shadow-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All {label}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </SelectInput>
    </label>
  );
}

function NumberFilter({ label, value, onChange, options }: { label: string; value: number; onChange: (value: number) => void; options: Array<[number, string]> }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <SelectInput
        className="shadow-[2px_2px_0_#0D0C1D] dark:shadow-none"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map(([number, copy]) => (
          <option value={number} key={copy}>{copy}</option>
        ))}
      </SelectInput>
    </label>
  );
}

function Metric({ label, value, status }: { label: string; value: string; status?: CreatorSocialMetric['metric_status'] }) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">{label}</span>
      <strong className="mt-1 block truncate text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</strong>
      {status ? (
        <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#5A5870] dark:text-[#9CA1BA]">
          {status === 'API_VERIFIED' ? <BadgeCheck className="size-3 text-emerald-600" /> : null}
          {statusLabel(status)}
        </span>
      ) : null}
    </div>
  );
}

function SocialMetric({ social }: { social: CreatorSocialMetric }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] px-3.5 py-2 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none">
      <span className="text-xs font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{pretty(social.platform)}</span>
      <span className="text-right">
        <strong className="block text-xs font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{formatCompactNumber(Number(social.audience_count))}</strong>
        <span className="text-[10px] font-medium text-[#5A5870] dark:text-[#9CA1BA]">{statusLabel(social.metric_status)}</span>
      </span>
    </div>
  );
}

function statusLabel(value: CreatorSocialMetric['metric_status']) {
  return value === 'API_VERIFIED' ? 'API Verified' : value === 'CREATOR_DECLARED' ? 'Creator Declared' : 'Unavailable';
}

function topFollowers(creator: CreatorDiscoveryItem) {
  return Math.max(0, ...creator.socialAccounts.map((social) => Number(social.audience_count)));
}

function pretty(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}
