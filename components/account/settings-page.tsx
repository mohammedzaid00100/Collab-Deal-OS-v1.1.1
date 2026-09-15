import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccountType } from '@/types/domain';
import { PreferencesForm } from './preferences-form';

export async function SettingsPage({ role }: { role: AccountType }) {
  const account = await requireAppAccount(role);
  if (!account) return <AppShell role={role} displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const client = await createSupabaseServerClient();
  const { data, error } = await client!.from('account_preferences').select('email_notifications,product_analytics').eq('user_id', account.id).single();
  if (error) throw new Error('Preferences are temporarily unavailable.');
  return <AppShell role={role} displayName={account.displayName ?? role} email={account.email} plan={account.plan}><h1 className="text-3xl font-bold tracking-tight text-slate-950">Account settings</h1><p className="mb-7 mt-3 text-sm text-slate-500">Manage your account and how you hear from us.</p><div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"><PreferencesForm userId={account.id} initialEmail={data.email_notifications} initialAnalytics={data.product_analytics} /><section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Security and account</h2><p className="mt-3 break-all text-sm text-slate-500">{account.email}</p><nav className="mt-5 grid gap-2 text-sm font-semibold text-violet-700"><Link className="py-3" href="/forgot-password">Reset your password</Link><Link className="py-3" href={`/${role}/profile`}>View your profile</Link><Link className="py-3" href={`/${role}/subscription`}>Manage subscription</Link><Link className="py-3" href="/privacy">Privacy policy</Link></nav></section></div></AppShell>;
}
