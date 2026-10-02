/**
 * Nano ID generator — pure TypeScript, no host imports.
 * Uses a simple alphanumeric alphabet (URL-safe, compact).
 *
 * In environments with crypto (browser, Node 18+), uses crypto.getRandomValues.
 * Falls back to Math.random (test environments).
 */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DEFAULT_SIZE = 12;

function getRandomByte(): number {
  if (
    typeof globalThis !== 'undefined' &&
    'crypto' in globalThis &&
    typeof (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto
      ?.getRandomValues === 'function'
  ) {
    const buf = new Uint8Array(1);
    (globalThis as { crypto: { getRandomValues: (b: Uint8Array) => Uint8Array } }).crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 256);
}

export function nanoid(size = DEFAULT_SIZE): string {
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[getRandomByte() % ALPHABET.length];
  }
  return id;
}
