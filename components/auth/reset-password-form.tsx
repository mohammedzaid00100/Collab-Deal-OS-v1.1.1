'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FieldShell, TextInput } from '@/components/ui/form-field';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { passwordSchema } from '@/lib/validation/auth';

interface ResetValues { password: string; confirmPassword: string }

export function ResetPasswordForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<ResetValues>();

  async function onSubmit(values: ResetValues) {
    const passwordResult = passwordSchema.safeParse(values.password);
    if (!passwordResult.success) {
      setMessage(passwordResult.error.issues[0]?.message ?? 'Choose a stronger password.');
      return;
    }
    if (values.password !== values.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage('Authentication is not configured yet.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace('/login?password=updated');
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldShell label="New password" name="password" hint="At least 8 characters with uppercase, lowercase, and a number." error={errors.password?.message}>
        <TextInput id="password" type="password" autoComplete="new-password" {...register('password', { required: 'Password is required' })} />
      </FieldShell>
      <FieldShell label="Confirm new password" name="confirmPassword" error={errors.confirmPassword?.message}>
        <TextInput id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword', { required: 'Confirm your password', validate: (value) => value === getValues('password') || 'Passwords do not match' })} />
      </FieldShell>
      {message ? (
        <p className="flex items-center gap-2.5 rounded-[8px] border-2 border-red-500 bg-red-50 p-3.5 text-xs font-bold leading-5 text-red-700 shadow-[2px_2px_0_#DC2626] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
          {message}
        </p>
      ) : null}
      <Button type="submit" loading={isSubmitting}>Update password</Button>
    </form>
  );
}
