/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local Authentication and Session Management
 * Demonstrates role-based client-side authentication using Web Crypto PBKDF2 hashing,
 * IndexedDB user persistence, sessionStorage tokens with 8-hour expiry, and rate limiting.
 */

export type UserRole = 'Clinician' | 'Radiology Technician' | 'Student/Researcher';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHashHex: string;
  saltHex: string;
  createdAt: string;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  expiresAt: number; // timestamp in ms
}

const DB_NAME = 'scankavach_auth_db';
const USER_STORE = 'users';
const SESSION_KEY = 'scankavach_session';
const RATE_LIMIT_KEY = 'scankavach_ratelimit';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

// Demo User Constant
export const DEMO_USER: UserSession = {
  userId: 'demo-user-clinician',
  name: 'Dr. Alex Morgan',
  email: 'alex.morgan@hospital.org',
  role: 'Clinician',
  expiresAt: Date.now() + SESSION_DURATION_MS,
};

function openAuthDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(USER_STORE)) {
        db.createObjectStore(USER_STORE, { keyPath: 'email' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Auth DB error'));
  });
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBuffer(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hashes a password using PBKDF2 with SHA-256, 100,000 iterations.
 */
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hashHex: string; saltHex: string }> {
  try {
    const encoder = new TextEncoder();
    const passBuffer = encoder.encode(password);

    let saltBytes: Uint8Array<ArrayBuffer>;
    if (saltHex) {
      saltBytes = hexToBuffer(saltHex);
    } else {
      const buf = new ArrayBuffer(16);
      saltBytes = new Uint8Array(buf);
      crypto.getRandomValues(saltBytes);
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return {
      hashHex: bufferToHex(derivedBits),
      saltHex: saltHex || bufferToHex(saltBytes.buffer),
    };
  } catch (err) {
    console.error('Web Crypto PBKDF2 hashing failed:', err);
    throw new Error('Device cryptographic hashing failed. Please try again.');
  }
}

/**
 * Constant-time comparison between two hex strings to protect against timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Checks if authentication is currently rate-limited (5 failures -> 30s lockout).
 */
export function getRateLimitStatus(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0 };
    const parsed = JSON.parse(raw);
    const now = Date.now();

    if (parsed.lockedUntil && parsed.lockedUntil > now) {
      const remainingSeconds = Math.ceil((parsed.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds };
    }
    return { isLocked: false, remainingSeconds: 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0 };
  }
}

export function recordFailedLogin(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    let data = raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };

    data.attempts = (data.attempts || 0) + 1;
    if (data.attempts >= 5) {
      data.lockedUntil = now + 30000; // 30 second lockout
      data.attempts = 0;
    }
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
    return getRateLimitStatus();
  } catch {
    return { isLocked: false, remainingSeconds: 0 };
  }
}

export function resetRateLimit(): void {
  try {
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Registers a new user locally.
 */
export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: UserRole
): Promise<UserSession> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const { hashHex, saltHex } = await hashPassword(password);
  const db = await openAuthDb();

  return new Promise<UserSession>((resolve, reject) => {
    const tx = db.transaction(USER_STORE, 'readwrite');
    const store = tx.objectStore(USER_STORE);

    const checkReq = store.get(cleanEmail);
    checkReq.onsuccess = () => {
      if (checkReq.result) {
        reject(new Error('An account with this email already exists on this device.'));
        return;
      }

      const user: UserAccount = {
        id: `user_${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        passwordHashHex: hashHex,
        saltHex,
        createdAt: new Date().toISOString(),
      };

      const addReq = store.add(user);
      addReq.onsuccess = () => {
        const session: UserSession = {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          expiresAt: Date.now() + SESSION_DURATION_MS,
        };
        saveSession(session);
        resetRateLimit();
        resolve(session);
      };
      addReq.onerror = () => reject(addReq.error || new Error('Failed to save account'));
    };
    checkReq.onerror = () => reject(checkReq.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Signs in an existing user with password verification.
 */
export async function loginUser(email: string, password: string): Promise<UserSession> {
  const rateLimit = getRateLimitStatus();
  if (rateLimit.isLocked) {
    throw new Error(`Too many failed attempts. Try again in ${rateLimit.remainingSeconds}s.`);
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = await openAuthDb();

  return new Promise<UserSession>((resolve, reject) => {
    const tx = db.transaction(USER_STORE, 'readonly');
    const store = tx.objectStore(USER_STORE);
    const req = store.get(cleanEmail);

    req.onsuccess = async () => {
      const user: UserAccount | undefined = req.result;
      if (!user) {
        recordFailedLogin();
        reject(new Error('Invalid email or password.'));
        return;
      }

      try {
        const { hashHex } = await hashPassword(password, user.saltHex);
        if (!constantTimeCompare(hashHex, user.passwordHashHex)) {
          recordFailedLogin();
          reject(new Error('Invalid email or password.'));
          return;
        }

        const session: UserSession = {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          expiresAt: Date.now() + SESSION_DURATION_MS,
        };
        saveSession(session);
        resetRateLimit();
        resolve(session);
      } catch (err) {
        reject(err);
      }
    };

    req.onerror = () => reject(req.error || new Error('Auth query failed'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Instant sign-in as demo clinician.
 */
export function loginDemoUser(): UserSession {
  const session: UserSession = {
    ...DEMO_USER,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  saveSession(session);
  resetRateLimit();
  return session;
}

export function saveSession(session: UserSession): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch (err) {
    console.warn('Could not store session in sessionStorage:', err);
  }
}

export function getCurrentSession(): UserSession | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: UserSession = JSON.parse(raw);
    if (!session || !session.expiresAt || Date.now() > session.expiresAt) {
      logoutUser();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Ignore
  }
}
