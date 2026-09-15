'use client';

import { useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AccountType } from '@/types/domain';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

interface GoogleButtonProps {
  accountType: AccountType;
  onError: (message: string) => void;
}

export function GoogleButton({ accountType, onError }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      onError('Authentication is not configured yet. Connect Supabase to continue.');
      return;
    }

    setLoading(true);
    const native = Capacitor.isNativePlatform();
    const redirectTo = `${window.location.origin}/auth/${native ? 'mobile-callback' : 'callback'}?role=${accountType}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: native },
    });

    if (error) {
      setLoading(false);
      onError(error.message);
    } else if (native && data.url) {
      try { await Browser.open({ url: data.url }); }
      catch { onError('Google sign-in could not open. Please try again.'); }
      finally { setLoading(false); }
    }
  }

  return (
    <Button
      className="w-full"
      variant="secondary"
      type="button"
      loading={loading}
      onClick={handleGoogleLogin}
    >
      <CircleUserRound className="size-4" aria-hidden="true" />
      Continue with Google
    </Button>
  );
}
