import type { ParsedHints } from '@tezmind/core';

const COLOR_NAMES = [
  'purple', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal',
  'emerald', 'green', 'lime', 'yellow', 'amber', 'orange', 'red',
  'rose', 'pink', 'fuchsia', 'slate', 'gray', 'zinc', 'neutral',
  'stone', 'black', 'white', 'monochrome', 'neon', 'pastel',
];

const VIBE_KEYWORDS = [
  'minimal', 'clean', 'playful', 'friendly', 'corporate', 'professional',
  'luxury', 'premium', 'editorial', 'magazine', 'brutalist', 'retro',
  'vintage', 'futuristic', 'cyberpunk', 'glassmorphic', 'glass', 'neumorphic',
  'cozy', 'warm', 'compact', 'dense', 'spacious', 'modern',
];

const RADIUS_KEYWORDS: Record<string, string> = {
  sharp: 'sharp',
  square: 'sharp',
  flat: 'sharp',
  none: 'sharp',
  rounded: 'rounded',
  soft: 'rounded',
  pill: 'pill',
  full: 'pill',
  curved: 'rounded',
};

/**
 * Deterministically parse user styling hints into structured ParsedHints.
 * Pure TypeScript — no LLM required.
 */
export function parseHints(input?: string): ParsedHints | undefined {
  if (!input || !input.trim()) return undefined;
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const hints: ParsedHints = { raw };

  // 1. Mode hint
  if (/\b(dark|night|dim)\b/.test(lower)) {
    hints.mode = 'dark';
  } else if (/\b(light|day|bright)\b/.test(lower)) {
    hints.mode = 'light';
  }

  // 2. Colors: find hex codes (#rrggbb) and color keywords
  const colors: string[] = [];
  const hexMatches = raw.match(/#[0-9a-fA-F]{6}\b/g);
  if (hexMatches) {
    colors.push(...hexMatches);
  }
  for (const c of COLOR_NAMES) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(lower)) {
      colors.push(c);
    }
  }
  if (colors.length > 0) {
    hints.colors = Array.from(new Set(colors));
  }

  // 3. Vibe hints
  const matchedVibes = VIBE_KEYWORDS.filter((v) => new RegExp(`\\b${v}\\b`, 'i').test(lower));
  if (matchedVibes.length > 0) {
    hints.vibe = matchedVibes.join(', ');
  }

  // 4. Radius hints
  for (const [key, val] of Object.entries(RADIUS_KEYWORDS)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(lower)) {
      hints.radius = val;
      break;
    }
  }

  return hints;
}
