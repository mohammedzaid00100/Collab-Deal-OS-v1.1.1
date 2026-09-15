import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { RolePicker } from '@/components/auth/role-picker';
import { AuthQueryNotice } from '@/components/auth/auth-query-notice';
import type { AccountType } from '@/types/domain';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string; password?: string }>;
}) {
  const { role, error, password } = await searchParams;
  const accountType: AccountType | null = role === 'creator' || role === 'brand' ? role : null;

  return (
    <AuthShell
      eyebrow={accountType ? `Continue as ${accountType}` : 'Welcome back'}
      title={accountType ? 'Sign in to your account' : 'Which workspace are you entering?'}
      description={accountType ? 'We will route you to the correct onboarding or dashboard after sign-in.' : 'Select your intended role. Your saved account role remains the source of truth after authentication.'}
    >
      <AuthQueryNotice error={error} password={password} />
      {accountType ? <LoginForm accountType={accountType} /> : <RolePicker mode="login" />}
    </AuthShell>
  );
}
