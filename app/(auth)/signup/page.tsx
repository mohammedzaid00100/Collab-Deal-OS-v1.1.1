import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { RolePicker } from '@/components/auth/role-picker';
import { SignupForm } from '@/components/auth/signup-form';
import { AuthQueryNotice } from '@/components/auth/auth-query-notice';
import type { AccountType } from '@/types/domain';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string }>;
}) {
  const { role, error } = await searchParams;
  const accountType: AccountType | null = role === 'creator' || role === 'brand' ? role : null;

  return (
    <AuthShell
      eyebrow={accountType ? `${accountType} account` : 'Choose your path'}
      title={accountType ? `Create your ${accountType} account` : 'How will you use Collab Deal OS?'}
      description={accountType ? 'One secure account gives you the tools and workflows designed for your side of each deal.' : 'Choose your role first. You will use the same secure authentication system either way.'}
    >
      <AuthQueryNotice error={error} />
      {accountType ? <SignupForm accountType={accountType} /> : <RolePicker mode="signup" />}
    </AuthShell>
  );
}
