/**
 * Token redaction utility — safely masks tokens for display/logging.
 * NEVER log the full token. Always use this function before displaying token text.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

/**
 * Redact a token for safe display.
 * e.g. "sk-ant-api03-abc...xyz1234" → "sk-ant-...234"
 */
export function redactToken(token: string): string {
  if (!token || token.length < 8) return '***';
  const prefix = token.slice(0, Math.min(8, token.indexOf('-', 4) + 1) || 4);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Redact all token-like strings from an error message or text.
 * Tokens are typically 32+ character alphanumeric strings.
 */
export function redactFromText(text: string): string {
  // Match common token patterns: long alphanumeric strings with optional dashes
  return text.replace(/\b(sk-[a-zA-Z0-9_-]{20,}|[a-zA-Z0-9]{32,})\b/g, '[REDACTED]');
}
