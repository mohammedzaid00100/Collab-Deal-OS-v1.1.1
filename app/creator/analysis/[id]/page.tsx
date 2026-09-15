import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { AnalysisResult } from '@/components/analysis/analysis-result';
import { ServiceState } from '@/components/ui/service-state';
import { getAnalysis, sweepStaleAnalyses } from '@/lib/analysis/records';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getOffers } from '@/lib/marketplace/offers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Deal analysis' };
export default async function CreatorAnalysisPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const account = await requireAppAccount('creator'); if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>; await sweepStaleAnalyses(20); const supabase = await createSupabaseServerClient(); const analysis = await getAnalysis(supabase!, id); if (!analysis || analysis.accountPerspective !== 'creator') notFound(); const offer = analysis.offerId ? (await getOffers(supabase!, analysis.offerId))[0] ?? null : null; return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}><AnalysisResult role="creator" analysis={analysis} offer={offer} /></AppShell>; }
