import type { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { EmptyState } from '@/components/app/empty-state';
import { OpportunitiesBrowser } from '@/components/opportunities/opportunities-browser';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getCreatorOpportunities } from '@/lib/marketplace/feeds';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Opportunities' };

export default async function OpportunitiesPage() {
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase!.from('creator_profiles').select('id').eq('user_id', account.id).single();
  if (profileError || !profile) throw new Error('Creator profile is temporarily unavailable.');
  const [opportunities, savedResult] = await Promise.all([
    getCreatorOpportunities(supabase!),
    supabase!.from('saved_opportunities').select('campaign_id').eq('creator_profile_id', profile.id),
  ]);
  if (savedResult.error) throw new Error('Saved opportunities are temporarily unavailable.');
  const saved = new Set((savedResult.data ?? []).map((row) => row.campaign_id));
  const hydrated = opportunities.map((item) => ({ ...item, saved: saved.has(item.campaignId) }));

  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}>
    <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Creator workspace</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Opportunities</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Campaigns shown here passed the required niche and platform gates and scored at least 40 on the weighted match engine.</p></div>
    {hydrated.length ? <OpportunitiesBrowser opportunities={hydrated} creatorProfileId={profile.id} /> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><EmptyState icon={Compass} title="We haven’t found a strong match yet" description="Relevant published campaigns will appear here after they meet your niche, platform, audience, size, engagement, and budget criteria." /></section>}
  </AppShell>;
}
