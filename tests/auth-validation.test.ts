import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from '@/lib/validation/auth';

describe('authentication validation', () => {
  it('accepts a role-first creator signup with a strong password', () => {
    const result = signupSchema.safeParse({
      accountType: 'creator',
      email: 'creator@example.com',
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
      acceptTerms: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unsupported account role', () => {
    const result = signupSchema.safeParse({
      accountType: 'admin',
      email: 'admin@example.com',
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
      acceptTerms: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects weak or mismatched passwords', () => {
    const weak = signupSchema.safeParse({
      accountType: 'brand',
      email: 'brand@example.com',
      password: 'password',
      confirmPassword: 'different',
      acceptTerms: true,
    });

    expect(weak.success).toBe(false);
  });

  it('requires credentials for login', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
  });
});
