'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, TextInput } from '@/components/ui/form-field';
import { GoogleButton } from './google-button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';
import type { AccountType } from '@/types/domain';

interface AccountRouteRow {
  account_type: AccountType | null;
  onboarding_complete: boolean;
}

export function LoginForm({ accountType }: { accountType: AccountType }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput) {
    setErrorMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage('Authentication is not configured yet. Connect Supabase to sign in.');
      return;
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword(values);
    if (error || !signInData.user) {
      setErrorMessage(error?.message ?? 'Sign in failed.');
      return;
    }

    const { data: claimedRole, error: roleError } = await supabase.rpc('claim_account_role', { desired_role: accountType });
    if (roleError) {
      setErrorMessage('Your account role could not be loaded. Please try again.');
      return;
    }

    if (claimedRole !== accountType) {
      await supabase.auth.signOut();
      setErrorMessage(`This account is already registered as a ${claimedRole ?? 'different role'}. Choose Continue as ${claimedRole ?? 'the original role'} or use a different account.`);
      return;
    }

    const { data, error: accountError } = await supabase
      .from('account_state')
      .select('account_type,onboarding_complete')
      .eq('id', signInData.user.id)
      .maybeSingle();

    if (accountError) {
      setErrorMessage('Your account workspace is temporarily unavailable. Please try again.');
      return;
    }

    const account = data as AccountRouteRow | null;
    if (account?.account_type && account.account_type !== accountType) {
      await supabase.auth.signOut();
      setErrorMessage(`This account belongs to the ${account.account_type} workspace. Choose Continue as ${account.account_type} or use a different account.`);
      return;
    }

    router.replace(account?.onboarding_complete ? `/${accountType}/dashboard` : `/onboarding/${accountType}`);
    router.refresh();
  }

  return (
    <div>
      <GoogleButton accountType={accountType} onError={setErrorMessage} />
      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#5A5870] before:h-0.5 before:flex-1 before:bg-[#0D0C1D] after:h-0.5 after:flex-1 after:bg-[#0D0C1D] dark:text-[#9CA1BA] dark:before:bg-[#383E5E] dark:after:bg-[#383E5E]">
        or use email
      </div>
      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldShell label="Email" name="email" error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register('email')} />
        </FieldShell>
        <FieldShell label="Password" name="password" error={errors.password?.message}>
          <TextInput id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
        </FieldShell>
        <div className="-mt-1 text-right">
          <Link className="text-sm font-bold text-[#4F46E5] hover:underline dark:text-[#818CF8]" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        {errorMessage ? (
          <div className="flex items-center gap-2.5 rounded-[8px] border-2 border-red-500 bg-red-50 p-3.5 text-xs font-bold leading-5 text-red-700 shadow-[2px_2px_0_#DC2626] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
        <Button className="w-full" type="submit" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm font-medium text-[#5A5870] dark:text-[#9CA1BA]">
        New to Collab Deal OS?{' '}
        <Link className="font-bold text-[#4F46E5] hover:underline dark:text-[#818CF8]" href={`/signup?role=${accountType}`}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
