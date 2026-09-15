import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Sparkles } from 'lucide-react';

interface RolePickerProps {
  mode: 'signup' | 'login';
}

const roleOptions = [
  {
    role: 'creator',
    title: 'Continue as creator',
    description: 'Evaluate offers, find opportunities, and understand your deal value.',
    Icon: Sparkles,
    iconClass: 'bg-violet-50 text-violet-700',
  },
  {
    role: 'brand',
    title: 'Continue as brand',
    description: 'Discover creators, build campaigns, and structure stronger offers.',
    Icon: BriefcaseBusiness,
    iconClass: 'bg-blue-50 text-blue-700',
  },
] as const;

export function RolePicker({ mode }: RolePickerProps) {
  return (
    <div className="grid gap-3" aria-label="Choose your account type">
      {roleOptions.map(({ role, title, description, Icon, iconClass }) => (
        <Link
          className="group flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          href={`/${mode}?role=${role}`}
          key={role}
        >
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[15px] text-slate-900">{title}</strong>
            <span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
