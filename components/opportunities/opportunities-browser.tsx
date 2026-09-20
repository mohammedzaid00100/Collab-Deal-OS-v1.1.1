'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Filter, Search } from 'lucide-react';
import { SelectInput, TextInput } from '@/components/ui/form-field';
import { formatInr } from '@/lib/utils';
import type { OpportunityFeedItem } from '@/types/marketplace';
import { SaveOpportunityButton } from './save-opportunity-button';

export function OpportunitiesBrowser({ opportunities, creatorProfileId }: { opportunities: OpportunityFeedItem[]; creatorProfileId: string }) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [niche, setNiche] = useState('');
  const [dealType, setDealType] = useState('');
  const [location, setLocation] = useState('');
  const [minimumBudget, setMinimumBudget] = useState(0);
  const [minimumScore, setMinimumScore] = useState(0);
  const [sort, setSort] = useState('match');
  const platforms = unique(opportunities.map((item) => item.platform));
  const niches = unique(opportunities.map((item) => item.niche));

  const visible = useMemo(() => opportunities.filter((item) => {
    const haystack = `${item.title} ${item.brandName} ${item.description} ${item.niche}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!platform || item.platform === platform)
      && (!niche || item.niche === niche)
      && (!dealType || item.dealType === dealType)
      && (!location || (item.targetLocation ?? '').toLowerCase().includes(location.toLowerCase()))
      && item.budget >= minimumBudget
      && item.matchScore >= minimumScore;
  }).sort((left, right) => {
    if (sort === 'payment') return right.budget - left.budget;
    if (sort === 'newest') return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (sort === 'deadline') return deadlineValue(left.deadline) - deadlineValue(right.deadline);
    return right.matchScore - left.matchScore;
  }), [dealType, location, minimumBudget, minimumScore, niche, opportunities, platform, query, sort]);

  return <>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500"><Filter className="size-4" />Search & filter</div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="relative sm:col-span-2"><span className="sr-only">Search opportunities</span><Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" /><TextInput className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search brand, campaign, or niche" /></label><FilterSelect label="Platform" value={platform} onChange={setPlatform} options={platforms} /><FilterSelect label="Niche" value={niche} onChange={setNiche} options={niches} /><FilterSelect label="Deal type" value={dealType} onChange={setDealType} options={['PAID', 'PRODUCT_ONLY', 'HYBRID']} /><label><span className="sr-only">Location</span><TextInput value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" /></label><label><span className="sr-only">Minimum budget</span><SelectInput value={minimumBudget} onChange={(event) => setMinimumBudget(Number(event.target.value))}><option value="0">Any cash budget</option><option value="5000">₹5,000+</option><option value="10000">₹10,000+</option><option value="25000">₹25,000+</option><option value="50000">₹50,000+</option></SelectInput></label><label><span className="sr-only">Minimum match score</span><SelectInput value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))}><option value="0">Any match score</option><option value="60">60%+</option><option value="75">75%+</option><option value="90">90%+</option></SelectInput></label><label><span className="sr-only">Sort opportunities</span><SelectInput value={sort} onChange={(event) => setSort(event.target.value)}><option value="match">Best match</option><option value="payment">Highest payment</option><option value="newest">Newest</option><option value="deadline">Deadline</option></SelectInput></label></div></section>

    <div className="mt-4 flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{visible.length} of {opportunities.length} matched opportunities</p>{query || platform || niche || dealType || location || minimumBudget || minimumScore ? <button className="text-xs font-semibold text-violet-700" type="button" onClick={() => { setQuery(''); setPlatform(''); setNiche(''); setDealType(''); setLocation(''); setMinimumBudget(0); setMinimumScore(0); }}>Clear filters</button> : null}</div>

    {visible.length ? <section className="mt-4 grid gap-4 lg:grid-cols-2" aria-label="Matched opportunities">{visible.map((item) => <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md" key={item.campaignId}><div className="relative flex min-h-40 items-end bg-gradient-to-br from-violet-100 via-slate-50 to-blue-100 bg-cover bg-center p-4" style={item.assetUrl ? { backgroundImage: `linear-gradient(transparent, rgb(15 23 42 / 72%)), url(${JSON.stringify(item.assetUrl).slice(1, -1)})` } : undefined}><span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">{item.matchScore}% match</span><div className={item.assetUrl ? 'text-white' : 'text-slate-950'}><span className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">{item.brandName}</span><h2 className="mt-1 text-lg font-bold tracking-[-0.025em]">{item.title}</h2></div></div><div className="p-4 sm:p-5"><div className="flex flex-wrap gap-2"><Tag>{item.platform}</Tag><Tag>{item.niche}</Tag><Tag>{item.dealType.replaceAll('_', ' ')}</Tag></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</p><dl className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-4"><Data label="Cash" value={formatInr(item.budget)} /><Data label="Product" value={item.productValue ? formatInr(item.productValue) : 'None'} /><Data label="Deliverables" value={`${item.deliverables.reduce((sum, deliverable) => sum + deliverable.quantity, 0)}`} /></dl><div className="mt-4 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="size-4" />{item.deadline ? formatDate(item.deadline) : 'No deadline set'}</span><SaveOpportunityButton compact creatorProfileId={creatorProfileId} campaignId={item.campaignId} initiallySaved={item.saved} /></div><div className="mt-4"><Link className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" href={`/creator/opportunities/${item.campaignId}`}>View details<ArrowRight className="size-3.5" /></Link></div></div></article>)}</section> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-bold text-slate-900">No opportunities match these filters</h2><p className="mt-2 text-sm text-slate-500">Clear one or more filters to see your matched campaigns.</p></div>}
  </>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label><span className="sr-only">{label}</span><SelectInput value={value} onChange={(event) => onChange(event.target.value)}><option value="">All {label.toLowerCase()}</option>{options.map((option) => <option key={option}>{option}</option>)}</SelectInput></label>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">{children}</span>; }
function Data({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</dt><dd className="mt-1 truncate text-xs font-bold text-slate-800">{value}</dd></div>; }
function unique(values: string[]) { return [...new Set(values)].sort(); }
function deadlineValue(value: string | null) { return value ? Date.parse(value) : Number.MAX_SAFE_INTEGER; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
