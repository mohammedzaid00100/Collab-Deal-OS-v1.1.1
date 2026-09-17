'use client';

import { useState } from 'react';
import { LockKeyhole, Trash2 } from 'lucide-react';
import type { AccountType } from '@/types/domain';

export function AccountClosureCard({ role }: { role: AccountType }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');

  return <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-6">
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><Trash2 className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-red-950">Danger zone</h2>
        <p className="mt-2 text-sm leading-6 text-red-800">Account deletion for this {role} workspace requires the same Collab Deal OS payment password used for protected wallet actions.</p>
        {!open ? <button className="mt-4 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700" type="button" onClick={() => setOpen(true)}>Delete account</button> : <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Payment password<div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><LockKeyhole className="size-4 text-slate-400" /><input className="min-h-12 w-full bg-transparent px-3 text-slate-950 outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter payment password" autoComplete="current-password" /></div></label>
          <p className="mt-2 text-xs leading-5 text-slate-500">Final account deletion will only be allowed after this password is verified.</p>
          <div className="mt-4 flex gap-2"><button className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700" type="button" onClick={() => { setOpen(false); setPassword(''); }}>Cancel</button><button className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={!password}>Verify and delete</button></div>
        </div>}
      </div>
    </div>
  </section>;
}
