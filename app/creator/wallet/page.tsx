import type { Metadata } from 'next';
import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { WalletPrototype } from '@/components/wallet/wallet-prototype';
import { requireAppAccount } from '@/lib/auth/protected-page';

export const metadata: Metadata = { title: 'Creator wallet' };

export default async function CreatorWalletPage() {
  const account = await requireAppAccount('creator');
  if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}><WalletPrototype role="creator" /></AppShell>;
}
