'use client';

import { useState } from 'react';
import { LoaderCircle, LockKeyhole, Trash2 } from 'lucide-react';
import type { AccountType } from '@/types/domain';
import { PaymentPasswordRecoveryDialog } from './payment-password-recovery-dialog';

export function AccountClosureCard({ role }: { role: AccountType }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  function cancel() {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setError('');
  }

  async function removeAccount() {
    if (!password || busy) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/account/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPassword: password }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.message ?? 'Could not delete the account.');
        return;
      }

      window.localStorage.clear();
      window.location.assign('/?account_deleted=1');
    } catch {
      setError('Account deletion is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><Trash2 className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-red-950">Danger zone</h2>
          <p className="mt-2 text-sm leading-6 text-red-800">Permanently deleting this {role} account requires the same Collab Deal OS payment password used for protected wallet actions.</p>
          {notice ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800" role="status">{notice}</p> : null}

          {!open ? <button className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700" type="button" onClick={() => setOpen(true)}>Delete account</button> : <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
            <p className="text-sm font-bold text-red-950">This cannot be undone.</p>
            <p className="mt-1 text-xs leading-5 text-red-800">Your Collab Deal OS account, profile, and associated product data will be removed and you will be signed out.</p>

            <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Payment password<div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><LockKeyhole className="size-4 text-slate-400" /><input className="min-h-12 w-full bg-transparent px-3 text-slate-950 outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter the same payment password" autoComplete="current-password" /></div></label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-5 text-slate-500">Five incorrect attempts temporarily lock payment-password verification.</p><button className="text-xs font-bold text-violet-700 hover:underline" type="button" onClick={() => { setError(''); setRecoveryOpen(true); }}>Forgot payment password?</button></div>

            {error ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:opacity-50" type="button" disabled={busy} onClick={cancel}>Cancel</button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={!password || busy} onClick={removeAccount}>{busy ? <><LoaderCircle className="size-4 animate-spin" />Deleting…</> : <><Trash2 className="size-4" />Verify and delete</>}</button>
            </div>
          </div>}
        </div>
      </div>
    </section>

    <PaymentPasswordRecoveryDialog
      open={recoveryOpen}
      onClose={(message) => { setRecoveryOpen(false); if (message) setNotice(message); }}
      onReset={() => { setPassword(''); setError(''); setNotice('Payment password changed. Use the new password to continue account deletion.'); }}
    />
  </>;
}
