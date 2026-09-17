'use client';

import type { AccountType } from '@/types/domain';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type PaymentPasswordVerification = {
  valid: boolean;
  reason: 'OK' | 'INCORRECT' | 'LOCKED' | 'NOT_CONFIGURED' | 'AUTH_REQUIRED' | 'UNAVAILABLE';
  remainingAttempts?: number;
  lockedUntil?: string | null;
};

export async function hasPrototypePaymentPassword(_role: AccountType) {
  const client = createSupabaseBrowserClient();
  if (!client) return false;
  const { data, error } = await client.rpc('has_payment_password');
  if (error) return false;
  return data === true;
}

export async function savePrototypePaymentPassword(_role: AccountType, password: string) {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error('Payment security is unavailable.');
  const { data, error } = await client.rpc('create_payment_password', { new_password: password });
  if (error || data !== true) throw new Error(error?.message ?? 'Could not save payment password.');
}

export async function checkPrototypePaymentPassword(_role: AccountType, password: string): Promise<PaymentPasswordVerification> {
  const client = createSupabaseBrowserClient();
  if (!client) return { valid: false, reason: 'UNAVAILABLE' };

  const { data, error } = await client.rpc('verify_payment_password', { candidate: password });
  if (error || !data || typeof data !== 'object') return { valid: false, reason: 'UNAVAILABLE' };

  const result = data as {
    valid?: boolean;
    reason?: string;
    remaining_attempts?: number;
    locked_until?: string | null;
  };

  const reason = ['OK', 'INCORRECT', 'LOCKED', 'NOT_CONFIGURED', 'AUTH_REQUIRED'].includes(result.reason ?? '')
    ? result.reason as PaymentPasswordVerification['reason']
    : 'UNAVAILABLE';

  return {
    valid: result.valid === true,
    reason,
    remainingAttempts: typeof result.remaining_attempts === 'number' ? result.remaining_attempts : undefined,
    lockedUntil: result.locked_until ?? null,
  };
}

export async function verifyPrototypePaymentPassword(role: AccountType, password: string) {
  const result = await checkPrototypePaymentPassword(role, password);
  return result.valid;
}
