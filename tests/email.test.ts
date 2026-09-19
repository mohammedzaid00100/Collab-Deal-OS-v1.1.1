import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildNotificationEmail } from '@/lib/delivery/email';
import { isTrustedMutationRequest } from '@/lib/security/request';

afterEach(() => vi.unstubAllEnvs());

describe('request trust boundaries', () => {
  it('rejects cross-origin mutations', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://deals.example');
    expect(isTrustedMutationRequest(new Request('https://deals.example/api', { headers: { origin: 'https://attacker.example' } }))).toBe(false);
    expect(isTrustedMutationRequest(new Request('https://deals.example/api', { headers: { origin: 'https://deals.example' } }))).toBe(true);
  });
});

describe('transactional email safety', () => {
  it('escapes notification text and refuses external action links', () => {
    const email = buildNotificationEmail({ subject: '<script>alert(1)</script>', body: '<img onerror=evil()>', action_path: '//attacker.example' }, 'https://deals.example');
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<img');
    expect(email.text).toContain('https://deals.example/login');
    expect(email.html).not.toContain('attacker.example');
  });
});

