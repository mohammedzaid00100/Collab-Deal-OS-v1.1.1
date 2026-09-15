'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ProductView } from '@/components/analytics/product-view';
import { Check, CreditCard, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { planCatalog } from '@/lib/plans';
import type { BillingPageData } from '@/lib/billing/account';
import type { AccountType, PlanTier } from '@/types/domain';

interface CheckoutConfirmation { razorpay_payment_id: string; razorpay_signature: string }
interface CheckoutOptions {
  key: string; subscription_id: string; name: string; description: string;
  handler: (response: CheckoutConfirmation) => void;
  modal: { ondismiss: () => void }; theme: { color: string };
}
type RazorpayConstructor = new (options: CheckoutOptions) => { open: () => void; on: (event: string, callback: () => void) => void };
declare global { interface Window { Razorpay?: RazorpayConstructor } }

let checkoutLoader: Promise<RazorpayConstructor> | null = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (checkoutLoader) return checkoutLoader;
  checkoutLoader = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout could not load.'));
    script.onerror = () => { script.remove(); checkoutLoader = null; reject(new Error('Checkout could not load. Check your connection and retry.')); };
    document.head.appendChild(script);
  });
  return checkoutLoader;
}

async function billingPost(path: string, body: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = z.object({ error: z.string().optional(), message: z.string().optional(),
    subscriptionId: z.string().optional(), keyId: z.string().optional(), status: z.string().optional(),
  }).parse(await response.json());
  if (!response.ok) throw new Error(data.error ?? 'Your billing request could not be completed.');
  return data;
}

export function SubscriptionScreen({ data, role, effectivePlan }: { data: BillingPageData; role: AccountType; effectivePlan: PlanTier }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const requests = useRef<Partial<Record<'PRO' | 'PREMIUM' | 'CANCEL', string>>>({
    ...(data.pending ? { [data.pending.plan]: data.pending.requestId } : {}),
  });
  const subscription = data.subscription;
  const active = effectivePlan !== 'FREE';
  const currentLimit = data.plans.find((plan) => plan.plan === subscription.plan)?.limit;
  const pending = data.pending;
  const providerOpen = subscription.provider_subscription_id && !['cancelled', 'completed', 'expired'].includes(subscription.provider_status ?? 'unknown');

  useEffect(() => {
    if (!confirming || active) return;
    let checks = 0;
    const timer = window.setInterval(() => { router.refresh(); checks += 1; if (checks >= 20) window.clearInterval(timer); }, 3000);
    return () => window.clearInterval(timer);
  }, [confirming, active, router]);

  async function start(plan: 'PRO' | 'PREMIUM') {
    setBusy(plan); setError(''); setMessage('');
    const requestId = requests.current[plan] ?? crypto.randomUUID(); requests.current[plan] = requestId;
    try {
      const Razorpay = await loadCheckout();
      const checkout = await billingPost('/api/billing/subscriptions', { requestId, plan });
      if (!checkout.subscriptionId || !checkout.keyId) { setMessage(checkout.message ?? 'Your previous checkout is still being confirmed.'); setBusy(null); router.refresh(); return; }
      const instance = new Razorpay({ key: checkout.keyId, subscription_id: checkout.subscriptionId,
        name: 'Collab Deal OS', description: `${role === 'creator' ? 'Creator' : 'Brand'} ${planCatalog[plan].name} — monthly`,
        theme: { color: '#7C3AED' },
        modal: { ondismiss: () => { setBusy(null); setMessage('Checkout closed. You can resume this payment here.'); router.refresh(); } },
        handler: async (result) => {
          try {
            const verified = await billingPost('/api/billing/subscriptions/verify', { requestId,
              razorpayPaymentId: result.razorpay_payment_id, razorpaySignature: result.razorpay_signature });
            setMessage(verified.message ?? 'Your subscription is being confirmed.'); setConfirming(true); router.refresh();
          } catch (error) { setError(error instanceof Error ? error.message : 'Payment confirmation is pending.'); }
          finally { setBusy(null); }
        },
      });
      instance.on('payment.failed', () => { setError('Payment was not completed. You can retry this checkout.'); setBusy(null); });
      instance.open();
    } catch (error) { setError(error instanceof Error ? error.message : 'Checkout is temporarily unavailable.'); setBusy(null); }
  }

  async function cancel() {
    setBusy('CANCEL'); setError('');
    const requestId = requests.current.CANCEL ?? crypto.randomUUID(); requests.current.CANCEL = requestId;
    try {
      const result = await billingPost('/api/billing/subscriptions/cancel', { requestId });
      setMessage(result.message ?? 'Your cancellation request is being confirmed.'); setConfirmCancel(false); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Cancellation is temporarily unavailable.'); }
    finally { setBusy(null); }
  }

  return <div className="space-y-7">
    <ProductView event="upgrade page viewed" />
    <header><p className="text-xs font-bold uppercase tracking-widest text-violet-700">{role} plans</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Your plan, your next opportunity</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Manage your AI evaluations and monthly subscription. Marketplace browsing and structured offers remain available on Free.</p></header>
    <section className="grid gap-4 sm:grid-cols-3">
      <Metric label="Current access" value={planCatalog[effectivePlan].name} detail={subscription.cancel_at_period_end ? 'Cancellation scheduled' : pretty(subscription.status)} />
      <Metric label="Lifetime free evaluations" value={`${data.freeRemaining} remaining`} detail="5 included with your account" />
      <Metric label={active ? 'Paid evaluations this period' : 'Monthly billing'} value={active && currentLimit ? `${Math.max(0, currentLimit - data.paidUsed)} remaining` : 'No active charge'} detail={active ? `Period ends ${date(subscription.current_period_end)}` : 'Choose a plan when you are ready'} />
    </section>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{active && confirming ? 'Your subscription is active.' : message}</p> : null}
    {pending && pending.status !== 'CREATED' ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your earlier checkout is being reconciled. Another checkout will be available once its outcome is confirmed.</p> : null}
    {subscription.status === 'PAST_DUE' ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your last payment needs attention. Use the payment recovery link sent by Razorpay to update your payment method. Paid AI access resumes after confirmation.</p> : null}
    <section className="grid gap-5 md:grid-cols-2">{data.plans.map(({ plan, limit, available }) => {
      const catalog = planCatalog[plan];
      const resume = pending?.plan === plan && pending.status === 'CREATED';
      const disabled = !available || active || Boolean(providerOpen && !resume) || Boolean(pending && !resume);
      return <article key={plan} className={`flex flex-col rounded-2xl border p-6 ${plan === 'PRO' ? 'border-violet-200 bg-white shadow-sm' : 'border-slate-800 bg-slate-950 text-white'}`}>
        <Sparkles className={`size-6 ${plan === 'PRO' ? 'text-violet-600' : 'text-violet-300'}`} /><h2 className="mt-5 text-xl font-bold">{role === 'creator' ? 'Creator' : 'Brand'} {catalog.name}</h2>
        <p className="mt-4"><strong className="text-4xl font-bold tracking-tight">₹{catalog.monthlyPriceInr}</strong><span className="ml-2 text-sm opacity-60">/ month</span></p>
        <ul className="my-6 space-y-3 text-sm"><li className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-500" />{limit ? `${limit} AI evaluations per billing period` : 'Evaluation allowance coming soon'}</li><li className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-500" />Saved analysis history and suggested counters</li><li className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-500" />Cancel renewal at the end of your period</li></ul>
        <Button className="mt-auto w-full" loading={busy === plan} disabled={disabled || busy !== null} onClick={() => start(plan)}><CreditCard className="size-4" />{effectivePlan === plan ? 'Current plan' : resume ? 'Resume checkout' : available ? `Choose ${catalog.name}` : 'Coming soon'}</Button>
        {available && data.totalCount ? <p className="mt-3 text-xs leading-5 opacity-60">Billed monthly for up to {data.totalCount} cycles unless cancelled. The checkout shows the final payment details.</p> : null}
      </article>;
    })}</section>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><p className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck className="size-5 text-emerald-600" />Payments are securely processed by Razorpay.</p><Button variant="secondary" onClick={() => router.refresh()}><RefreshCw className="size-4" />Refresh status</Button></section>
    {active && !subscription.cancel_at_period_end ? <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Manage renewal</h2><p className="mt-2 text-sm text-slate-500">Cancelling renewal keeps your current access until {date(subscription.current_period_end)}.</p>{confirmCancel ? <div className="mt-4 flex flex-wrap gap-3"><Button variant="danger" loading={busy === 'CANCEL'} onClick={cancel}>Confirm cancellation</Button><Button variant="secondary" disabled={busy !== null} onClick={() => setConfirmCancel(false)}>Keep subscription</Button></div> : <Button variant="secondary" className="mt-4" onClick={() => setConfirmCancel(true)}>Cancel renewal</Button>}</section> : null}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;
}
function pretty(value: string) { return value.toLowerCase().replaceAll('_', ' '); }
function date(value: string | null) { return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—'; }
