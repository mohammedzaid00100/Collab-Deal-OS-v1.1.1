import type { ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-[#4F46E5] text-white border-2 border-[#0D0C1D] shadow-[3px_3px_0_#0D0C1D] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
  secondary:
    'bg-white text-[#0D0C1D] border-2 border-[#0D0C1D] shadow-[3px_3px_0_#0D0C1D] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
  ghost: 'bg-transparent text-[#5A5870] hover:bg-[#E0DACE] hover:text-[#0D0C1D]',
  danger:
    'bg-[#DC2626] text-white border-2 border-[#0D0C1D] shadow-[3px_3px_0_#0D0C1D] hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
};

export function Button({
  className,
  variant = 'primary',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4F46E5]/30 disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
