import { redirect } from 'next/navigation';
import { accountHome, getAccountState } from './account';
import type { AccountSummary, AccountType } from '@/types/domain';

export async function requireAppAccount(role: AccountType): Promise<AccountSummary | null> {
  const state = await getAccountState();
  if (state.status === 'unconfigured') return null;
  if (state.status === 'anonymous') redirect(`/login?role=${role}`);

  if (state.account.accountType !== role) redirect(accountHome(state.account));
  if (!state.account.onboardingComplete) redirect(`/onboarding/${role}`);
  return state.account;
}
