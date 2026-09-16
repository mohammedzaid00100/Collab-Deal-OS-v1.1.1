'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';

export function WithdrawalActions({ withdrawalId }: { withdrawalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'complete' | 'reject' | null>(null);
  const [error, setError] = useState('');

  async function update(action: 'complete' | 'reject') {
    setBusy(action);
    setError('');
    try {
      const response = await fetch(`/api/developer/withdrawals/${withdrawalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.message ?? 'Could not update withdrawal.');
        return;
      }
      router.refresh();
    } catch {
      setError('Developer action is temporarily unavailable.');
    } finally {
      setBusy(null);
    }
  }

  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-2">
      <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50" style={{ color: '#fff' }} type="button" disabled={busy !== null} onClick={() => update('complete')}>
        {busy === 'complete' ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        Mark paid
      </button>
      <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-50" type="button" disabled={busy !== null} onClick={() => update('reject')}>
        {busy === 'reject' ? <LoaderCircle className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
        Reject
      </button>
    </div>
    {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
  </div>;
}
