'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try {
    window.localStorage.setItem('collab-deal-os-theme', theme);
  } catch {
    // ignore
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem('collab-deal-os-theme');
    const initial: Theme = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <div>
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Appearance</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Choose how your Collab Deal OS workspace looks on this device.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Theme">
        <button
          className={cn(
            'flex min-h-14 items-center justify-center gap-2 rounded-[8px] border-2 px-4 text-sm font-bold transition-all',
            theme === 'light'
              ? 'border-[#0D0C1D] bg-[#0D0C1D] text-white shadow-[2px_2px_0_rgba(0,0,0,0.2)]'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#262A3D] dark:bg-[#1F2235] dark:text-slate-300 dark:hover:bg-[#252940]',
          )}
          type="button"
          onClick={() => choose('light')}
          aria-pressed={theme === 'light'}
        >
          <Sun className="size-4" />Light
        </button>
        <button
          className={cn(
            'flex min-h-14 items-center justify-center gap-2 rounded-[8px] border-2 px-4 text-sm font-bold transition-all',
            theme === 'dark'
              ? 'border-[#6366F1] bg-[#6366F1] text-white shadow-[2px_2px_0_#000000]'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-[#262A3D] dark:bg-[#1F2235] dark:text-slate-300 dark:hover:bg-[#252940]',
          )}
          type="button"
          onClick={() => choose('dark')}
          aria-pressed={theme === 'dark'}
        >
          <Moon className="size-4" />Dark
        </button>
      </div>
    </section>
  );
}
