import { z } from 'zod';

export const createSubscriptionRequestSchema = z.object({
  requestId: z.string().uuid(),
  plan: z.enum(['PRO', 'PREMIUM']),
}).strict();

export const verifySubscriptionRequestSchema = z.object({
  requestId: z.string().uuid(),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{14,}$/),
  razorpaySignature: z.string().regex(/^[0-9a-f]{64}$/i),
}).strict();

export const cancelSubscriptionRequestSchema = z.object({
  requestId: z.string().uuid(),
}).strict();
