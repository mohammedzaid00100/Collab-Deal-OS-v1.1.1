import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBillingPageData } from '@/lib/billing/account';
import type { AccountType } from '@/types/domain';
import { SubscriptionScreen } from './subscription-screen';

export async function SubscriptionPage({ role }: { role: AccountType }) {
  const account = await requireAppAccount(role);
  if (!account) return <AppShell role={role} displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const client = await createSupabaseServerClient();
  const data = await getBillingPageData(client!, account.id, role);
  return <AppShell role={role} displayName={account.displayName ?? role} email={account.email} plan={account.plan}><SubscriptionScreen data={data} role={role} effectivePlan={account.plan} /></AppShell>;
}
