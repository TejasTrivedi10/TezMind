/**
 * Token compiler — deterministic, no LLM.
 *
 * Input:  DesignSystem
 * Output: `:root { --c-*, --font-*, --fs-*, --fw-*, --lh-*, --sp-*, --r-*, --shadow-*, --dur-*, --ease }`
 *
 * Rules:
 * - Every value is a reference (var(--x)) or a top-level variable definition.
 * - No raw hex/px in the output outside the :root block.
 * - Snapshot-stable: same DesignSystem always produces identical CSS.
 */

import type { DesignSystem } from './schema';
import { SPACING_SCALE } from './schema';

/** Hash a string to a short hex string for cache-busting */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function compileTokens(ds: DesignSystem): string {
  const lines: string[] = [':root {'];

  // ── Colors ────────────────────────────────────────────────────────────────
  lines.push('  /* Colors */');
  for (const [key, value] of Object.entries(ds.colors)) {
    lines.push(`  --c-${kebab(key)}: ${value};`);
  }

  // ── Typography: font families ─────────────────────────────────────────────
  lines.push('  /* Typography */');
  const systemStack = ', system-ui, -apple-system, sans-serif';
  const monoStack = ', ui-monospace, monospace';
  lines.push(`  --font-heading: ${ds.typography.fontFamily.heading}${systemStack};`);
  lines.push(`  --font-body: ${ds.typography.fontFamily.body}${systemStack};`);
  if (ds.typography.fontFamily.mono) {
    lines.push(`  --font-mono: ${ds.typography.fontFamily.mono}${monoStack};`);
  } else {
    lines.push(`  --font-mono: ui-monospace, 'SF Mono', Consolas, monospace;`);
  }

  // ── Typography: size scale ────────────────────────────────────────────────
  lines.push('  /* Type scale */');
  const scaleEntries = Object.entries(ds.typography.scale) as [string, number][];
  for (const [key, px] of scaleEntries) {
    lines.push(`  --fs-${key}: ${px}px;`);
  }

  // ── Typography: weights ───────────────────────────────────────────────────
  lines.push('  /* Weights */');
  for (const [key, weight] of Object.entries(ds.typography.weights)) {
    lines.push(`  --fw-${key}: ${weight};`);
  }

  // ── Typography: line heights ──────────────────────────────────────────────
  lines.push('  /* Line heights */');
  for (const [key, lh] of Object.entries(ds.typography.lineHeights)) {
    lines.push(`  --lh-${key}: ${lh};`);
  }

  // ── Spacing scale ─────────────────────────────────────────────────────────
  lines.push('  /* Spacing scale */');
  for (const px of SPACING_SCALE) {
    lines.push(`  --sp-${px}: ${px}px;`);
  }

  // ── Radius ────────────────────────────────────────────────────────────────
  lines.push('  /* Radius */');
  for (const [key, px] of Object.entries(ds.radius)) {
    const value = px >= 9999 ? '9999px' : `${px}px`;
    lines.push(`  --r-${kebab(key)}: ${value};`);
  }

  // ── Borders ────────────────────────────────────────────────────────────────
  lines.push('  /* Borders */');
  lines.push(`  --bw: ${ds.borders.width}px;`);
  lines.push(`  --bs: ${ds.borders.style};`);

  // ── Elevation (box shadows) ───────────────────────────────────────────────
  lines.push('  /* Elevation */');
  for (const [key, shadow] of Object.entries(ds.elevation)) {
    lines.push(`  --shadow-${key}: ${shadow || 'none'};`);
  }

  // ── Motion ────────────────────────────────────────────────────────────────
  lines.push('  /* Motion */');
  lines.push(`  --dur-fast: ${ds.motion.durationFast};`);
  lines.push(`  --dur-base: ${ds.motion.durationBase};`);
  lines.push(`  --dur-slow: ${ds.motion.durationSlow};`);
  lines.push(`  --ease: ${ds.motion.easing};`);

  // ── Icon size ─────────────────────────────────────────────────────────────
  lines.push('  /* Icon sizes */');
  lines.push(`  --icon-sm: ${ds.icons.size.sm}px;`);
  lines.push(`  --icon-md: ${ds.icons.size.md}px;`);
  lines.push(`  --icon-lg: ${ds.icons.size.lg}px;`);

  lines.push('}');

  return lines.join('\n');
}

/** camelCase → kebab-case */
function kebab(s: string): string {
  return s.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}
