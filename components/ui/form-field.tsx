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
        <label className="text-sm font-semibold text-slate-800" htmlFor={name}>
          {label}
        </label>
        {optional ? (
          <span className="text-xs text-slate-400">Optional</span>
        ) : null}
      </div>
      {control}
      {error ? (
        <p className="text-xs font-medium text-red-600" id={`${name}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-slate-500" id={`${name}-hint`}>
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
        'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 sm:text-[15px]',
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
        'min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:text-[15px]',
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
        'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:text-[15px]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
