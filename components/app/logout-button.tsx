'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  }

  if (compact) return (
    <button className="flex size-10 items-center justify-center rounded-[8px] text-[#5A5870] transition hover:bg-[#E0DACE] hover:text-[#0D0C1D]" type="button" onClick={signOut} aria-label="Sign out">
      <LogOut className="size-[18px]" aria-hidden="true" />
    </button>
  );

  return (
    <button className="flex min-h-11 w-full items-center gap-3 rounded-[8px] px-3 text-sm font-medium text-[#5A5870] transition hover:bg-[#E0DACE] hover:text-[#0D0C1D]" type="button" onClick={signOut}>
      <LogOut className="size-[18px]" aria-hidden="true" />
      <span>Sign out</span>
    </button>
  );
}
