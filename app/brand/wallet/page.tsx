import type { Metadata } from 'next';
import { AppShell } from '@/components/app/app-shell';
import { ServiceState } from '@/components/ui/service-state';
import { WalletPrototype } from '@/components/wallet/wallet-prototype';
import { requireAppAccount } from '@/lib/auth/protected-page';

export const metadata: Metadata = { title: 'Brand wallet' };

export default async function BrandWalletPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;
  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}><WalletPrototype role="brand" /></AppShell>;
}
