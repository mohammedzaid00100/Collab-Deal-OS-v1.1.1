import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccountType } from '@/types/domain';
import { ProfileEditor } from './profile-editor';

export async function ProfilePage({ role }: { role: AccountType }) {
  const account = await requireAppAccount(role);
  if (!account) return <AppShell role={role} displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const client = await createSupabaseServerClient();
  const { data, error } = await client!.from(role === 'creator' ? 'creator_profiles' : 'brand_profiles').select('*').eq('user_id', account.id).single();
  if (error) throw new Error('Profile is temporarily unavailable.');
  return <AppShell role={role} displayName={account.displayName ?? role} email={account.email} plan={account.plan}>
    <h1 className="text-3xl font-bold tracking-tight text-slate-950">Your {role} profile</h1><p className="mt-3 text-sm text-slate-500">Keep your collaboration profile clear and current.</p>
    <nav aria-label="Account navigation" className="my-6 flex flex-wrap gap-2">{[['Settings', 'settings'], ['Subscription', 'subscription'], ['Analytics', 'analytics'], ['AI Advisor', 'ai-advisor']].map(([label, route]) => <Link key={route} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700" href={`/${role}/${route}`}>{label}</Link>)}</nav>
    <ProfileEditor initial={{ name: role === 'creator' ? data.full_name : data.brand_name,
      description: role === 'creator' ? data.bio : data.description,
      location: data.location, category: role === 'creator' ? data.niche : data.industry }} />
    {role === 'creator' ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Audience snapshot</h2><p className="mt-3 text-sm text-slate-600">{Number(data.average_views).toLocaleString('en-IN')} average views · {Number(data.engagement_rate)}% engagement</p><p className="mt-2 text-xs text-slate-500">Metric status: {String(data.average_views_status).toLowerCase().replaceAll('_', ' ')}. Your stored social accounts and their individual verification labels remain attached to your profile.</p></section> : null}
  </AppShell>;
}
