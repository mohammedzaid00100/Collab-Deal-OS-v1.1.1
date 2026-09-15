import type { Metadata } from 'next';
import { AppShell } from '@/components/app/app-shell';
import { AdvisorScreen } from '@/components/analysis/advisor-screen';
import { ServiceState } from '@/components/ui/service-state';
import { getAdvisorPageData } from '@/lib/analysis/advisor';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'AI Deal Advisor' };

export default async function BrandAdvisorPage({ searchParams }: { searchParams: Promise<{ offer?: string }> }) {
  const { offer } = await searchParams;
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const data = await getAdvisorPageData(supabase!, account.id, 'brand', offer);
  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}><AdvisorScreen role="brand" initial={data.initial} sourceLabel={data.sourceLabel} freeRemaining={data.freeRemaining} history={data.history} configured={data.privilegedConfigurationReady} /></AppShell>;
}
