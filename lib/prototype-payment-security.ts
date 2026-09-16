'use client';

import type { AccountType } from '@/types/domain';

const keyFor = (role: AccountType) => `collab-deal-os:prototype-payment-password:${role}`;

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hasPrototypePaymentPassword(role: AccountType) {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(keyFor(role)));
}

export async function savePrototypePaymentPassword(role: AccountType, password: string) {
  if (typeof window === 'undefined') return;
  const hash = await sha256(`${role}:${password}`);
  window.localStorage.setItem(keyFor(role), hash);
}

export async function verifyPrototypePaymentPassword(role: AccountType, password: string) {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(keyFor(role));
  if (!stored) return false;
  const hash = await sha256(`${role}:${password}`);
  return hash === stored;
}
