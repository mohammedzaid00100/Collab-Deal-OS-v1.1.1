export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

export function isSafeInternalPath(value: string | null): value is string {
  return Boolean(
    value?.startsWith('/')
      && !value.startsWith('//')
      && !value.includes('\\')
      && !/[\u0000-\u001f\u007f]/.test(value),
  );
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}
