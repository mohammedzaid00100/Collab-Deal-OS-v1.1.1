import { CircleAlert, CircleCheck } from 'lucide-react';

const errors: Record<string, string> = {
  service_not_configured: 'Authentication services are not connected yet.',
  invalid_callback: 'That sign-in link is invalid or incomplete. Please try again.',
  authentication_failed: 'We could not complete authentication. Please try again.',
  role_required: 'Choose Creator or Brand before continuing so we can open the correct workspace.',
  account_unavailable: 'Your account record is temporarily unavailable. Please try again.',
};

export function AuthQueryNotice({ error, password }: { error?: string; password?: string }) {
  const errorText = error ? errors[error] ?? 'Authentication could not be completed.' : null;
  const successText = password === 'updated' ? 'Your password was updated. Sign in with the new password.' : null;
  if (!errorText && !successText) return null;
  const isError = Boolean(errorText);
  const Icon = isError ? CircleAlert : CircleCheck;
  return <div className={`mb-5 flex gap-2.5 rounded-xl border p-3 text-sm leading-5 ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} role={isError ? 'alert' : 'status'}><Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{errorText ?? successText}</span></div>;
}
