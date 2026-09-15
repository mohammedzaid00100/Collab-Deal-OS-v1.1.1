import Link from 'next/link';
import { ArrowLeft, CircleAlert, Sparkles } from 'lucide-react';
import { DealAdvisorForm } from './deal-advisor-form';
import { AnalysisHistory } from './analysis-history';
import type { DealAnalysisFormInput } from '@/lib/validation/analysis';
import type { AccountType } from '@/types/domain';
import type { DealAnalysisRecord } from '@/types/analysis';

export function AdvisorScreen({ role, initial, sourceLabel, freeRemaining, history, configured }: { role: AccountType; initial: DealAnalysisFormInput; sourceLabel: string | null; freeRemaining: number; history: DealAnalysisRecord[]; configured: boolean }) {
  return <>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950" href={`/${role}/dashboard`}><ArrowLeft className="size-4" />Dashboard</Link>
    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">AI Deal Advisor</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">Evaluate the deal, not the relationship</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">A transparent pricing engine fixes the fair range and score. AI adds a neutral explanation for your {role} perspective.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700"><Sparkles className="size-4" />No follower guessing</span></div>
    {!configured ? <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><CircleAlert className="mt-0.5 size-5 shrink-0" /><div><strong>Provider setup is incomplete.</strong><p className="mt-1 text-xs leading-5">The advisor interface is available, but server-only Supabase and OpenAI configuration is required to run an evaluation.</p></div></div> : null}
    <div className="mt-7"><DealAdvisorForm role={role} initialValues={initial} sourceLabel={sourceLabel} freeEvaluationsRemaining={freeRemaining} /></div>
    <div className="mt-8"><AnalysisHistory role={role} analyses={history} /></div>
  </>;
}
