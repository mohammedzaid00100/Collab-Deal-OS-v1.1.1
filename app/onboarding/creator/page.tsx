import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreatorOnboardingForm } from '@/components/onboarding/creator-onboarding-form';
import { getAccountState, accountHome } from '@/lib/auth/account';

export const metadata: Metadata = { title: 'Creator onboarding' };

export default async function CreatorOnboardingPage() {
  const state = await getAccountState();

  if (state.status === 'anonymous') redirect('/login?role=creator');
  if (state.status === 'ready') {
    if (state.account.accountType !== 'creator') redirect(accountHome(state.account));
    if (state.account.onboardingComplete) redirect('/creator/dashboard');
  }

  return <CreatorOnboardingForm />;
}
