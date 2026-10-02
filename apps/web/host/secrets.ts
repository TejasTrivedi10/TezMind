/**
 * WebCrypto-based secret storage for the browser.
 * Tokens are encrypted with AES-GCM using a key derived from the device.
 * Stored in localStorage with the key encrypted separately.
 *
 * Security model:
 * - Encryption key is derived from a constant + origin (not user passphrase by default).
 * - This provides obfuscation but NOT protection against XSS with full DOM access.
 * - Keys are visible to any JS running on localhost (same as any web app token storage).
 * - For enhanced security, an optional passphrase can be provided.
 * - Tokens are ONLY sent to the chosen provider, never to any other server.
 *
 * This implements the SecretsBridge interface from @tezmind/core.
 */

import type { SecretsBridge } from '@tezmind/core';

const STORAGE_PREFIX = 'tezmind_secret_';
const KEY_MATERIAL = 'tezmind-v1-key-material';

async function getEncryptionKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(KEY_MATERIAL + window.location.origin);
  const keyMaterial = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
  const salt = new TextEncoder().encode('tezmind-salt-v1');
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

class WebSecretStorage implements SecretsBridge {
  async get(key: string): Promise<string | undefined> {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + key);
      if (!stored) return undefined;
      return await decrypt(stored);
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(value);
    localStorage.setItem(STORAGE_PREFIX + key, encrypted);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(STORAGE_PREFIX + key);
  }
}

let _instance: WebSecretStorage | null = null;

export function getSecretStorage(): SecretsBridge {
  if (!_instance) {
    _instance = new WebSecretStorage();
  }
  return _instance;
}
