import type { LucideIcon } from 'lucide-react';
import { EmptyState } from './empty-state';

interface FeaturePageProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  actionHref?: string;
}

export function FeaturePage({ eyebrow, title, description, icon, emptyTitle, emptyDescription, actionLabel, actionHref }: FeaturePageProps) {
  return <><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">{eyebrow}</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div><section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><EmptyState icon={icon} title={emptyTitle} description={emptyDescription} actionLabel={actionLabel} actionHref={actionHref} /></section></>;
}
