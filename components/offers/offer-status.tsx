import { cn } from '@/lib/utils';

const styles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', SENT: 'bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700', REVISED: 'bg-violet-50 text-violet-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-emerald-50 text-emerald-800',
  REJECTED: 'bg-red-50 text-red-700', EXPIRED: 'bg-slate-100 text-slate-500',
};

export function OfferStatus({ status, className }: { status: string; className?: string }) { return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em]', styles[status] ?? styles.DRAFT, className)}>{status.replaceAll('_', ' ')}</span>; }
