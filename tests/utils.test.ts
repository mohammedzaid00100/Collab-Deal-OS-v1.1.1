import { describe, expect, it } from 'vitest';
import { isSafeInternalPath } from '@/lib/utils';

describe('safe internal redirects', () => {
  it('accepts local application paths', () => {
    expect(isSafeInternalPath('/creator/dashboard')).toBe(true);
  });

  it('rejects protocol-relative redirects', () => {
    expect(isSafeInternalPath('//attacker.example')).toBe(false);
  });

  it('rejects backslash-based authority confusion', () => {
    expect(isSafeInternalPath('/\\attacker.example')).toBe(false);
  });
});
