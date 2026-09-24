import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export function PublicFooter() {
  return (
    <footer className="border-t-2 border-[#0D0C1D] bg-[#F5F2EA]">
      <div className="mx-auto flex w-[min(1180px,calc(100%-32px))] flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo />
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#5A5870]" aria-label="Footer navigation">
          <Link className="hover:text-[#0D0C1D] transition-colors" href="/for-creators">For creators</Link>
          <Link className="hover:text-[#0D0C1D] transition-colors" href="/for-brands">For brands</Link>
          <Link className="hover:text-[#0D0C1D] transition-colors" href="/how-it-works">How it works</Link>
          <Link className="hover:text-[#0D0C1D] transition-colors" href="/pricing">Pricing</Link>
          <Link className="hover:text-[#0D0C1D] transition-colors" href="/privacy">Privacy</Link>
          <Link className="hover:text-[#0D0C1D] transition-colors" href="/terms">Terms</Link>
        </nav>
        <p className="text-xs text-[#5A5870]">© 2026 Collab Deal OS</p>
      </div>
    </footer>
  );
}
