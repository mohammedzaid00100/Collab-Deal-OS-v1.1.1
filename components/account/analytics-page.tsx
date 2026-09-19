import { Activity, BadgeCheck, Bot, Handshake, Percent } from 'lucide-react';
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
  const metrics = [
    { label: 'Visible offers', value: String(offers.count ?? 0), detail: 'All active & history', icon: Handshake },
    { label: 'Accepted deals', value: accepted.toString(), detail: 'Closed & in-progress', icon: BadgeCheck },
    { label: 'Acceptance rate', value: decided ? `${Math.round(accepted / decided * 100)}%` : '—', detail: 'Accepted vs rejected', icon: Percent },
    { label: 'Completed AI evaluations', value: String(analyses.count ?? 0), detail: 'Deal score checks', icon: Bot },
  ];

  return (
    <AppShell role={role} displayName={account.displayName ?? role} email={account.email} plan={account.plan}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#4F46E5] dark:text-[#818CF8]">Performance & Insights</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] dark:text-[#F3F4F8] sm:text-3xl">
          Your collaboration activity
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[#5A5870] dark:text-[#9CA1BA]">
          Based on the offers and evaluations in your account. Acceptance rate compares accepted and rejected deals; pending offers are excluded.
        </p>
      </div>

      <section className="mt-7 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Activity metrics">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#5A5870] dark:text-[#9CA1BA]">{metric.label}</span>
              <span className="flex size-8 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
                <metric.icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <strong className="mt-3 block truncate text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] dark:text-[#F3F4F8] sm:text-3xl">
              {metric.value}
            </strong>
            <span className="mt-1 block truncate text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">{metric.detail}</span>
          </div>
        ))}
      </section>

      <section className="mt-7 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
            <Activity className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">Event Log</p>
            <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Recent activity</h2>
          </div>
        </div>

        {activity.data.length ? (
          <ol className="mt-5 grid gap-2.5">
            {activity.data.map((event) => (
              <li
                className="flex items-center justify-between gap-4 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] px-4 py-3 shadow-[2px_2px_0_#0D0C1D] transition-all hover:bg-white dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none dark:hover:bg-[#25283D]"
                key={event.id}
              >
                <div className="flex items-center gap-3">
                  <span className="size-2 rounded-full border border-[#0D0C1D] bg-[#4F46E5] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#6366F1]" />
                  <span className="text-sm font-bold capitalize text-[#0D0C1D] dark:text-[#F3F4F8]">
                    {event.event_type.toLowerCase().replaceAll('_', ' ')}
                  </span>
                </div>
                <time
                  className="shrink-0 rounded-[6px] border border-[#0D0C1D] bg-white px-2.5 py-0.5 text-xs font-bold text-[#5A5870] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#9CA1BA] dark:shadow-none"
                  dateTime={event.created_at}
                >
                  {new Date(event.created_at).toLocaleDateString('en-IN')}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-5 rounded-[8px] border-2 border-dashed border-[#0D0C1D] bg-[#F5F2EA] p-8 text-center text-sm font-medium text-[#5A5870] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA]">
            Your activity will appear after you create or evaluate a deal.
          </div>
        )}
      </section>
    </AppShell>
  );
}
