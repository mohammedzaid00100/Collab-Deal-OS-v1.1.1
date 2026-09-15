import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Icon className="size-5" aria-hidden="true" /></span><h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>{actionLabel && actionHref ? <Link className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" href={actionHref}>{actionLabel}</Link> : null}</div>;
}
