'use client';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

export function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleUrl = async (value: string) => {
      const url = new URL(value);
      if (url.protocol !== 'collabdeal:' || url.hostname !== 'auth' || url.pathname !== '/callback') return;
      const code = url.searchParams.get('code');
      const role = url.searchParams.get('role');
      if (!code || code.length > 2048) return;
      try { await Browser.close(); } catch { /* Browser may already be closed. */ }
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('code', code);
      if (role === 'creator' || role === 'brand') callback.searchParams.set('role', role);
      window.location.assign(callback.href);
    };
    const listener = App.addListener('appUrlOpen', ({ url }) => { void handleUrl(url); });
    const back = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back(); else void App.minimizeApp();
    });
    void App.getLaunchUrl().then((result) => { if (result) void handleUrl(result.url); });
    return () => { void listener.then((handle) => handle.remove()); void back.then((handle) => handle.remove()); };
  }, []);
  return null;
}
