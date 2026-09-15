'use client';
import { useEffect } from 'react';

export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      void navigator.serviceWorker.register('/sw.js').catch(() => { /* Browser installation is optional. */ });
    }
  }, []);
  return null;
}
