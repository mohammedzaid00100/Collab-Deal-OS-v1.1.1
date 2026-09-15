import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { PublicHeader } from '@/components/public/public-header';
import { PublicFooter } from '@/components/public/public-footer';
import { publicPlans, type PlanDefinition } from '@/lib/plans';
import type { AccountType } from '@/types/domain';

export const metadata: Metadata = { title: 'Pricing' };

const audienceCopy = {
  creator: {
    eyebrow: 'Creator plans',
    title: 'Know your value at every stage.',
    description: 'Find opportunities and evaluate brand offers with creator-focused deal intelligence.',
  },
  brand: {
    eyebrow: 'Brand plans',
    title: 'Structure better creator investments.',
    description: 'Compare creator fit and evaluate requested or proposed deal terms from the brand perspective.',
  },
} as const;

export default function PricingPage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <PublicHeader />
      <main className="mx-auto w-[min(1120px,calc(100%-32px))] py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-violet-700">
            <Sparkles className="size-3.5" />
            Equal pricing. Role-specific value.
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.055em] text-slate-950 sm:text-5xl">
            Deal intelligence that pays for itself.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Creator and brand subscriptions have the same prices. Each presentation below explains the value for that side of the deal.
          </p>
        </div>

        <PricingSection role="creator" />
        <PricingSection role="brand" />

        <p className="mt-9 text-center text-xs leading-5 text-slate-500">
          Paid access activates only after a verified Razorpay webhook. Paid evaluation limits remain configuration-driven and will be published before billing is enabled.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

function PricingSection({ role }: { role: AccountType }) {
  const copy = audienceCopy[role];
  return (
    <section className="mt-16" aria-labelledby={`${role}-pricing-title`}>
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">{copy.eyebrow}</p>
        <h2 id={`${role}-pricing-title`} className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.description}</p>
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {publicPlans.map((plan) => <PlanCard key={plan.id} plan={plan} role={role} />)}
      </div>
    </section>
  );
}

function PlanCard({ plan, role }: { plan: PlanDefinition; role: AccountType }) {
  const featured = plan.id === 'PRO';
  const price = plan.monthlyPriceInr === 0 ? '₹0' : `₹${plan.monthlyPriceInr}`;
  return (
    <article className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${featured ? 'border-violet-300 bg-slate-950 text-white shadow-xl' : 'border-slate-200 bg-white text-slate-950'}`}>
      {featured ? <span className="absolute right-5 top-5 rounded-full bg-violet-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-200">Most popular</span> : null}
      <p className={`text-xs font-bold uppercase tracking-[0.1em] ${featured ? 'text-violet-300' : 'text-violet-700'}`}>{plan.name}</p>
      <div className="mt-5 flex items-end gap-2"><strong className="text-4xl tracking-[-0.04em]">{price}</strong><span className={`pb-1 text-sm ${featured ? 'text-slate-400' : 'text-slate-500'}`}>/ month</span></div>
      <p className={`mt-4 min-h-12 text-sm leading-6 ${featured ? 'text-slate-300' : 'text-slate-600'}`}>{planDescription(plan.id, role)}</p>
      <ul className="my-6 grid gap-3">{plan.features.map((feature) => <li className="flex gap-2.5 text-sm" key={feature}><Check className={`mt-0.5 size-4 shrink-0 ${featured ? 'text-emerald-300' : 'text-emerald-600'}`} aria-hidden="true" />{feature}</li>)}</ul>
      <Link className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ${featured ? 'bg-white text-slate-950' : 'bg-slate-950 text-white'}`} href={`/signup?role=${role}`}>
        {plan.id === 'FREE' ? `Start as ${role}` : `Choose ${plan.name}`}
      </Link>
    </article>
  );
}

function planDescription(plan: PlanDefinition['id'], role: AccountType) {
  if (plan === 'FREE') return role === 'creator' ? 'Explore opportunities and understand your first deals.' : 'Create your profile and structure your first collaborations.';
  if (plan === 'PRO') return role === 'creator' ? 'For creators evaluating an active deal pipeline.' : 'For brands running an active creator campaign pipeline.';
  return role === 'creator' ? 'For high-volume creator partnerships.' : 'For high-volume brand collaboration programs.';
}
