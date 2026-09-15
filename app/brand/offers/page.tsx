import type { Metadata } from 'next';
import Link from 'next/link';
import { FilePlus2, FileText } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { OffersBrowser } from '@/components/offers/offers-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getOffers } from '@/lib/marketplace/offers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Brand offers' };
export default async function BrandOffersPage() { const account = await requireAppAccount('brand'); if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>; const supabase = await createSupabaseServerClient(); const offers = await getOffers(supabase!); return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Brand workspace</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Offers</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Send explicit deal terms and respond to creator revisions through structured actions.</p></div><Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-sm font-semibold text-white" href="/brand/offers/new"><FilePlus2 className="size-4" />Create offer</Link></div>{offers.length ? <OffersBrowser role="brand" offers={offers} /> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><EmptyState icon={FileText} title="No offers yet" description="Create a structured offer from a creator profile or a matched campaign." actionLabel="Create your first offer" actionHref="/brand/offers/new" /></section>}</AppShell>; }
