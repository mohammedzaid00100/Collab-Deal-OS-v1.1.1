'use client';

import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign, CreditCard, History, ShieldCheck, WalletCards, X } from 'lucide-react';
import type { AccountType } from '@/types/domain';

const DEMO_TRANSACTIONS = [
  { label: 'Demo wallet created', detail: 'Prototype balance only', amount: '₹0', status: 'Demo' },
];

export function WalletPrototype({ role }: { role: AccountType }) {
  const [balance, setBalance] = useState(role === 'brand' ? 10000 : 700);
  const [dialog, setDialog] = useState<'add' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState('');
  const numericAmount = Number(amount) || 0;
  const canWithdraw = role === 'creator' && numericAmount >= 100 && numericAmount <= balance;
  const title = role === 'brand' ? 'Brand wallet' : 'Creator wallet';

  const helper = useMemo(() => role === 'brand'
    ? 'Add funds here, then use Pay Creator inside an eligible brand conversation. The platform commission is shown before confirmation.'
    : 'Your creator earnings appear here after a verified brand payment. The planned minimum withdrawal is ₹100.', [role]);

  function finishDemo() {
    if (dialog === 'add' && numericAmount > 0) {
      setBalance((current) => current + numericAmount);
      setNotice(`Demo top-up of ₹${numericAmount.toLocaleString('en-IN')} added.`);
    } else if (dialog === 'withdraw' && canWithdraw) {
      setBalance((current) => current - numericAmount);
      setNotice(`Demo withdrawal of ₹${numericAmount.toLocaleString('en-IN')} submitted.`);
    }
    setAmount('');
    setDialog(null);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Wallet prototype</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-slate-950">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{helper}</p>
        </div>
        <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.09em] text-amber-700">Demo mode · no real funds</span>
      </div>

      {notice ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{notice}</div> : null}

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg sm:p-7">
          <div className="flex items-center justify-between gap-4"><span className="flex size-11 items-center justify-center rounded-2xl bg-white/10"><WalletCards className="size-5" /></span><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-200">Prototype balance</span></div>
          <p className="mt-8 text-sm text-slate-300">Available balance</p>
          <strong className="mt-1 block text-5xl font-bold tracking-[-0.05em]">₹{balance.toLocaleString('en-IN')}</strong>
          <div className="mt-7 flex flex-wrap gap-2">
            {role === 'brand' ? <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950" type="button" onClick={() => { setDialog('add'); setNotice(''); }}><ArrowDownToLine className="size-4" />Add funds</button> : null}
            {role === 'creator' ? <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950" type="button" onClick={() => { setDialog('withdraw'); setNotice(''); }}><ArrowUpFromLine className="size-4" />Withdraw</button> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck className="size-5" /></span><h2 className="mt-4 font-bold text-slate-950">Payment security</h2><p className="mt-2 text-sm leading-6 text-slate-500">The final build will require a payment-specific PIN/password before money actions. Five failed attempts will temporarily lock payments.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CreditCard className="size-5" /></span><h2 className="mt-4 font-bold text-slate-950">Provider-backed settlement</h2><p className="mt-2 text-sm leading-6 text-slate-500">This prototype does not move money. Real balances will come from verified payment-provider events and webhooks.</p></div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><History className="size-5 text-violet-700" /><h2 className="font-bold text-slate-950">Recent activity</h2></div>
        <div className="mt-5 grid gap-3">{DEMO_TRANSACTIONS.map((item) => <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3" key={item.label}><div><strong className="text-sm text-slate-900">{item.label}</strong><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div><div className="text-right"><strong className="text-sm text-slate-900">{item.amount}</strong><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-600">{item.status}</p></div></div>)}</div>
      </section>

      {dialog ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={dialog === 'add' ? 'Add demo funds' : 'Demo withdrawal'}>
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Prototype only</p><h2 className="mt-1 text-xl font-bold text-slate-950">{dialog === 'add' ? 'Add funds' : 'Withdraw earnings'}</h2></div><button className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600" type="button" onClick={() => setDialog(null)} aria-label="Close"><X className="size-4" /></button></div>
          <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="wallet-demo-amount">Amount (INR)</label>
          <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><CircleDollarSign className="size-4 text-slate-400" /><input id="wallet-demo-amount" className="min-h-12 w-full bg-transparent px-3 text-lg font-bold text-slate-950 outline-none" inputMode="numeric" min="0" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div>
          {dialog === 'withdraw' ? <p className="mt-2 text-xs text-slate-500">Minimum demo withdrawal: ₹100. Available: ₹{balance.toLocaleString('en-IN')}.</p> : <p className="mt-2 text-xs text-slate-500">Demo top-up only. No card, bank or UPI transaction will occur.</p>}
          <button className="mt-6 min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={dialog === 'add' ? numericAmount <= 0 : !canWithdraw} onClick={finishDemo}>{dialog === 'add' ? 'Add demo funds' : 'Submit demo withdrawal'}</button>
        </div>
      </div> : null}
    </div>
  );
}
