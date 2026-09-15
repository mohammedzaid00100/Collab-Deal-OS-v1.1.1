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
      {message ? <p className={`rounded-xl border p-3 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} role={isError ? 'alert' : 'status'}>{message}</p> : null}
      <Button type="submit" loading={isSubmitting}>Send reset link</Button>
    </form>
  );
}
