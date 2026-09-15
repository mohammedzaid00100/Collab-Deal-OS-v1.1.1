import type { Metadata } from 'next';
import { Handshake } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { OffersBrowser } from '@/components/offers/offers-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getOffers } from '@/lib/marketplace/offers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Creator offers' };
export default async function CreatorOffersPage() { const account = await requireAppAccount('creator'); if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>; const supabase = await createSupabaseServerClient(); const offers = await getOffers(supabase!); return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Creator workspace</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Offers</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review value, deliverables, rights, revisions, and decisions as structured versions—never messages.</p></div>{offers.length ? <OffersBrowser role="creator" offers={offers} /> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><EmptyState icon={Handshake} title="No offers yet" description="Offers from brands—and every later structured revision—will appear here." /></section>}</AppShell>; }
