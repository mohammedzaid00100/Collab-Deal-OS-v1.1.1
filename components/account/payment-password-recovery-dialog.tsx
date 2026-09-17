'use client';

import { useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';

type Step = 'email' | 'code' | 'password' | 'done';

type ApiPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  resetToken?: string;
};

export function PaymentPasswordRecoveryDialog({
  open,
  onClose,
  onReset,
}: {
  open: boolean;
  onClose: (notice?: string) => void;
  onReset?: () => void;
}) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  function resetLocalState() {
    setStep('email');
    setEmail('');
    setCode('');
    setResetToken('');
    setPassword('');
    setConfirm('');
    setBusy(false);
    setError('');
  }

  function close(notice?: string) {
    resetLocalState();
    onClose(notice);
  }

  async function callRecovery(body: Record<string, unknown>) {
    const response = await fetch('/api/payment-password/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({})) as ApiPayload;
    return { response, payload };
  }

  async function requestCode() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const { response, payload } = await callRecovery({ action: 'request', email: email.trim() });
      if (!response.ok || !payload.ok) {
        if (payload.code === 'EMAIL_MISMATCH') {
          close(payload.message ?? 'Enter the same email address used for your account.');
          return;
        }
        setError(payload.message ?? 'Could not send the verification code.');
        return;
      }
      setStep('code');
    } catch {
      setError('Could not start payment-password recovery.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code.trim()) || busy) return;
    setBusy(true);
    setError('');
    try {
      const { response, payload } = await callRecovery({ action: 'verify', code: code.trim() });
      if (!response.ok || !payload.ok || !payload.resetToken) {
        setError(payload.message ?? 'The verification code could not be confirmed.');
        return;
      }
      setResetToken(payload.resetToken);
      setStep('password');
    } catch {
      setError('Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (busy) return;
    setError('');
    if (password.length < 6) return setError('Use at least 6 characters for the payment password.');
    if (password !== confirm) return setError('The two passwords do not match.');

    setBusy(true);
    try {
      const { response, payload } = await callRecovery({ action: 'reset', resetToken, newPassword: password });
      if (!response.ok || !payload.ok) {
        setError(payload.message ?? 'Could not change the payment password.');
        return;
      }
      setStep('done');
      onReset?.();
    } catch {
      setError('Could not change the payment password.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Forgot payment password">
    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><KeyRound className="size-5" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Payment password recovery</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">Forgot payment password?</h2></div>
        </div>
        {step !== 'done' ? <button className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600" type="button" onClick={() => close()} aria-label="Close"><X className="size-4" /></button> : null}
      </div>

      {step === 'email' ? <>
        <p className="mt-5 text-sm leading-6 text-slate-600">Enter the exact email address used for this Collab Deal OS account. If it does not match your signed-in account, recovery will be denied.</p>
        <label className="mt-5 grid gap-2 text-sm font-semibold text-slate-700">Account email<div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><Mail className="size-4 text-slate-400" /><input className="min-h-12 w-full bg-transparent px-3 text-slate-950 outline-none" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label>
        {error ? <ErrorMessage message={error} /> : null}
        <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50" style={{ color: '#fff' }} type="button" disabled={!email.trim() || busy} onClick={requestCode}>{busy ? <><LoaderCircle className="size-4 animate-spin" />Checking email…</> : 'Send verification code'}</button>
      </> : null}

      {step === 'code' ? <>
        <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>Code sent.</strong> Check the inbox of the account email you entered. The 6-digit code expires after 10 minutes.</div>
        <label className="mt-5 grid gap-2 text-sm font-semibold text-slate-700">Verification code<input className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-lg font-bold tracking-[0.35em] text-slate-950 outline-none" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoComplete="one-time-code" /></label>
        {error ? <ErrorMessage message={error} /> : null}
        <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50" style={{ color: '#fff' }} type="button" disabled={code.length !== 6 || busy} onClick={verifyCode}>{busy ? <><LoaderCircle className="size-4 animate-spin" />Verifying…</> : 'Verify code'}</button>
      </> : null}

      {step === 'password' ? <>
        <div className="mt-5 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p>Email verification passed. Create the new payment password below. This one password will be used for protected payment actions and account deletion.</p></div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">New payment password<input className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 6 characters" /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Confirm new payment password<input className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Enter it again" /></label>
        </div>
        {error ? <ErrorMessage message={error} /> : null}
        <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50" style={{ color: '#fff' }} type="button" disabled={!password || !confirm || busy} onClick={changePassword}>{busy ? <><LoaderCircle className="size-4 animate-spin" />Changing password…</> : 'Change payment password'}</button>
      </> : null}

      {step === 'done' ? <div className="mt-6 text-center"><CheckCircle2 className="mx-auto size-11 text-emerald-600" /><h3 className="mt-3 text-xl font-bold text-slate-950">Payment password changed</h3><p className="mt-2 text-sm leading-6 text-slate-600">Use your new payment password for wallet actions, creator payments, withdrawals, and account deletion.</p><button className="mt-6 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white" style={{ color: '#fff' }} type="button" onClick={() => close('Payment password changed successfully.')}>Done</button></div> : null}
    </div>
  </div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700" role="alert">{message}</p>;
}
