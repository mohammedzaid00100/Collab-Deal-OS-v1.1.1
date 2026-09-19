'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { FieldShell, TextInput } from '@/components/ui/form-field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/auth';

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setIsError(true);
      setMessage('Authentication is not configured yet.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setIsError(Boolean(error));
    setMessage(error?.message ?? 'If an account exists, a password reset link is on its way.');
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldShell label="Email" name="email" error={errors.email?.message}>
        <TextInput id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
      </FieldShell>
      {message ? (
        <p
          className={`flex items-center gap-2.5 rounded-[8px] border-2 p-3.5 text-xs font-bold leading-5 ${
            isError
              ? 'border-red-500 bg-red-50 text-red-700 shadow-[2px_2px_0_#DC2626] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              : 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[2px_2px_0_#059669] dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
          role={isError ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}
      <Button type="submit" loading={isSubmitting}>Send reset link</Button>
    </form>
  );
}
