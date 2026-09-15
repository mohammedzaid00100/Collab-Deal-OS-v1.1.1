import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccountType } from '@/types/domain';

export async function AnalyticsPage({ role }: { role: AccountType }) {
  const account = await requireAppAccount(role);
  if (!account) return <AppShell role={role} displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const client = await createSupabaseServerClient();
  const [offers, acceptedOffers, decidedOffers, analyses, activity] = await Promise.all([
    client!.from('offers').select('id', { count: 'exact', head: true }),
    client!.from('offers').select('id', { count: 'exact', head: true }).in('status', ['ACCEPTED', 'COMPLETED']),
    client!.from('offers').select('id', { count: 'exact', head: true }).in('status', ['ACCEPTED', 'COMPLETED', 'REJECTED']),
    client!.from('deal_analyses').select('id', { count: 'exact', head: true }).eq('requested_by', account.id).eq('status', 'COMPLETED'),
    client!.from('activity_log').select('id,event_type,created_at').eq('actor_user_id', account.id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (offers.error || acceptedOffers.error || decidedOffers.error || analyses.error || activity.error) throw new Error('Analytics are temporarily unavailable.');
  const accepted = acceptedOffers.count ?? 0;
  const decided = decidedOffers.count ?? 0;
  const metrics = [['Visible offers', String(offers.count ?? 0)], ['Accepted deals', accepted.toString()],
    ['Acceptance rate', decided ? `${Math.round(accepted / decided * 100)}%` : '—'], ['Completed AI evaluations', String(analyses.count ?? 0)]];
  return <AppShell role={role} displayName={account.displayName ?? role} email={account.email} plan={account.plan}><h1 className="text-3xl font-bold tracking-tight text-slate-950">Your collaboration activity</h1><p className="mt-3 text-sm leading-6 text-slate-500">Based on the offers and evaluations in your account. Acceptance rate compares accepted and rejected deals; pending offers are excluded.</p><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-4 text-3xl font-bold text-slate-950">{value}</p></div>)}</section><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Recent activity</h2>{activity.data.length ? <ol className="mt-5 divide-y divide-slate-100">{activity.data.map((event) => <li className="flex flex-wrap justify-between gap-3 py-4 text-sm" key={event.id}><span className="capitalize text-slate-700">{event.event_type.toLowerCase().replaceAll('_', ' ')}</span><time className="text-xs text-slate-400" dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString('en-IN')}</time></li>)}</ol> : <p className="py-8 text-sm text-slate-500">Your activity will appear after you create or evaluate a deal.</p>}</section></AppShell>;
}
