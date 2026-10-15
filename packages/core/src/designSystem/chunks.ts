/**
 * CSS Chunk builder — splits design-system CSS into independently cacheable chunks.
 *
 * Chunk kinds:
 *   base       — static reset (constant hash)
 *   tokens     — :root variables from compileTokens(); hash = hash(ds)
 *   utilities  — utility classes; tree-shaken from HTML class usage
 *   component  — one chunk per registered component
 *   screen     — leftover CSS after autofix (should be near-empty)
 *
 * Rules:
 *   - No chunk body (outside tokens) may contain raw hex/px literals.
 *   - Hashes are content-addressed (hash of the CSS string).
 *   - Canvas renderer uses data-chunk / data-hash to skip re-inject.
 */

import type { DesignSystem, CssChunk } from './schema';
import { compileTokens, hashString } from './compileTokens';
import { compileUtilities, scanClasses } from './compileUtilities';

// ── Base reset (static, constant hash) ───────────────────────────────────────

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
button { all: unset; box-sizing: border-box; cursor: pointer; }
input, textarea { all: unset; box-sizing: border-box; }
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
`.trim();

export const BASE_CHUNK_HASH = hashString(BASE_CSS);

export function buildBaseChunk(): CssChunk {
  return { id: 'base', kind: 'base', hash: BASE_CHUNK_HASH, css: BASE_CSS };
}

// ── Tokens chunk ──────────────────────────────────────────────────────────────

export function buildTokensChunk(ds: DesignSystem): CssChunk {
  const css = compileTokens(ds);
  const hash = hashString(css);
  return { id: 'tokens', kind: 'tokens', hash, css };
}

// ── Utilities chunk ───────────────────────────────────────────────────────────

export function buildUtilitiesChunk(ds: DesignSystem, html?: string): CssChunk {
  const usedClasses = html ? scanClasses(html) : undefined;
  const css = compileUtilities(ds, usedClasses);
  const hash = hashString(css);
  return { id: 'utilities', kind: 'utilities', hash, css };
}

// ── Component chunks ──────────────────────────────────────────────────────────

export function buildComponentChunk(componentId: string, css: string): CssChunk {
  const hash = hashString(css);
  return { id: `component:${componentId}`, kind: 'component', hash, css };
}

// ── Screen chunk ──────────────────────────────────────────────────────────────

export function buildScreenChunk(screenId: string, css: string): CssChunk {
  const hash = hashString(css);
  return { id: `screen:${screenId}`, kind: 'screen', hash, css };
}

// ── Full build ────────────────────────────────────────────────────────────────

export interface BuildChunksInput {
  ds: DesignSystem;
  html?: string;
  componentCss?: Record<string, string>;   // componentId → CSS
  screenId?: string;
  screenCss?: string;
}

export function buildChunks(input: BuildChunksInput): CssChunk[] {
  const chunks: CssChunk[] = [
    buildBaseChunk(),
    buildTokensChunk(input.ds),
    buildUtilitiesChunk(input.ds, input.html),
  ];

  if (input.componentCss) {
    for (const [id, css] of Object.entries(input.componentCss)) {
      if (css.trim()) chunks.push(buildComponentChunk(id, css));
    }
  }

  if (input.screenId && input.screenCss?.trim()) {
    chunks.push(buildScreenChunk(input.screenId, input.screenCss));
  }

  return chunks;
}

/**
 * Render all chunks to a single <style> block (for testing / SSR).
 * In the canvas, chunks are injected individually with data-chunk / data-hash.
 */
export function chunksToStyleTag(chunks: CssChunk[]): string {
  return chunks
    .map((c) => `<style data-chunk="${c.id}" data-hash="${c.hash}">\n${c.css}\n</style>`)
    .join('\n');
}

/**
 * Check if a CSS string contains raw hex colors or raw px values
 * outside a :root block (used in tests to assert chunk correctness).
 */
export function hasRawLiterals(css: string): boolean {
  // Remove :root block before checking
  const withoutRoot = css.replace(/:root\s*\{[^}]*\}/g, '');
  // Raw hex
  if (/#[0-9a-fA-F]{3,8}\b/.test(withoutRoot)) return true;
  // Raw px values not coming from var() — simple heuristic
  if (/:\s*\d+px\b/.test(withoutRoot)) return true;
  return false;
}
