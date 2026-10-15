/**
 * Utility class compiler — generates CSS utility classes that reference
 * ONLY the custom properties emitted by compileTokens().
 *
 * No raw px/hex values appear outside the variable references.
 *
 * Tree-shaking: if `usedClasses` is provided, only used classes (plus the
 * always-on set) are emitted. Pass undefined to emit the full sheet.
 */

import type { DesignSystem } from './schema';
import { SPACING_SCALE } from './schema';

/** Classes always included regardless of usage scan */
const ALWAYS_ON = new Set([
  'screen', 'col', 'row', 'fill', 'hug', 'scroll', 'scroll-x',
  'between', 'center', 'wrap',
]);

export function compileUtilities(ds: DesignSystem, usedClasses?: Set<string>): string {
  const should = (cls: string) =>
    usedClasses === undefined || ALWAYS_ON.has(cls) || usedClasses.has(cls);

  const lines: string[] = [];

  const w = (cls: string, body: string) => {
    if (should(cls)) lines.push(`.${cls} { ${body} }`);
  };

  // ── Layout primitives ─────────────────────────────────────────────────────
  w('screen', 'display:flex;flex-direction:column;align-items:stretch;width:100%;height:100%;overflow:hidden;font-family:var(--font-body);');
  w('col', 'display:flex;flex-direction:column;min-width:0;max-width:100%;');
  w('row', 'display:flex;flex-direction:row;align-items:center;min-width:0;max-width:100%;');
  w('fill', 'flex:1 1 0;min-width:0;min-height:0;overflow-wrap:anywhere;');
  w('hug', 'flex:0 0 auto;');
  w('scroll', 'flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;');
  w('scroll::-webkit-scrollbar', 'display:none;');
  w('scroll-x', 'display:flex;flex-direction:row;flex:0 0 auto;align-self:stretch;width:100%;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;');

  w('between', 'justify-content:space-between;');
  w('around', 'justify-content:space-around;');
  w('center', 'align-items:center;justify-content:center;');
  w('items-start', 'align-items:flex-start;');
  w('items-end', 'align-items:flex-end;');
  w('items-center', 'align-items:center;');
  w('items-stretch', 'align-items:stretch;');
  w('justify-start', 'justify-content:flex-start;');
  w('justify-end', 'justify-content:flex-end;');
  w('justify-center', 'justify-content:center;');
  w('wrap', 'flex-wrap:wrap;');
  w('w-full', 'width:100%;');
  w('h-full', 'height:100%;');
  w('nowrap', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');

  // ── Gap scale (references --sp-*) ─────────────────────────────────────────
  w('gap-0', 'gap:0;');
  for (const px of SPACING_SCALE) {
    w(`gap-${px}`, `gap:var(--sp-${px});`);
  }
  // Legacy short-hand gap aliases (gap-1 = 4px, gap-2 = 8px, etc.)
  const legacyGap = [4, 8, 12, 16, 24, 32];
  legacyGap.forEach((px, i) => {
    const alias = i + 1;
    if (should(`gap-${alias}`)) lines.push(`.gap-${alias} { gap: var(--sp-${px}); }`);
  });

  // ── Padding (all sides) ───────────────────────────────────────────────────
  w('p-0', 'padding:0;');
  for (const px of SPACING_SCALE) {
    w(`p-${px}`, `padding:var(--sp-${px});`);
  }
  legacyGap.forEach((px, i) => {
    const alias = i + 1;
    if (should(`p-${alias}`)) lines.push(`.p-${alias} { padding: var(--sp-${px}); }`);
  });

  // ── Padding inline (horizontal) ───────────────────────────────────────────
  for (const px of SPACING_SCALE) {
    w(`px-${px}`, `padding-inline:var(--sp-${px});`);
  }
  legacyGap.forEach((px, i) => {
    const alias = i + 1;
    if (should(`px-${alias}`)) lines.push(`.px-${alias} { padding-inline: var(--sp-${px}); }`);
  });

  // ── Padding block (vertical) ──────────────────────────────────────────────
  for (const px of SPACING_SCALE) {
    w(`py-${px}`, `padding-block:var(--sp-${px});`);
  }
  legacyGap.forEach((px, i) => {
    const alias = i + 1;
    if (should(`py-${alias}`)) lines.push(`.py-${alias} { padding-block: var(--sp-${px}); }`);
  });

  // ── Color utilities (references --c-*) ────────────────────────────────────
  const colorKeys = [
    'primary', 'on-primary', 'secondary', 'on-secondary', 'accent',
    'background', 'surface', 'surface-alt', 'border', 'divider',
    'text', 'text-muted', 'text-inverse',
    'success', 'warning', 'danger', 'info',
  ] as const;

  for (const key of colorKeys) {
    w(`bg-${key}`, `background-color:var(--c-${key});`);
    w(`text-${key}`, `color:var(--c-${key});`);
  }

  // ── Typography scale ──────────────────────────────────────────────────────
  const scaleKeys = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;
  for (const key of scaleKeys) {
    w(`text-${key}`, `font-size:var(--fs-${key});line-height:var(--lh-normal);`);
  }
  // Legacy text-* aliases used by existing AI output
  const legacyTextMap: Record<string, string> = {
    'text-xs': 'xs', 'text-sm': 'sm', 'text-md': 'base', 'text-base': 'base',
    'text-lg': 'lg', 'text-xl': 'xl',
  };
  for (const [cls, key] of Object.entries(legacyTextMap)) {
    if (should(cls)) lines.push(`.${cls} { font-size: var(--fs-${key}); line-height: var(--lh-normal); }`);
  }

  // ── Radius role utilities ─────────────────────────────────────────────────
  w('rounded-none', 'border-radius:var(--r-none);');
  w('rounded-sm', 'border-radius:var(--r-sm);');
  w('rounded-md', 'border-radius:var(--r-md);');
  w('rounded-lg', 'border-radius:var(--r-lg);');
  w('rounded-xl', 'border-radius:var(--r-xl);');
  w('rounded-full', 'border-radius:var(--r-full);');
  w('rounded-card', 'border-radius:var(--r-card);');
  w('rounded-button', 'border-radius:var(--r-button);');
  w('rounded-input', 'border-radius:var(--r-input);');
  w('rounded-sheet', 'border-radius:var(--r-sheet);');
  w('rounded-chip', 'border-radius:var(--r-chip);');
  w('rounded-avatar', 'border-radius:var(--r-avatar);');

  // ── Elevation ─────────────────────────────────────────────────────────────
  w('shadow-none', 'box-shadow:var(--shadow-none);');
  w('shadow-sm', 'box-shadow:var(--shadow-sm);');
  w('shadow-md', 'box-shadow:var(--shadow-md);');
  w('shadow-lg', 'box-shadow:var(--shadow-lg);');

  // ── Font family ───────────────────────────────────────────────────────────
  w('font-heading', 'font-family:var(--font-heading);');
  w('font-body', 'font-family:var(--font-body);');
  w('font-mono', 'font-family:var(--font-mono);');

  // ── Font weight ───────────────────────────────────────────────────────────
  w('font-regular', 'font-weight:var(--fw-regular);');
  w('font-medium', 'font-weight:var(--fw-medium);');
  w('font-semibold', 'font-weight:var(--fw-semibold);');
  w('font-bold', 'font-weight:var(--fw-bold);');

  // ── Icon size & wrap ──────────────────────────────────────────────────────
  w('icon-sm', 'width:var(--icon-sm);height:var(--icon-sm);');
  w('icon-md', 'width:var(--icon-md);height:var(--icon-md);');
  w('icon-lg', 'width:var(--icon-lg);height:var(--icon-lg);');
  w('icon-wrap', 'display:inline-flex;align-items:center;justify-content:center;border-radius:var(--r-full);background-color:var(--c-surface-alt);padding:var(--sp-8);');

  // ── Common helpers ────────────────────────────────────────────────────────
  w('muted', 'color:var(--c-text-muted);');
  w('border', 'border:var(--bw) var(--bs) var(--c-border);');
  w('border-divider', 'border-bottom:1px solid var(--c-divider);');
  w('surface', 'background-color:var(--c-surface);');
  w('surface-alt', 'background-color:var(--c-surface-alt);');
  w('card', 'background-color:var(--c-surface);border-radius:var(--r-card);box-shadow:var(--shadow-sm);');
  w('divider', 'border-top:1px solid var(--c-divider);');
  w('clamp-1', 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;');
  w('clamp-2', 'overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;');
  w('clamp-3', 'overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;');

  return lines.join('\n');
}

/**
 * Scan an HTML string and return the set of CSS class names used.
 * Used for tree-shaking — pass the result to compileUtilities().
 */
export function scanClasses(html: string): Set<string> {
  const classes = new Set<string>();
  const regex = /class="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    for (const cls of match[1].split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }
  return classes;
}
