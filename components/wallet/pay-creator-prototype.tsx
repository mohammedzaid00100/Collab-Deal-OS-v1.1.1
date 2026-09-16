'use client';

import { useMemo, useState } from 'react';
import { BadgeIndianRupee, CheckCircle2, Clock3, LockKeyhole, WalletCards, X } from 'lucide-react';

const COMMISSION_RATE = 0.08;

export function PayCreatorPrototype({ creatorName }: { creatorName: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const creatorAmount = Number(amount) || 0;
  const commission = useMemo(() => Math.round(creatorAmount * COMMISSION_RATE * 100) / 100, [creatorAmount]);
  const total = creatorAmount + commission;
  const valid = creatorAmount > 0 && /^\d{4,8}$/.test(pin);

  function close() {
    setOpen(false);
    setAmount('');
    setPin('');
    setStatus('idle');
  }

  function confirm() {
    if (!valid) return;
    setStatus('processing');
    window.setTimeout(() => setStatus('success'), 950);
  }

  return <>
    <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm" style={{ color: '#fff' }} type="button" onClick={() => setOpen(true)}><BadgeIndianRupee className="size-4" />Pay creator</button>
    {open ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pay creator prototype">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Prototype payment</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">Pay {creatorName}</h2><p className="mt-2 text-sm leading-6 text-slate-500">This demonstrates the final Collab Deal OS payment flow. No real money moves in prototype mode.</p></div><button className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600" type="button" onClick={close} aria-label="Close"><X className="size-4" /></button></div>

        {status === 'success' ? <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><h3 className="mt-3 text-lg font-bold text-emerald-950">Demo payment confirmed</h3><p className="mt-2 text-sm leading-6 text-emerald-800">₹{creatorAmount.toLocaleString('en-IN')} would be credited to the creator flow, while ₹{commission.toLocaleString('en-IN')} is the 8% Collab Deal OS commission. Brand total: ₹{total.toLocaleString('en-IN')}.</p><button className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white" style={{ color: '#fff' }} type="button" onClick={close}>Done</button></div> : <>
          <div className="mt-6 grid gap-4">
            <div><label className="text-sm font-semibold text-slate-700" htmlFor="prototype-payment-amount">Creator amount (INR)</label><div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><WalletCards className="size-4 text-slate-400" /><input id="prototype-payment-amount" className="min-h-12 w-full bg-transparent px-3 text-lg font-bold text-slate-950 outline-none" inputMode="numeric" min="0" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="700" /></div></div>
            <div><label className="text-sm font-semibold text-slate-700" htmlFor="prototype-payment-pin">Payment PIN / password</label><div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><LockKeyhole className="size-4 text-slate-400" /><input id="prototype-payment-pin" className="min-h-12 w-full bg-transparent px-3 text-slate-950 outline-none" inputMode="numeric" maxLength={8} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4-8 digits" /></div><p className="mt-2 text-xs text-slate-500">Prototype only: the entered PIN is not stored or verified. Final design: 5 failed attempts temporarily lock payments.</p></div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">Creator receives</span><strong className="text-slate-950">₹{creatorAmount.toLocaleString('en-IN')}</strong></div><div className="mt-3 flex justify-between gap-4 text-sm"><span className="text-slate-500">Collab Deal OS commission (8%)</span><strong className="text-slate-950">₹{commission.toLocaleString('en-IN')}</strong></div><div className="mt-3 border-t border-slate-200 pt-3 flex justify-between gap-4"><span className="font-bold text-slate-700">Brand pays</span><strong className="text-lg text-slate-950">₹{total.toLocaleString('en-IN')}</strong></div></div>

          <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><Clock3 className="mt-0.5 size-4 shrink-0" /><span>After confirmation, the real product will show: “Payment processing may take up to 1-2 minutes.” Final success comes only after provider/webhook verification.</span></div>

          <button className="mt-6 min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={!valid || status === 'processing'} onClick={confirm}>{status === 'processing' ? 'Processing demo payment…' : `Confirm demo payment${total ? ` · ₹${total.toLocaleString('en-IN')}` : ''}`}</button>
        </>}
      </div>
    </div> : null}
  </>;
}
