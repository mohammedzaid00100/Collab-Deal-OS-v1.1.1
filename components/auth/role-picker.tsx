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
    <div className="grid gap-4" aria-label="Choose your account type">
      {roleOptions.map(({ role, title, description, Icon }) => (
        <Link
          className="group flex min-h-28 items-center gap-4 rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] transition-all hover:-translate-y-0.5 hover:bg-[#FBF9F5] hover:shadow-[6px_6px_0_#0D0C1D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] dark:hover:bg-[#1C1E30]"
          href={`/${mode}?role=${role}`}
          key={role}
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[2px_2px_0_#000000]">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{title}</strong>
            <span className="mt-1 block text-xs font-medium leading-5 text-[#5A5870] dark:text-[#9CA1BA]">{description}</span>
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#F5F2EA] text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all group-hover:bg-[#4F46E5] group-hover:text-white dark:border-[#383E5E] dark:bg-[#1E2134] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000] dark:group-hover:bg-[#6366F1] dark:group-hover:text-white">
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}
