'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  History,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import type { AccountType } from '@/types/domain';
import {
  appendPrototypeTransaction,
  loadPrototypeWallet,
  makePrototypeTransaction,
  reconcilePrototypeWithdrawals,
  type PrototypeWalletState,
  type SharedPrototypeWithdrawal,
} from '@/lib/prototype-wallet';
import { verifyPrototypePaymentPassword } from '@/lib/prototype-payment-security';

const MIN_WITHDRAWAL = 100;
const EMPTY_WALLET: PrototypeWalletState = { balance: 0, transactions: [] };

type Dialog = 'add' | 'withdraw' | null;
type WithdrawStep = 'amount' | 'upi' | 'confirm' | 'password' | 'submitted';

export function WalletPrototype({ role }: { role: AccountType }) {
  const [wallet, setWallet] = useState<PrototypeWalletState>(EMPTY_WALLET);
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('amount');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  useEffect(() => {
    let active = true;
    setWallet(loadPrototypeWallet(role));
    setLoaded(true);

    async function syncWithdrawals() {
      try {
        const response = await fetch('/api/wallet/withdrawals', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json() as { ok?: boolean; withdrawals?: SharedPrototypeWithdrawal[] };
        if (!active || !payload.ok || !payload.withdrawals) return;
        setWallet(reconcilePrototypeWithdrawals(role, payload.withdrawals));
      } catch {
        // The local prototype wallet remains usable if the shared status feed is temporarily unavailable.
      }
    }

    void syncWithdrawals();
    const interval = window.setInterval(syncWithdrawals, 5000);
    window.addEventListener('focus', syncWithdrawals);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', syncWithdrawals);
    };
  }, [role]);

  const numericAmount = Number(amount) || 0;
  const upiValid = /^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/.test(upiId.trim());
  const pendingWithdrawalAmount = wallet.transactions
    .filter((item) => item.type === 'WITHDRAWAL' && item.status === 'Pending')
    .reduce((sum, item) => sum + item.amount, 0);
  const amountAvailableForNewRequest = Math.max(0, wallet.balance - pendingWithdrawalAmount);
  const canWithdraw = numericAmount >= MIN_WITHDRAWAL && numericAmount <= amountAvailableForNewRequest;
  const title = role === 'brand' ? 'Brand wallet' : 'Creator wallet';
  const pendingWithdrawals = wallet.transactions.filter((item) => item.type === 'WITHDRAWAL' && item.status === 'Pending');

  const helper = useMemo(() => role === 'brand'
    ? 'Add funds before paying creators. Unused prototype funds can also be submitted for withdrawal. Brand-to-creator payments remain a separate prototype flow inside Messages.'
    : 'Creator earnings appear here after a brand payment. Withdrawal requests are reviewed manually by Collab Deal OS and may take up to 1-2 working days.', [role]);

  function resetFlow() {
    setDialog(null);
    setWithdrawStep('amount');
    setAmount('');
    setUpiId('');
    setPassword('');
    setError('');
    setFailedAttempts(0);
    setLockedUntil(0);
    setSubmittingWithdrawal(false);
  }

  function openDialog(next: Dialog) {
    setNotice('');
    setError('');
    setDialog(next);
    setWithdrawStep('amount');
    setAmount('');
    setUpiId('');
    setPassword('');
  }

  function addFunds() {
    if (numericAmount <= 0) return;
    const next = appendPrototypeTransaction(role, makePrototypeTransaction({
      type: 'TOP_UP',
      label: 'Funds added',
      detail: 'Prototype wallet top-up · no real payment processed',
      amount: numericAmount,
      direction: 'in',
      status: 'Completed',
    }), numericAmount);
    setWallet(next);
    setNotice(`Demo top-up of ₹${numericAmount.toLocaleString('en-IN')} added.`);
    resetFlow();
  }

  async function approveWithdrawalWithPassword() {
    setError('');
    if (Date.now() < lockedUntil) {
      setError('Payment password is temporarily locked after repeated failed attempts. Try again shortly.');
      return;
    }

    const valid = await verifyPrototypePaymentPassword(role, password);
    if (!valid) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setLockedUntil(Date.now() + 60_000);
        setError('Five incorrect attempts. Prototype payment actions are temporarily locked for 1 minute.');
      } else {
        setError(`Incorrect payment password. ${5 - nextAttempts} attempt${5 - nextAttempts === 1 ? '' : 's'} remaining before temporary lock.`);
      }
      return;
    }

    if (!canWithdraw || !upiValid) {
      setError('The withdrawal amount or UPI ID is no longer valid. Go back and review the request.');
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const response = await fetch('/api/wallet/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, upiId: upiId.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean;
        message?: string;
        withdrawal?: SharedPrototypeWithdrawal;
      };
      if (!response.ok || !payload.ok || !payload.withdrawal) {
        setError(payload.message ?? 'Could not submit the withdrawal request.');
        return;
      }

      const request = payload.withdrawal;
      const next = appendPrototypeTransaction(role, makePrototypeTransaction({
        serverRequestId: request.id,
        type: 'WITHDRAWAL',
        label: 'Withdrawal requested',
        detail: `UPI: ${request.upi_id} · manual operator review pending`,
        amount: request.amount_inr,
        direction: 'out',
        status: 'Pending',
        upiId: request.upi_id,
      }), 0);
      setWallet(next);
      setWithdrawStep('submitted');
      setPassword('');
      setNotice(`Withdrawal request for ₹${request.amount_inr.toLocaleString('en-IN')} is pending. Your wallet balance has not been deducted yet.`);
    } catch {
      setError('Withdrawal request service is temporarily unavailable.');
    } finally {
      setSubmittingWithdrawal(false);
    }
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
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg sm:p-7" style={{ color: '#fff' }}>
          <div className="flex items-center justify-between gap-4"><span className="flex size-11 items-center justify-center rounded-2xl bg-white/10"><WalletCards className="size-5" /></span><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-200">Prototype balance</span></div>
          <p className="mt-8 text-sm text-slate-300">Available balance</p>
          <strong className="mt-1 block text-5xl font-bold tracking-[-0.05em]">{loaded ? `₹${wallet.balance.toLocaleString('en-IN')}` : '—'}</strong>
          {pendingWithdrawalAmount > 0 ? <p className="mt-2 text-xs text-amber-200">₹{pendingWithdrawalAmount.toLocaleString('en-IN')} currently pending withdrawal review.</p> : null}
          <div className="mt-7 flex flex-wrap gap-2">
            {role === 'brand' ? <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950" type="button" onClick={() => openDialog('add')}><ArrowDownToLine className="size-4" />Add funds</button> : null}
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white" style={{ color: '#fff' }} type="button" onClick={() => openDialog('withdraw')}><ArrowUpFromLine className="size-4" />Withdraw funds</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck className="size-5" /></span><h2 className="mt-4 font-bold text-slate-950">Payment security</h2><p className="mt-2 text-sm leading-6 text-slate-500">Money actions require the separate Collab Deal OS payment password. Five failed attempts temporarily lock the prototype flow.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CreditCard className="size-5" /></span><h2 className="mt-4 font-bold text-slate-950">Manual payout operations</h2><p className="mt-2 text-sm leading-6 text-slate-500">UPI IDs are submitted for operator review. The developer tool marks the request successful only after the payout has been handled outside this prototype.</p></div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="size-5 text-violet-700" /><h2 className="font-bold text-slate-950">Transaction history</h2></div><span className="text-xs text-slate-400">Prototype records + shared withdrawal status</span></div>
        <div className="mt-5 grid gap-3">{wallet.transactions.length ? wallet.transactions.map((item) => <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}><div><strong className="text-sm text-slate-900">{item.label}</strong><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(item.createdAt)}</p></div><div className="text-right"><strong className={`text-sm ${item.direction === 'in' ? 'text-emerald-700' : 'text-slate-900'}`}>{item.direction === 'in' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}</strong><p className={`mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${item.status === 'Completed' ? 'text-emerald-600' : item.status === 'Pending' ? 'text-amber-600' : 'text-red-600'}`}>{item.status}</p></div></div>) : <p className="text-sm text-slate-500">No transactions yet.</p>}</div>
      </section>

      {pendingWithdrawals.length ? <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><Clock3 className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><h2 className="text-sm font-bold text-amber-950">{pendingWithdrawals.length} withdrawal request{pendingWithdrawals.length === 1 ? '' : 's'} pending</h2><p className="mt-1 text-xs leading-5 text-amber-800">Withdrawals can take up to 1-2 working days. Your displayed wallet balance is not deducted until Collab Deal OS marks the payout as completed.</p></div></div></section> : null}

      {dialog ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={dialog === 'add' ? 'Add prototype funds' : 'Prototype withdrawal'}>
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Prototype wallet</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">{dialog === 'add' ? 'Add funds' : 'Withdraw funds'}</h2></div><button className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600" type="button" onClick={resetFlow} aria-label="Close"><X className="size-4" /></button></div>

          {dialog === 'add' ? <>
            <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="wallet-add-amount">Amount (INR)</label>
            <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><CircleDollarSign className="size-4 text-slate-400" /><input id="wallet-add-amount" className="min-h-12 w-full bg-transparent px-3 text-lg font-bold text-slate-950 outline-none" inputMode="numeric" min="0" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1000" /></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Prototype top-up only. No card, bank or UPI transaction occurs yet.</p>
            <button className="mt-6 min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={numericAmount <= 0} onClick={addFunds}>Add demo funds</button>
          </> : <WithdrawalFlow step={withdrawStep} amount={amount} setAmount={setAmount} numericAmount={numericAmount} balance={wallet.balance} pendingAmount={pendingWithdrawalAmount} canWithdraw={canWithdraw} upiId={upiId} setUpiId={setUpiId} upiValid={upiValid} password={password} setPassword={setPassword} error={error} submitting={submittingWithdrawal} onNextAmount={() => setWithdrawStep('upi')} onNextUpi={() => setWithdrawStep('confirm')} onApprove={() => setWithdrawStep('password')} onReject={resetFlow} onSubmitPassword={approveWithdrawalWithPassword} onDone={resetFlow} />}
        </div>
      </div> : null}
    </div>
  );
}

function WithdrawalFlow({ step, amount, setAmount, numericAmount, balance, pendingAmount, canWithdraw, upiId, setUpiId, upiValid, password, setPassword, error, submitting, onNextAmount, onNextUpi, onApprove, onReject, onSubmitPassword, onDone }: {
  step: WithdrawStep;
  amount: string;
  setAmount: (value: string) => void;
  numericAmount: number;
  balance: number;
  pendingAmount: number;
  canWithdraw: boolean;
  upiId: string;
  setUpiId: (value: string) => void;
  upiValid: boolean;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  submitting: boolean;
  onNextAmount: () => void;
  onNextUpi: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSubmitPassword: () => void;
  onDone: () => void;
}) {
  if (step === 'amount') return <>
    <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.09em] text-slate-400"><span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">1</span>Amount</div>
    <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="wallet-withdraw-amount">How much do you want to withdraw?</label>
    <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><CircleDollarSign className="size-4 text-slate-400" /><input id="wallet-withdraw-amount" className="min-h-12 w-full bg-transparent px-3 text-lg font-bold text-slate-950 outline-none" inputMode="numeric" min="0" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="100" /></div>
    <p className="mt-2 text-xs text-slate-500">Minimum: ₹{MIN_WITHDRAWAL}. Wallet balance: ₹{balance.toLocaleString('en-IN')}. Pending requests reserve ₹{pendingAmount.toLocaleString('en-IN')}.</p>
    <button className="mt-6 min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={!canWithdraw} onClick={onNextAmount}>Continue</button>
  </>;

  if (step === 'upi') return <>
    <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.09em] text-slate-400"><span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">2</span>UPI destination</div>
    <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="wallet-upi">Enter your UPI ID</label>
    <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><Landmark className="size-4 text-slate-400" /><input id="wallet-upi" className="min-h-12 w-full bg-transparent px-3 text-slate-950 outline-none" value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="name@bank" autoCapitalize="none" /></div>
    <p className="mt-2 text-xs leading-5 text-slate-500">For this prototype, Collab Deal OS records the UPI ID exactly as entered. The operator will manually review the destination before completing the payout.</p>
    <button className="mt-6 min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={!upiValid} onClick={onNextUpi}>Continue</button>
  </>;

  if (step === 'confirm') return <>
    <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.09em] text-slate-400"><span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">3</span>Confirmation</div>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">Withdrawal amount</span><strong className="text-slate-950">₹{numericAmount.toLocaleString('en-IN')}</strong></div><div className="mt-3 flex justify-between gap-4 text-sm"><span className="text-slate-500">UPI ID</span><strong className="break-all text-right text-slate-950">{upiId}</strong></div></div>
    <p className="mt-4 text-sm leading-6 text-slate-600">Check the amount and UPI ID carefully. After approval, your Collab Deal OS payment password is required and the request becomes Pending for manual payout review.</p>
    <div className="mt-6 grid gap-2 sm:grid-cols-2"><button className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" type="button" onClick={onReject}>Reject withdrawal</button><button className="min-h-12 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white" style={{ color: '#fff' }} type="button" onClick={onApprove}>Approve withdrawal</button></div>
  </>;

  if (step === 'password') return <>
    <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.09em] text-slate-400"><span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">4</span>Payment password</div>
    <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="wallet-payment-password">Confirm with your Collab Deal OS payment password</label>
    <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4"><LockKeyhole className="size-4 text-slate-400" /><input id="wallet-payment-password" className="min-h-12 w-full bg-transparent px-3 text-slate-950 outline-none" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Payment password" /></div>
    {error ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
    <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40" style={{ color: '#fff' }} type="button" disabled={!password || submitting} onClick={onSubmitPassword}>{submitting ? <><LoaderCircle className="size-4 animate-spin" />Submitting withdrawal…</> : 'Confirm withdrawal'}</button>
  </>;

  return <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><Clock3 className="mx-auto size-10 text-amber-700" /><h3 className="mt-3 text-lg font-bold text-amber-950">Withdrawal pending</h3><p className="mt-2 text-sm leading-6 text-amber-800">Your request is now pending. Withdrawals can take up to 1-2 working days. Your wallet balance will remain unchanged until Collab Deal OS marks the payout as completed.</p><button className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white" style={{ color: '#fff' }} type="button" onClick={onDone}><CheckCircle2 className="mr-2 inline size-4" />Done</button></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
