/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, DEMO_USER, getCurrentSession, saveSession } from '../lib/auth.ts';

describe('Local Authentication & Web Crypto Hashing', () => {
  it('produces different hashes for the same password with different salts', async () => {
    const password = 'ClinicalSecurePass123!';
    const res1 = await hashPassword(password);
    const res2 = await hashPassword(password);

    // Different random salts
    expect(res1.saltHex).not.toBe(res2.saltHex);
    // Different resulting hash digests
    expect(res1.hashHex).not.toBe(res2.hashHex);
  });

  it('produces identical hash when provided the same salt', async () => {
    const password = 'ClinicalSecurePass123!';
    const salt = '0123456789abcdef0123456789abcdef';

    const res1 = await hashPassword(password, salt);
    const res2 = await hashPassword(password, salt);

    expect(res1.hashHex).toBe(res2.hashHex);
    expect(res1.saltHex).toBe(salt);
  });

  it('rejects an incorrect password when tested against stored hash', async () => {
    const correctPass = 'CorrectMedicalPassword!';
    const wrongPass = 'IncorrectMedicalPassword!';
    const { hashHex, saltHex } = await hashPassword(correctPass);

    const checkHash = await hashPassword(wrongPass, saltHex);
    expect(checkHash.hashHex).not.toBe(hashHex);
  });

  it('handles expired sessions properly', () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
      getItem: (k: string) => store.get(k) || null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };

    const expiredSession = {
      ...DEMO_USER,
      expiresAt: Date.now() - 1000, // Expired 1 second ago
    };

    saveSession(expiredSession);
    const retrieved = getCurrentSession();
    expect(retrieved).toBeNull();
  });
});
