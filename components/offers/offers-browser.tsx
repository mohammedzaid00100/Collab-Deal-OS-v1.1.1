'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, CalendarClock, Plus } from 'lucide-react';
import { OfferStatus } from './offer-status';
import { cn, formatInr } from '@/lib/utils';
import type { AccountType } from '@/types/domain';
import type { OfferFeedItem } from '@/types/offers';

const creatorTabs = [
  ['received', 'Received'], ['review', 'Under Review'], ['revised', 'Revised'],
  ['accepted', 'Accepted'], ['rejected', 'Rejected'],
] as const;
const brandTabs = [
  ['sent', 'Sent'], ['awaiting', 'Awaiting Creator'], ['revision', 'Revision Received'],
  ['accepted', 'Accepted'], ['rejected', 'Rejected'],
] as const;

export function OffersBrowser({ role, offers }: { role: AccountType; offers: OfferFeedItem[] }) {
  const tabs = role === 'creator' ? creatorTabs : brandTabs;
  const [tab, setTab] = useState<string>(tabs[0][0]);
  const visible = useMemo(() => offers.filter((offer) => inTab(role, tab, offer)), [offers, role, tab]);

  return <>
    <div className="mt-6 flex flex-wrap gap-2 border-b-2 border-[#0D0C1D] pb-3 dark:border-[#383E5E]">
      <div className="flex min-w-max flex-wrap gap-2" role="tablist" aria-label="Offer status filters">
        {tabs.map(([value, label]) => {
          const count = offers.filter((offer) => inTab(role, value, offer)).length;
          const isSelected = tab === value;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setTab(value)}
              key={value + label}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 px-3.5 text-xs font-bold transition-all',
                isSelected
                  ? 'border-[#0D0C1D] bg-[#0D0C1D] text-white shadow-[2px_2px_0_rgba(0,0,0,0.3)] dark:border-[#383E5E] dark:bg-[#6366F1] dark:text-white dark:shadow-[2px_2px_0_#000000]'
                  : 'border-transparent bg-transparent text-[#5A5870] hover:bg-[#F5F2EA] hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:bg-[#1E2134] dark:hover:text-[#F3F4F8]'
              )}
            >
              {label}
              <span
                className={cn(
                  'rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold',
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'border border-[#0D0C1D]/30 bg-white text-[#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E2134] dark:text-[#9CA1BA]'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>

    {visible.length ? (
      <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label={`${role} offers`}>
        {visible.map((offer) => {
          const otherName = role === 'creator' ? offer.brandName : offer.creatorName;
          const otherImage = role === 'creator' ? offer.brandLogoUrl : offer.creatorAvatarUrl;
          return (
            <article
              className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]"
              key={offer.offerId}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] bg-cover bg-center text-sm font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E213B] dark:text-[#818CF8] dark:shadow-none"
                  style={otherImage ? { backgroundImage: `url(${JSON.stringify(otherImage).slice(1, -1)})` } : undefined}
                >
                  {!otherImage ? otherName.slice(0, 1).toUpperCase() : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="truncate font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{otherName}</h2>
                      <p className="mt-0.5 truncate text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">
                        {offer.campaignTitle ?? 'Standalone collaboration offer'}
                      </p>
                    </div>
                    <OfferStatus status={offer.status} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">
                    Version {offer.version} · {directionLabel(role, offer)}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 border-y-2 border-[#0D0C1D] py-3.5 dark:border-[#383E5E]">
                <Data label="Cash" value={formatInr(offer.cashPayment)} />
                <Data label="Product" value={offer.productValue ? formatInr(offer.productValue) : 'None'} />
                <Data label="Deal type" value={offer.dealType.replaceAll('_', ' ')} />
              </dl>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">
                  <CalendarClock className="size-4" />Updated {formatDate(offer.updatedAt)}
                </span>
                {offer.latestAnalysisScore != null ? (
                  <span className="flex items-center gap-1 rounded-[6px] border border-[#0D0C1D] bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#4F46E5] shadow-[1px_1px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E213B] dark:text-[#818CF8] dark:shadow-none">
                    <Bot className="size-3" />AI {offer.latestAnalysisScore}/100
                  </span>
                ) : null}
              </div>

              <div className="mt-5">
                <Link
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-xs font-bold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-[#383E5E] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]"
                  href={`/${role}/offers/${offer.offerId}`}
                >
                  View offer
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    ) : (
      <div className="mt-5 rounded-[10px] border-2 border-dashed border-[#0D0C1D] bg-[#F5F2EA] p-10 text-center dark:border-[#383E5E] dark:bg-[#121422]">
        <h2 className="text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">No offers in this view</h2>
        <p className="mt-1 text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">Structured offer activity for this status will appear here.</p>
        {role === 'brand' && tab === 'sent' ? (
          <Link
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-xs font-bold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]"
            href="/brand/offers/new"
          >
            <Plus className="size-4" />Create offer
          </Link>
        ) : null}
      </div>
    )}
  </>;
}

function inTab(role: AccountType, tab: string, offer: OfferFeedItem) {
  if (tab === 'accepted') return offer.status === 'ACCEPTED' || offer.status === 'COMPLETED';
  if (tab === 'rejected') return offer.status === 'REJECTED' || offer.status === 'EXPIRED';
  if (role === 'creator') {
    if (tab === 'received') return offer.status === 'SENT';
    if (tab === 'review') return offer.status === 'UNDER_REVIEW';
    if (tab === 'revised') return offer.status === 'REVISED';
  } else {
    if (tab === 'sent') return offer.status === 'DRAFT' || offer.status === 'SENT';
    if (tab === 'awaiting') return offer.pendingWith === 'creator' && ['SENT', 'UNDER_REVIEW', 'REVISED'].includes(offer.status);
    if (tab === 'revision') return offer.status === 'REVISED' && offer.pendingWith === 'brand';
  }
  return false;
}

function directionLabel(role: AccountType, offer: OfferFeedItem) {
  if (!offer.pendingWith) return offer.status === 'COMPLETED' ? 'Closed' : 'Decision recorded';
  return offer.pendingWith === role ? 'Your action required' : `Awaiting ${offer.pendingWith}`;
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#A5ADC6]">{label}</dt>
      <dd className="mt-1 truncate text-xs font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

