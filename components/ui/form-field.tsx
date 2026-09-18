import type {
  InputHTMLAttributes,
  ReactElement,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactElement;
}

export function FieldShell({
  label,
  name,
  hint,
  error,
  optional,
  children,
}: FieldShellProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>, {
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })
    : children;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-[#0D0C1D]" htmlFor={name}>
          {label}
        </label>
        {optional ? (
          <span className="text-xs text-[#5A5870]">Optional</span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p className="text-xs font-medium text-[#DC2626]" id={`${name}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-[#5A5870]" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3.5 text-base text-[#0D0C1D] outline-none transition-shadow placeholder:text-[#5A5870] focus:border-[#4F46E5] focus:shadow-[3px_3px_0_#4F46E5] disabled:bg-[#F5F2EA] sm:text-[15px]',
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full resize-y rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3.5 py-3 text-base text-[#0D0C1D] outline-none transition-shadow placeholder:text-[#5A5870] focus:border-[#4F46E5] focus:shadow-[3px_3px_0_#4F46E5] sm:text-[15px]',
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'min-h-11 w-full rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3.5 text-base text-[#0D0C1D] outline-none transition-shadow focus:border-[#4F46E5] focus:shadow-[3px_3px_0_#4F46E5] sm:text-[15px]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
