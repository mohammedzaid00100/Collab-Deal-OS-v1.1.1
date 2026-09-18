import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export function PublicHeader() {
  return <header className="border-b-2 border-[#0D0C1D] bg-[#F5F2EA]"><div className="mx-auto flex min-h-18 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4"><BrandLogo /><nav className="flex items-center gap-3" aria-label="Public navigation"><Link className="hidden text-sm font-semibold text-[#5A5870] hover:text-[#0D0C1D] sm:block" href="/pricing">Pricing</Link><Link className="text-sm font-semibold text-[#5A5870] hover:text-[#0D0C1D]" href="/login">Sign in</Link><Link className="inline-flex min-h-10 items-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#0D0C1D] px-4 text-sm font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.4)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_rgba(0,0,0,0.4)]" style={{ color: '#fff' }} href="/signup">Get started</Link></nav></div></header>;
}
