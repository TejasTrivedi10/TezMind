/**
 * DesignSystem validator — pure TypeScript, no DOM, no LLM.
 *
 * Checks:
 * - Zod schema
 * - WCAG AA contrast (≥4.5:1) for text/background, text/surface, onPrimary/primary, onSecondary/secondary
 * - Every font in FONT_ALLOWLIST
 * - All spacing values on 4px grid (enforced by the fixed scale)
 * - mode is a single value
 * - Radius values are non-negative
 */

import { DesignSystemSchema, FONT_ALLOWLIST } from './schema';
import type { DesignSystem } from './schema';

// ── Contrast helpers ──────────────────────────────────────────────────────────

/** Parse #RRGGBB → [r, g, b] in 0–255 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** sRGB linearise */
function linearise(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG 2.1) */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/** Contrast ratio (WCAG 2.1) — always ≥ 1 */
export function contrastRatio(hex1: string, hex2: string): number {
  const [l1, l2] = [luminance(hex1), luminance(hex2)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const WCAG_AA_NORMAL = 4.5;

// ── Font check ────────────────────────────────────────────────────────────────

function isFontAllowed(font: string): boolean {
  // Strip fallback stack — only check the primary family name
  const primary = font.split(',')[0].trim().replace(/['"]/g, '').trim();
  return (FONT_ALLOWLIST as readonly string[]).includes(primary);
}

// ── Validate ──────────────────────────────────────────────────────────────────

export type ValidationSuccess = { ok: true; ds: DesignSystem };
export type ValidationFailure = { ok: false; errors: string[] };
export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateDesignSystem(raw: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Zod parse
  const parsed = DesignSystemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  const ds = parsed.data;
  const { colors } = ds;

  // 2. WCAG AA contrast pairs
  const contrastPairs: [string, string, string][] = [
    ['text/background', colors.text, colors.background],
    ['text/surface', colors.text, colors.surface],
    ['onPrimary/primary', colors.onPrimary, colors.primary],
    ['onSecondary/secondary', colors.onSecondary, colors.secondary],
    ['textInverse/primary', colors.textInverse, colors.primary],
  ];

  for (const [label, fg, bg] of contrastPairs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < WCAG_AA_NORMAL) {
      errors.push(
        `Contrast pair "${label}" (${fg} on ${bg}) is ${ratio.toFixed(2)}:1 — must be ≥${WCAG_AA_NORMAL}:1 (WCAG AA).`,
      );
    }
  }

  // textMuted/background must be ≥ 3:1 (large text / UI component threshold)
  const mutedRatio = contrastRatio(colors.textMuted, colors.background);
  if (mutedRatio < 3.0) {
    errors.push(
      `Contrast pair "textMuted/background" (${colors.textMuted} on ${colors.background}) is ${mutedRatio.toFixed(2)}:1 — must be ≥3.0:1.`,
    );
  }

  // 2b. Mode consistency
  const bgLum = luminance(colors.background);
  const textLum = luminance(colors.text);
  if (ds.mode === 'light' && bgLum <= textLum) {
    errors.push(
      `Mode is "light" but background (${colors.background}, lum: ${bgLum.toFixed(3)}) is not lighter than text (${colors.text}, lum: ${textLum.toFixed(3)}).`,
    );
  } else if (ds.mode === 'dark' && bgLum >= textLum) {
    errors.push(
      `Mode is "dark" but background (${colors.background}, lum: ${bgLum.toFixed(3)}) is not darker than text (${colors.text}, lum: ${textLum.toFixed(3)}).`,
    );
  }

  // 3. Font allowlist
  const fontsToCheck: [string, string][] = [
    ['typography.fontFamily.heading', ds.typography.fontFamily.heading],
    ['typography.fontFamily.body', ds.typography.fontFamily.body],
  ];
  if (ds.typography.fontFamily.mono) {
    fontsToCheck.push(['typography.fontFamily.mono', ds.typography.fontFamily.mono]);
  }
  for (const [path, font] of fontsToCheck) {
    if (!isFontAllowed(font)) {
      errors.push(
        `${path}: "${font}" is not in FONT_ALLOWLIST. Use a Google Fonts family from the allowed list.`,
      );
    }
  }

  // 4. Type scale is strictly ascending
  const { scale } = ds.typography;
  const scaleValues = [scale.xs, scale.sm, scale.base, scale.lg, scale.xl, scale['2xl'], scale['3xl'], scale['4xl']];
  for (let i = 1; i < scaleValues.length; i++) {
    if (scaleValues[i] <= scaleValues[i - 1]) {
      errors.push(
        `typography.scale: values must be strictly ascending. "${scaleValues[i - 1]}" ≥ "${scaleValues[i]}".`,
      );
    }
  }

  // 5. Radius values non-negative (guaranteed by schema minimums, belt-and-suspenders)
  Object.entries(ds.radius).forEach(([k, v]) => {
    if (typeof v === 'number' && v < 0) {
      errors.push(`radius.${k}: must be ≥ 0, got ${v}.`);
    }
  });

  // 6. Motion duration strings are parseable ms values
  const dur = ds.motion;
  const fast = parseInt(dur.durationFast);
  const base = parseInt(dur.durationBase);
  const slow = parseInt(dur.durationSlow);
  if (fast >= base) errors.push(`motion: durationFast (${dur.durationFast}) must be < durationBase (${dur.durationBase}).`);
  if (base >= slow) errors.push(`motion: durationBase (${dur.durationBase}) must be < durationSlow (${dur.durationSlow}).`);

  // 7. Rules: each must be non-empty (schema handles max count)
  ds.rules.forEach((rule, i) => {
    if (!rule.trim()) errors.push(`rules[${i}]: rule string must not be blank.`);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, ds };
}
