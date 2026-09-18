'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeQuickToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem('collab-deal-os-theme', next);
    } catch {
      // ignore
    }
    setTheme(next);
  }

  if (!mounted) {
    return (
      <button
        className={cn(
          'flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all',
          className,
        )}
        type="button"
        aria-label="Toggle theme"
      >
        <Moon className="size-[18px]" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      className={cn(
        'flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#2D334D] dark:bg-[#171927] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]',
        className,
      )}
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="size-[18px] text-amber-400" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
