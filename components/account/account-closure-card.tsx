'use client';

import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import type { AccountType } from '@/types/domain';

export function AccountClosureCard({ role }: { role: AccountType }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function cancel() {
    if (busy) return;
    setOpen(false);
    setConfirmation('');
    setError('');
  }

  const isConfirmed = confirmation.trim() === 'DELETE MY ACCOUNT';

  async function removeAccount() {
    if (!isConfirmed || busy) return;
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/account/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: confirmation.trim() }),
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

  return (
    <section className="mt-6 rounded-[10px] border-2 border-red-300 bg-red-50/70 p-6 shadow-[3px_3px_0_#DC2626] dark:border-red-900/60 dark:bg-red-950/20 dark:shadow-[3px_3px_0_#000000]">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300">
          <Trash2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-red-950 dark:text-red-200">Danger zone</h2>
          <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-300/80">
            Permanently delete this {role} account and all associated profile, campaign, and deal records.
          </p>

          {!open ? (
            <button
              className="mt-4 min-h-11 rounded-[8px] border-2 border-red-500 bg-white px-4 text-sm font-bold text-red-700 shadow-[2px_2px_0_#DC2626] transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-red-700 dark:bg-[#161826] dark:text-red-400 dark:shadow-[2px_2px_0_#000000]"
              type="button"
              onClick={() => setOpen(true)}
            >
              Delete account
            </button>
          ) : (
            <div className="mt-4 rounded-[8px] border-2 border-red-300 bg-white p-4 dark:border-red-900 dark:bg-[#161826]">
              <p className="text-sm font-bold text-red-950 dark:text-red-200">This cannot be undone.</p>
              <p className="mt-1 text-xs leading-5 text-red-800 dark:text-red-300/80">
                Your Collab Deal OS account, profile, and associated product data will be permanently removed and you will be signed out.
              </p>

              <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                To confirm, type <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">DELETE MY ACCOUNT</span> below:
                <input
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  type="text"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  autoComplete="off"
                />
              </label>

              {error ? (
                <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                  type="button"
                  disabled={busy}
                  onClick={cancel}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40"
                  style={{ color: '#fff' }}
                  type="button"
                  disabled={!isConfirmed || busy}
                  onClick={removeAccount}
                >
                  {busy ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Permanently delete account
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

