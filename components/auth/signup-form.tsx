'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldShell, TextInput } from '@/components/ui/form-field';
import { GoogleButton } from './google-button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { signupSchema, type SignupInput } from '@/lib/validation/auth';
import type { AccountType } from '@/types/domain';

export function SignupForm({ accountType }: { accountType: AccountType }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { accountType, email: '', password: '', confirmPassword: '', acceptTerms: false },
  });

  async function onSubmit(values: SignupInput) {
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage({ tone: 'error', text: 'Authentication is not configured yet. Connect Supabase to create accounts.' });
      return;
    }

    document.cookie = `collab-deal-os-role=${accountType}; Path=/; Max-Age=600; SameSite=Lax`;
    const emailRedirectTo = `${window.location.origin}/auth/callback?role=${accountType}`;
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { account_type: accountType }, emailRedirectTo },
    });

    if (error) {
      setMessage({ tone: 'error', text: error.message });
      return;
    }

    if (data.session && data.user) {
      const { data: claimedRole, error: roleError } = await supabase.rpc('claim_account_role', { desired_role: accountType });
      if (roleError || claimedRole !== accountType) {
        await supabase.auth.signOut();
        setMessage({ tone: 'error', text: `This account could not be opened as a ${accountType}. Use the account's original role or a different email.` });
        return;
      }
      router.replace(`/onboarding/${accountType}`);
      router.refresh();
      return;
    }

    setMessage({
      tone: 'success',
      text: `Check your email to verify your ${accountType} account. Your selected role will be preserved when you return.`,
    });
  }

  return (
    <div>
      <GoogleButton accountType={accountType} onError={(text) => setMessage({ tone: 'error', text })} />
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
        or use email
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <input type="hidden" {...register('accountType')} />
        <FieldShell label="Email" name="email" error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register('email')} />
        </FieldShell>
        <FieldShell label="Password" name="password" hint="At least 8 characters with uppercase, lowercase, and a number." error={errors.password?.message}>
          <TextInput id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
        </FieldShell>
        <FieldShell label="Confirm password" name="confirmPassword" error={errors.confirmPassword?.message}>
          <TextInput id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} />
        </FieldShell>

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-600">
          <input className="mt-0.5 size-4 rounded border-slate-300 accent-violet-600" type="checkbox" {...register('acceptTerms')} />
          <span>
            I agree to the <Link className="font-semibold text-violet-700" href="/terms">Terms</Link> and <Link className="font-semibold text-violet-700" href="/privacy">Privacy Policy</Link>.
            {errors.acceptTerms ? <span className="mt-1 block text-xs font-medium text-red-600">{errors.acceptTerms.message}</span> : null}
          </span>
        </label>

        {message ? <AuthMessage {...message} /> : null}
        <Button className="mt-1 w-full" type="submit" loading={isSubmitting}>
          Create {accountType} account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link className="font-semibold text-violet-700 hover:text-violet-800" href={`/login?role=${accountType}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

function AuthMessage({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <div className={`flex gap-2.5 rounded-xl border p-3 text-sm leading-5 ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
