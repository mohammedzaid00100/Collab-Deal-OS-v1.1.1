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
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#0D0C1D] bg-[#F5F2EA] p-6 text-center dark:border-[#383E5E] dark:bg-[#121422]">
      <span className="flex size-11 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E213B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs font-medium leading-6 text-[#5A5870] dark:text-[#9CA1BA]">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          className="mt-4 inline-flex min-h-10 items-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-sm font-bold text-white shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-[#383E5E] dark:bg-[#6366F1] dark:shadow-[3px_3px_0_#000000]"
          style={{ color: '#fff' }}
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

