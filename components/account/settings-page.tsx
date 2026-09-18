import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AccountType } from '@/types/domain';
import { AccountClosureCard } from './account-closure-card';
import { PreferencesForm } from './preferences-form';
import { ThemeToggle } from './theme-toggle';

export async function SettingsPage({ role }: { role: AccountType }) {
  const account = await requireAppAccount(role);
  if (!account) return <AppShell role={role} displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  const client = await createSupabaseServerClient();
  const { data, error } = await client!.from('account_preferences').select('email_notifications,product_analytics').eq('user_id', account.id).single();
  if (error) throw new Error('Preferences are temporarily unavailable.');
  return <AppShell role={role} displayName={account.displayName ?? role} email={account.email} plan={account.plan}>
    <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Account settings</h1>
    <p className="mb-7 mt-3 text-sm text-slate-600 dark:text-slate-400">Manage your account, workspace appearance, privacy, and wallet access.</p>
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <PreferencesForm userId={account.id} initialEmail={data.email_notifications} initialAnalytics={data.product_analytics} />
      <div className="grid gap-6">
        <ThemeToggle />
        <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <h2 className="font-bold text-slate-950 dark:text-white">Security and account</h2>
          <p className="mt-3 break-all text-sm text-slate-500 dark:text-slate-400">{account.email}</p>
          <nav className="mt-5 grid gap-2 text-sm font-semibold text-violet-700 dark:text-violet-400">
            <Link className="py-2 hover:underline" href="/forgot-password">Reset your password</Link>
            <Link className="py-2 hover:underline" href={`/${role}/profile`}>View your profile</Link>
            <Link className="py-2 hover:underline" href={`/${role}/wallet`}>Open wallet</Link>
            <Link className="py-2 hover:underline" href="/privacy">Privacy policy</Link>
          </nav>
        </section>
      </div>
    </div>
    <AccountClosureCard role={role} />
  </AppShell>;
}
