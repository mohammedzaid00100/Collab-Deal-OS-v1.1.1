import type { AccountSummary, AccountType, PlanTier } from '@/types/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AccountState =
  | { status: 'unconfigured' }
  | { status: 'anonymous' }
  | { status: 'ready'; account: AccountSummary };

interface AccountStateRow {
  id: string;
  email: string;
  account_type: AccountType;
  plan: PlanTier;
  onboarding_complete: boolean;
  display_name: string | null;
}

export async function getAccountState(): Promise<AccountState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: 'unconfigured' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: 'anonymous' };

  const { data, error } = await supabase
    .from('account_state')
    .select('id,email,account_type,plan,onboarding_complete,display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error('Account data is temporarily unavailable.');

  const row = data as AccountStateRow | null;
  if (!row?.account_type) return { status: 'anonymous' };

  return {
    status: 'ready',
    account: {
      id: row.id,
      email: row.email,
      accountType: row.account_type,
      plan: row.plan,
      onboardingComplete: row.onboarding_complete,
      displayName: row.display_name,
    },
  };
}

export function accountHome(account: Pick<AccountSummary, 'accountType' | 'onboardingComplete'>) {
  if (!account.onboardingComplete) return `/onboarding/${account.accountType}`;
  return `/${account.accountType}/dashboard`;
}
