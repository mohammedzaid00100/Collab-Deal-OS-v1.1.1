'use client';

import type { AccountType } from '@/types/domain';

export type PrototypeTransactionStatus = 'Completed' | 'Pending' | 'Rejected';
export type PrototypeTransactionType = 'TOP_UP' | 'WITHDRAWAL' | 'CREATOR_PAYMENT' | 'CREDIT';

export type PrototypeTransaction = {
  id: string;
  type: PrototypeTransactionType;
  label: string;
  detail: string;
  amount: number;
  direction: 'in' | 'out';
  status: PrototypeTransactionStatus;
  createdAt: string;
  upiId?: string;
  serverRequestId?: string;
};

export type PrototypeWalletState = {
  balance: number;
  transactions: PrototypeTransaction[];
};

export type SharedPrototypeWithdrawal = {
  id: string;
  amount_inr: number;
  upi_id: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  created_at: string;
  completed_at?: string | null;
  rejected_at?: string | null;
};

const keyFor = (role: AccountType) => `collab-deal-os:prototype-wallet:${role}`;

function defaultState(role: AccountType): PrototypeWalletState {
  if (role === 'brand') {
    return {
      balance: 10000,
      transactions: [{
        id: 'brand-demo-seed',
        type: 'TOP_UP',
        label: 'Demo wallet funded',
        detail: 'Prototype opening balance for investor review',
        amount: 10000,
        direction: 'in',
        status: 'Completed',
        createdAt: new Date().toISOString(),
      }],
    };
  }

  return {
    balance: 700,
    transactions: [{
      id: 'creator-demo-seed',
      type: 'CREDIT',
      label: 'Demo creator earning',
      detail: 'Prototype opening balance for investor review',
      amount: 700,
      direction: 'in',
      status: 'Completed',
      createdAt: new Date().toISOString(),
    }],
  };
}

export function loadPrototypeWallet(role: AccountType): PrototypeWalletState {
  if (typeof window === 'undefined') return defaultState(role);
  const raw = window.localStorage.getItem(keyFor(role));
  if (!raw) {
    const initial = defaultState(role);
    window.localStorage.setItem(keyFor(role), JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw) as PrototypeWalletState;
    if (typeof parsed.balance !== 'number' || !Array.isArray(parsed.transactions)) throw new Error('invalid wallet');
    return parsed;
  } catch {
    const initial = defaultState(role);
    window.localStorage.setItem(keyFor(role), JSON.stringify(initial));
    return initial;
  }
}

export function savePrototypeWallet(role: AccountType, state: PrototypeWalletState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(keyFor(role), JSON.stringify(state));
}

export function appendPrototypeTransaction(role: AccountType, transaction: PrototypeTransaction, balanceDelta = 0) {
  const current = loadPrototypeWallet(role);
  const next: PrototypeWalletState = {
    balance: Math.max(0, current.balance + balanceDelta),
    transactions: [transaction, ...current.transactions],
  };
  savePrototypeWallet(role, next);
  return next;
}

export function completePrototypeWithdrawal(role: AccountType, transactionId: string) {
  const current = loadPrototypeWallet(role);
  const target = current.transactions.find((item) => item.id === transactionId && item.type === 'WITHDRAWAL' && item.status === 'Pending');
  if (!target || target.amount > current.balance) return current;
  const next: PrototypeWalletState = {
    balance: current.balance - target.amount,
    transactions: current.transactions.map((item) => item.id === transactionId ? { ...item, status: 'Completed' as const } : item),
  };
  savePrototypeWallet(role, next);
  return next;
}

export function reconcilePrototypeWithdrawals(role: AccountType, withdrawals: SharedPrototypeWithdrawal[]) {
  const current = loadPrototypeWallet(role);
  let balance = current.balance;
  const transactions = [...current.transactions];

  for (const request of withdrawals) {
    const mappedStatus: PrototypeTransactionStatus = request.status === 'COMPLETED'
      ? 'Completed'
      : request.status === 'REJECTED'
        ? 'Rejected'
        : 'Pending';
    const existingIndex = transactions.findIndex((item) => item.serverRequestId === request.id);
    const label = mappedStatus === 'Completed'
      ? 'Withdrawal completed'
      : mappedStatus === 'Rejected'
        ? 'Withdrawal rejected'
        : 'Withdrawal requested';
    const detail = mappedStatus === 'Pending'
      ? `UPI: ${request.upi_id} · operator review pending`
      : mappedStatus === 'Completed'
        ? `UPI: ${request.upi_id} · payout marked successful by Collab Deal OS`
        : `UPI: ${request.upi_id} · request rejected by Collab Deal OS`;

    if (existingIndex === -1) {
      if (mappedStatus === 'Completed') balance = Math.max(0, balance - request.amount_inr);
      transactions.unshift({
        id: `withdrawal-${request.id}`,
        serverRequestId: request.id,
        type: 'WITHDRAWAL',
        label,
        detail,
        amount: request.amount_inr,
        direction: 'out',
        status: mappedStatus,
        createdAt: request.created_at,
        upiId: request.upi_id,
      });
      continue;
    }

    const existing = transactions[existingIndex];
    if (existing.status !== 'Completed' && mappedStatus === 'Completed') {
      balance = Math.max(0, balance - request.amount_inr);
    }
    transactions[existingIndex] = {
      ...existing,
      label,
      detail,
      status: mappedStatus,
      amount: request.amount_inr,
      upiId: request.upi_id,
      serverRequestId: request.id,
    };
  }

  const next = { balance, transactions } satisfies PrototypeWalletState;
  savePrototypeWallet(role, next);
  return next;
}

export function makePrototypeTransaction(input: Omit<PrototypeTransaction, 'id' | 'createdAt'>): PrototypeTransaction {
  return {
    ...input,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
}
