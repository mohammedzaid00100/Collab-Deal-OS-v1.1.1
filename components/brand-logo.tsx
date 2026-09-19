import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  href?: string;
  showName?: boolean;
  className?: string;
  imgClassName?: string;
}

export function BrandLogo({
  href = '/',
  showName = true,
  className,
  imgClassName,
}: BrandLogoProps) {
  const mark = (
    <>
      <span className="brand-mark" aria-hidden="true">
        <img
          src="/brand-logo.png"
          alt="Collab Deal OS logo"
          width={50}
          height={24}
          className={cn('brand-mark-img', imgClassName)}
          loading="eager"
          decoding="async"
        />
      </span>
      {showName ? <span className="font-extrabold tracking-tight text-inherit">Collab Deal OS</span> : null}
    </>
  );

  return href ? (
    <Link
      className={cn('wordmark text-[#0D0C1D] dark:text-white', className)}
      href={href}
      aria-label="Collab Deal OS home"
    >
      {mark}
    </Link>
  ) : (
    <span className={cn('wordmark text-[#0D0C1D] dark:text-white', className)}>{mark}</span>
  );
}

