'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem('collab-deal-os-theme', theme);
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Appearance</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Choose how your Collab Deal OS workspace looks on this device.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="Theme">
        <button
          className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${theme === 'light' ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
          type="button"
          onClick={() => choose('light')}
          aria-pressed={theme === 'light'}
        >
          <Sun className="size-4" />Light
        </button>
        <button
          className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${theme === 'dark' ? 'border-violet-500 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
          type="button"
          onClick={() => choose('dark')}
          aria-pressed={theme === 'dark'}
          style={theme === 'dark' ? { color: '#fff' } : undefined}
        >
          <Moon className="size-4" />Dark
        </button>
      </div>
    </section>
  );
}
