import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  DRAFT: 'border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PUBLISHED: 'border border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300',
  PAUSED: 'border border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-300',
  CLOSED: 'border border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300',
  ARCHIVED: 'border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

export function CampaignStatus({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.05em] shadow-[1px_1px_0_#0D0C1D] dark:shadow-none',
        styles[status] ?? styles.DRAFT,
        className
      )}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

