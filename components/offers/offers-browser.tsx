'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, CalendarClock, Plus } from 'lucide-react';
import { OfferStatus } from './offer-status';
import { formatInr } from '@/lib/utils';
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
    <div className="mt-6 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-1" role="tablist" aria-label="Offer status filters">{tabs.map(([value, label]) => { const count = offers.filter((offer) => inTab(role, value, offer)).length; return <button className={tab === value ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-900'} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} key={value + label}><span className="flex min-h-12 items-center gap-2 border-b-2 border-inherit px-4 text-sm font-semibold">{label}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{count}</span></span></button>; })}</div></div>
    {visible.length ? <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label={`${role} offers`}>{visible.map((offer) => { const otherName = role === 'creator' ? offer.brandName : offer.creatorName; const otherImage = role === 'creator' ? offer.brandLogoUrl : offer.creatorAvatarUrl; return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md" key={offer.offerId}><div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 bg-cover bg-center text-sm font-bold text-violet-700" style={otherImage ? { backgroundImage: `url(${JSON.stringify(otherImage).slice(1, -1)})` } : undefined}>{!otherImage ? otherName.slice(0, 1).toUpperCase() : null}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className="truncate font-bold text-slate-950">{otherName}</h2><p className="mt-0.5 truncate text-xs text-slate-500">{offer.campaignTitle ?? 'Standalone collaboration offer'}</p></div><OfferStatus status={offer.status} /></div><p className="mt-2 text-[11px] text-slate-400">Version {offer.version} · {directionLabel(role, offer)}</p></div></div><dl className="mt-5 grid grid-cols-3 gap-3 border-y border-slate-100 py-4"><Data label="Cash" value={formatInr(offer.cashPayment)} /><Data label="Product" value={offer.productValue ? formatInr(offer.productValue) : 'None'} /><Data label="Deal type" value={offer.dealType.replaceAll('_', ' ')} /></dl><div className="mt-4 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="size-4" />Updated {formatDate(offer.updatedAt)}</span>{offer.latestAnalysisScore != null ? <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700"><Bot className="size-3" />AI {offer.latestAnalysisScore}/100</span> : null}</div><div className="mt-4 grid grid-cols-2 gap-2"><Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-semibold text-white" href={`/${role}/offers/${offer.offerId}`}>View offer<ArrowRight className="size-3.5" /></Link><Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800" href={`/${role}/ai-advisor?offer=${offer.offerId}`}><Bot className="size-3.5 text-violet-700" />Analyze</Link></div></article>; })}</section> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-bold text-slate-900">No offers in this view</h2><p className="mt-2 text-sm text-slate-500">Structured offer activity for this status will appear here.</p>{role === 'brand' && tab === 'sent' ? <Link className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white" href="/brand/offers/new"><Plus className="size-4" />Create offer</Link> : null}</div>}
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
function directionLabel(role: AccountType, offer: OfferFeedItem) { if (!offer.pendingWith) return offer.status === 'COMPLETED' ? 'Closed' : 'Decision recorded'; return offer.pendingWith === role ? 'Your action required' : `Awaiting ${offer.pendingWith}`; }
function Data({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</dt><dd className="mt-1 truncate text-xs font-bold text-slate-800">{value}</dd></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
