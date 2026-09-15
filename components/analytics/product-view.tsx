'use client';
import { useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function ProductView({ event }: { event: 'opportunity viewed' | 'creator viewed' | 'upgrade page viewed' }) {
  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (client) void client.rpc('record_product_view', { view_event: event });
  }, [event]);
  return null;
}
