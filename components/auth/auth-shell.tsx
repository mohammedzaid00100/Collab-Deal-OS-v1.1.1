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
    <main className="min-h-svh bg-[#F8F9FA] transition-colors dark:bg-[#0B0C14] lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(560px,1.18fr)]">
      <aside className="relative hidden overflow-hidden border-r-2 border-[#0D0C1D] bg-[#1E1B4B] px-12 py-10 text-white dark:border-[#383E5E] dark:bg-[#111326] lg:flex lg:flex-col">
        <div className="absolute -left-32 top-20 size-96 rounded-full bg-[#4F46E5]/20 blur-3xl" />
        <div className="absolute -right-28 bottom-12 size-80 rounded-full bg-[#D97706]/15 blur-3xl" />
        <BrandLogo className="relative z-10 text-white" />

        <div className="relative z-10 my-auto max-w-md py-12">
          <span className="inline-block rounded-[6px] border border-[#A5B4FC]/30 bg-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#A5B4FC] shadow-[2px_2px_0_rgba(0,0,0,0.3)]">
            Brand–creator deals, made clear
          </span>
          <h2 className="mt-5 text-3xl font-bold leading-tight tracking-[-0.045em] text-white sm:text-4xl">
            Better terms start with a better understanding.
          </h2>
          <p className="mt-4 text-[15px] font-medium leading-7 text-[#C7D2FE]">
            Collab Deal OS gives both sides the same structured facts—fit, scope,
            value, messages, and a clear deal history.
          </p>

          <div className="mt-8 grid gap-3">
            {valuePoints.map(([Icon, label]) => (
              <div
                className="flex items-center gap-3.5 rounded-[8px] border-2 border-white/20 bg-white/10 p-3 shadow-[2px_2px_0_rgba(0,0,0,0.3)] backdrop-blur-sm"
                key={label}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[6px] border-2 border-white/20 bg-white/15 text-[#A5B4FC] shadow-[1px_1px_0_rgba(0,0,0,0.2)]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs font-semibold uppercase tracking-wider text-white/50">
          Neutral by design. Built for creators and brands.
        </p>
      </aside>

      <section className="flex min-h-svh flex-col bg-[#F8F9FA] px-5 py-6 transition-colors dark:bg-[#0B0C14] sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <BrandLogo />
          </div>
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3.5 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none dark:border-[#383E5E] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]"
            href="/"
          >
            ← Back to home
          </Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-[520px] py-10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5] dark:text-[#818CF8]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-[2.2rem] dark:text-[#F3F4F8]">
            {title}
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[#5A5870] dark:text-[#9CA1BA]">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
