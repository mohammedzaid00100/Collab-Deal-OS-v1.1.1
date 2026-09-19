import { CircleAlert, CircleCheck } from 'lucide-react';

const errors: Record<string, string> = {
  service_not_configured: 'Authentication services are not connected yet.',
  invalid_callback: 'That sign-in link is invalid or incomplete. Please try again.',
  authentication_failed: 'We could not complete authentication. Please try again.',
  role_required: 'Choose Creator or Brand before continuing so we can open the correct workspace.',
  account_unavailable: 'Your account record is temporarily unavailable. Please try again.',
  role_mismatch: 'This sign-in already belongs to the other Collab Deal OS workspace type. Choose the role that account was created with, or use a different account.',
};

export function AuthQueryNotice({ error, password }: { error?: string; password?: string }) {
  const errorText = error ? errors[error] ?? 'Authentication could not be completed.' : null;
  const successText = password === 'updated' ? 'Your password was updated. Sign in with the new password.' : null;
  if (!errorText && !successText) return null;
  const isError = Boolean(errorText);
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <div
      className={`mb-5 flex items-center gap-2.5 rounded-[8px] border-2 p-3.5 text-xs font-bold leading-5 ${
        isError
          ? 'border-red-500 bg-red-50 text-red-700 shadow-[2px_2px_0_#DC2626] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          : 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[2px_2px_0_#059669] dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
      }`}
      role={isError ? 'alert' : 'status'}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{errorText ?? successText}</span>
    </div>
  );
}
