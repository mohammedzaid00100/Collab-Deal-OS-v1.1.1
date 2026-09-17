import type { ReactNode } from 'react';
import Link from 'next/link';
import { BadgeIndianRupee, GitCompareArrows, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

const valuePoints = [
  [BadgeIndianRupee, 'Clear deal value before negotiation'],
  [GitCompareArrows, 'Direct messaging with structured offers'],
  [ShieldCheck, 'Private, role-aware deal data'],
] as const;

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-slate-50 lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(560px,1.18fr)]">
      <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col">
        <div className="absolute -left-32 top-20 size-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -right-28 bottom-12 size-80 rounded-full bg-blue-600/20 blur-3xl" />
        <BrandLogo className="relative z-10 text-white" />

        <div className="relative z-10 my-auto max-w-md py-12">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
            Brand–creator deals, made clear
          </p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-[-0.045em]">
            Better terms start with a better understanding.
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-slate-300">
            Collab Deal OS gives both sides the same structured facts—fit, scope,
            value, messages, and a clear deal history.
          </p>

          <div className="mt-10 grid gap-4">
            {valuePoints.map(([Icon, label]) => (
              <div className="flex items-center gap-3 text-sm text-slate-200" key={label}>
                <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-violet-300">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          Neutral by design. Built for creators and brands.
        </p>
      </aside>

      <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <BrandLogo />
          </div>
          <Link className="text-sm font-semibold text-slate-600 hover:text-violet-700" href="/">
            Back to home
          </Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-[520px] py-12">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-[2.2rem]">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-600">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
