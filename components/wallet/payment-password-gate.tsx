'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { AccountType } from '@/types/domain';
import { hasPrototypePaymentPassword, savePrototypePaymentPassword } from '@/lib/prototype-payment-security';

export function PaymentPasswordGate({ role }: { role: AccountType }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void hasPrototypePaymentPassword(role).then((exists) => {
      if (active) setReady(exists);
    });
    return () => { active = false; };
  }, [role]);

  if (ready === true) return null;

  async function save() {
    setError('');
    if (password.length < 6) return setError('Use at least 6 characters for the payment password.');
    if (password !== confirm) return setError('The two passwords do not match.');

    setSaving(true);
    try {
      await savePrototypePaymentPassword(role, password);
      setPassword('');
      setConfirm('');
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the payment password.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create Collab Deal OS payment password">
    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><LockKeyhole className="size-5" /></span>
        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Payment security setup</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">Create your Collab Deal OS payment password</h2><p className="mt-2 text-sm leading-6 text-slate-500">This separate password is required for sensitive wallet actions and account deletion. It is different from Google sign-in and is stored as a one-way server-side hash.</p></div>
      </div>

      {ready === null ? <div className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500"><LoaderCircle className="size-4 animate-spin" />Checking payment security…</div> : <>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Payment password<input className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none focus:border-violet-300" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 6 characters" /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Confirm payment password<input className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none focus:border-violet-300" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Enter it again" /></label>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}

        <div className="mt-5 flex gap-3 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p><strong>Security:</strong> the plain payment password is not stored. The server keeps only a one-way password hash and temporarily locks verification after repeated failed attempts.</p></div>

        <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50" style={{ color: '#fff' }} type="button" disabled={saving} onClick={save}>{saving ? <><LoaderCircle className="size-4 animate-spin" />Saving…</> : 'Create payment password'}</button>
      </>}
    </div>
  </div>;
}
