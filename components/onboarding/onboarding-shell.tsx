import type { ReactNode } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

interface OnboardingShellProps {
  accountLabel: string;
  step: number;
  steps: readonly string[];
  title: string;
  description: string;
  children: ReactNode;
}

export function OnboardingShell({
  accountLabel,
  step,
  steps,
  title,
  description,
  children,
}: OnboardingShellProps) {
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <main className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-18 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4">
          <BrandLogo />
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
            {accountLabel} setup
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-8 py-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-12">
        <aside>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-violet-700">
            Step {step + 1} of {steps.length}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 lg:hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-6 hidden gap-1 lg:grid">
            {steps.map((label, index) => (
              <li className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${index === step ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : index < step ? 'text-violet-700' : 'text-slate-400'}`} key={label} aria-current={index === step ? 'step' : undefined}>
                <span className={`flex size-7 items-center justify-center rounded-full text-xs ${index < step ? 'bg-violet-600 text-white' : index === step ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
                  {index < step ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]"><LockKeyhole className="size-4" />Next security step</div>
            <p className="mt-2 text-xs leading-5 text-violet-800">After the profile is completed, Collab Deal OS requires a separate payment password before the workspace can be used for wallet actions, withdrawals, or creator payments.</p>
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
