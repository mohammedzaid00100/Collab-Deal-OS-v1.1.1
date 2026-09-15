import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  CLOSED: 'bg-blue-50 text-blue-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

export function CampaignStatus({ status, className }: { status: string; className?: string }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em]', styles[status] ?? styles.DRAFT, className)}>{status.replaceAll('_', ' ')}</span>;
}
