import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  href?: string;
  showName?: boolean;
  className?: string;
}

export function BrandLogo({
  href = '/',
  showName = true,
  className,
}: BrandLogoProps) {
  const mark = (
    <>
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-mark__link brand-mark__link--left" />
        <span className="brand-mark__link brand-mark__link--right" />
      </span>
      {showName ? <span className="text-slate-950 dark:text-white">Collab Deal OS</span> : null}
    </>
  );

  return href ? (
    <Link
      className={cn('wordmark text-slate-950 dark:text-white', className)}
      href={href}
      aria-label="Collab Deal OS home"
    >
      {mark}
    </Link>
  ) : (
    <span className={cn('wordmark text-slate-950 dark:text-white', className)}>{mark}</span>
  );
}
