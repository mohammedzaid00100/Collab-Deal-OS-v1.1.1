import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandOnboardingForm } from '@/components/onboarding/brand-onboarding-form';
import { getAccountState, accountHome } from '@/lib/auth/account';

export const metadata: Metadata = { title: 'Brand onboarding' };

export default async function BrandOnboardingPage() {
  const state = await getAccountState();

  if (state.status === 'anonymous') redirect('/login?role=brand');
  if (state.status === 'ready') {
    if (state.account.accountType !== 'brand') redirect(accountHome(state.account));
    if (state.account.onboardingComplete) redirect('/brand/dashboard');
  }

  return <BrandOnboardingForm />;
}
