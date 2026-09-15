import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export function PublicHeader() {
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-18 w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4"><BrandLogo /><nav className="flex items-center gap-3" aria-label="Public navigation"><Link className="hidden text-sm font-semibold text-slate-600 hover:text-violet-700 sm:block" href="/pricing">Pricing</Link><Link className="text-sm font-semibold text-slate-600 hover:text-violet-700" href="/login">Sign in</Link><Link className="inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" href="/signup">Get started</Link></nav></div></header>;
}
