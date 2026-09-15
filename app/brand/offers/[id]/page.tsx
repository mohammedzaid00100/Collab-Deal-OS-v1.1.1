import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { OfferDetails } from '@/components/offers/offer-details';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getOfferEvents, getOfferRevisions, getOffers } from '@/lib/marketplace/offers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Offer details' };
export default async function BrandOfferPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const account = await requireAppAccount('brand'); if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>; const supabase = await createSupabaseServerClient(); const [offers, revisions, events] = await Promise.all([getOffers(supabase!, id), getOfferRevisions(supabase!, id), getOfferEvents(supabase!, id)]); const offer = offers[0]; if (!offer) notFound(); return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}><OfferDetails role="brand" accountId={account.id} offer={offer} revisions={revisions} events={events} /></AppShell>; }
