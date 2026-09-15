import Link from 'next/link';
import { CircleAlert, DatabaseZap } from 'lucide-react';

interface ServiceStateProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

export function ServiceState({
  title = 'Secure account services are not connected yet',
  description = 'The interface is ready, but authentication needs the Supabase environment values before accounts can be created.',
  compact = false,
}: ServiceStateProps) {
  return (
    <section
      className={cnState(compact)}
      role="status"
      aria-live="polite"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
        {compact ? <CircleAlert className="size-5" /> : <DatabaseZap className="size-5" />}
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        {!compact ? (
          <Link className="mt-3 inline-block text-sm font-semibold text-violet-700 hover:text-violet-800" href="/setup">
            View connection checklist
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function cnState(compact: boolean) {
  return compact
    ? 'flex gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-left'
    : 'flex max-w-2xl gap-4 rounded-2xl border border-amber-200 bg-white p-5 text-left shadow-sm';
}
