/**
 * TezMind HTML Layout Linter v2
 *
 * Runs AFTER deterministic autofix. Reports violations that need LLM repair.
 * Browser-safe (DOMParser) and Node-safe (regex fallback).
 *
 * Rules 1–10:  original contract violations (margin, absolute, float, fixed size, grid,
 *              off-grid spacing, row/col gap, display, fill in wrong context)
 * Rules 11–22: v2 additions (icons, images, avatars, motion, security, text fill)
 * Rules 23–35: §8 theme/token enforcement + §13 composition/richness rules
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { ICON_NAMES_SET } from '../icons';
import { ALLOWED_ALL_MOTIONS, ALLOWED_ENTRANCE_MOTIONS } from './autofix';
import { TYPE_SCALE_PX } from '../designSystem/schema';
import type { LintContext } from '../designSystem/schema';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LintSeverity = 'error' | 'warning';

export interface HtmlLintViolation {
  /** CSS-selector-like description of the offending element */
  selector: string;
  /** Machine-readable rule id */
  rule: string;
  /** Human-readable description */
  message: string;
  /** Minimal fix hint for LLM repair */
  fix: string;
  severity: LintSeverity;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getSelector(el: Element): string {
  const id = el.getAttribute('data-tz-id');
  const name = el.getAttribute('data-tz-name');
  const tag = el.tagName.toLowerCase();
  if (id) return `[data-tz-id="${id}"]${name ? ` (${name})` : ''}`;
  const cls = el.className
    ? `.${String(el.className).trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  return `${tag}${cls}`;
}

function parseStyle(styleAttr: string): Record<string, string> {
  const result: Record<string, string> = {};
  styleAttr.split(';').forEach((decl) => {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) return;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim().toLowerCase();
    if (prop && val) result[prop] = val;
  });
  return result;
}

function hasGapClass(el: Element): boolean {
  return Array.from(el.classList).some((c) => c.startsWith('gap-'));
}

function isOnFourPxGrid(pxVal: string): boolean {
  const n = parseFloat(pxVal);
  return isNaN(n) || n % 4 === 0 || n === 1;
}

const LEAF_TAGS = new Set(['I', 'INPUT', 'TEXTAREA', 'BUTTON', 'HR', 'SVG', 'SPAN', 'IMG']);
const SAFE_OVERLAYS = new Set(['badge-overlay', 'fab', 'sheet', 'dialog', 'toast']);
const isSafeOverlay = (el: Element) =>
  !!el.parentElement?.classList.contains('overlay-anchor') &&
  Array.from(el.classList).some((name) => SAFE_OVERLAYS.has(name));

function isLeafEl(el: Element): boolean {
  if (LEAF_TAGS.has(el.tagName)) return true;
  if (!el.children || el.children.length === 0) return true;
  if (isSafeOverlay(el)) return true;
  return false;
}

// ── Main linter ───────────────────────────────────────────────────────────────

/**
 * Lint an HTML string for Layout Contract v2 violations.
 * Uses DOMParser when available (browser), otherwise returns empty (skip in Node).
 *
 * @param html         The HTML string to lint.
 * @param lintContext  Optional design system + composition context for §8/§13 rules.
 */
export function lintHtml(html: string, lintContext?: LintContext): HtmlLintViolation[] {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return []; // SSR / non-browser: skip lint (autofix handles what it can)
  }

  const violations: HtmlLintViolation[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

  let loopMotionCount = 0;
  const LOOP_MOTIONS = new Set(['pulse', 'float', 'glow', 'shimmer']);

  const walk = (el: Element) => {
    const sel = getSelector(el);
    const style = parseStyle(el.getAttribute('style') ?? '');
    const classes = Array.from(el.classList);
    const leaf = isLeafEl(el);
    const isOverlay = isSafeOverlay(el);

    // ── Rule 1: No margin on containers ───────────────────────────────────
    ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'].forEach((prop) => {
      const val = style[prop];
      if (val && val !== '0' && val !== '0px') {
        violations.push({
          selector: sel, rule: 'NO_MARGIN', severity: 'error',
          message: `${sel} uses ${prop}:${val}. Margins are forbidden — use gap-* on parent.`,
          fix: `Remove ${prop}. Add gap-* class to the parent container.`,
        });
      }
    });

    // ── Rule 2: No position:absolute|fixed except overlay ─────────────────
    if (!isOverlay && (style['position'] === 'absolute' || style['position'] === 'fixed')) {
      violations.push({
        selector: sel, rule: 'NO_ABSOLUTE_POSITION', severity: 'error',
        message: `${sel} uses position:${style['position']}. Only data-tz-overlay elements may be positioned.`,
        fix: 'Add data-tz-overlay and wrap parent with .overlay-anchor, or restructure with .row.between.',
      });
    }

    // ── Rule 3: No float ──────────────────────────────────────────────────
    if (style['float'] && style['float'] !== 'none') {
      violations.push({
        selector: sel, rule: 'NO_FLOAT', severity: 'error',
        message: `${sel} uses float:${style['float']}. Float is forbidden.`,
        fix: 'Replace float with a .row parent container.',
      });
    }

    // ── Rule 4: No fixed px width/height on non-leaf containers ───────────
    if (!leaf) {
      ['width', 'height', 'min-width', 'max-width'].forEach((prop) => {
        const val = style[prop];
        if (val && val !== '100%' && /^\d+px$/.test(val)) {
          const px = parseFloat(val);
          if (px > 56) {
            violations.push({
              selector: sel, rule: 'FIXED_SIZE_ON_CONTAINER', severity: 'error',
              message: `${sel} has ${prop}:${val} on a container. Use .fill or .hug instead.`,
              fix: `Remove ${prop} from style. Add class .fill (stretch) or .hug (shrink-wrap).`,
            });
          }
        }
      });
    }

    // ── Rule 5: All px values on 4px grid ─────────────────────────────────
    const NON_GRID_EXEMPT = new Set(['border-radius', 'font-size', 'line-height', 'letter-spacing', 'opacity', 'border-width', 'border']);
    Object.entries(style).forEach(([prop, val]) => {
      if (NON_GRID_EXEMPT.has(prop)) return;
      const pxMatches = val.match(/(\d+(?:\.\d+)?)px/g) ?? [];
      pxMatches.forEach((pxStr) => {
        if (!isOnFourPxGrid(pxStr)) {
          violations.push({
            selector: sel, rule: 'OFF_GRID_SPACING', severity: 'error',
            message: `${sel} has ${prop}:…${pxStr}… which is not on the 4px grid.`,
            fix: `Round ${pxStr} to the nearest multiple of 4.`,
          });
        }
      });
    });

    // ── Rule 6: .row with multiple children must have gap-* ───────────────
    if (classes.includes('row') && el.children.length > 1 && !hasGapClass(el)) {
      violations.push({
        selector: sel, rule: 'ROW_MISSING_GAP', severity: 'error',
        message: `${sel} is .row with ${el.children.length} children but no gap-* class.`,
        fix: 'Add gap-2, gap-3, or gap-4 to this .row.',
      });
    }

    // ── Rule 7: .col with multiple children must have gap-* ───────────────
    if (classes.includes('col') && el.children.length > 1 && !hasGapClass(el)) {
      violations.push({
        selector: sel, rule: 'COL_MISSING_GAP', severity: 'error',
        message: `${sel} is .col with ${el.children.length} children but no gap-* class.`,
        fix: 'Add gap-2, gap-3, or gap-4 to this .col.',
      });
    }

    // ── Rule 8: No display:grid / display:inline-flex ────────────────────
    const displayVal = style['display'];
    if (displayVal && !['flex', 'block', 'inline', 'inline-block', 'none', 'contents', 'inline-flex'].includes(displayVal)) {
      violations.push({
        selector: sel, rule: 'INVALID_DISPLAY', severity: 'error',
        message: `${sel} uses display:${displayVal}. Only flex/block/inline allowed.`,
        fix: `Remove display:${displayVal}. Use .row or .col classes instead.`,
      });
    }

    // ── Rule 10: .fill used inside something other than .row/.col ─────────
    if (classes.includes('fill')) {
      const parent = el.parentElement;
      if (parent) {
        const parentCls = Array.from(parent.classList);
        if (!parentCls.includes('row') && !parentCls.includes('col') &&
            !parentCls.includes('screen') && !parentCls.includes('scroll')) {
          violations.push({
            selector: sel, rule: 'FILL_OUTSIDE_FLEX', severity: 'warning',
            message: `${sel} has .fill but its parent is not .row/.col.`,
            fix: 'Wrap parent in .row or .col, or remove .fill from this element.',
          });
        }
      }
    }

    // ── Rule 11: .icon must have valid data-icon ──────────────────────────
    if (classes.includes('icon')) {
      const iconName = el.getAttribute('data-icon') ?? '';
      if (!iconName || !ICON_NAMES_SET.has(iconName.trim().toLowerCase())) {
        violations.push({
          selector: sel, rule: 'ICON_UNKNOWN_NAME', severity: 'error',
          message: `${sel} is .icon but data-icon="${iconName}" is not in the allowlist.`,
          fix: `Change data-icon to a valid name from the allowlist, or use "circle".`,
        });
      }
    }

    // ── Rule 12: No <i>, <svg>, <img> used as icon; no icon-font classes ──
    if (el.tagName === 'I' && !el.hasAttribute('data-icon')) {
      violations.push({
        selector: sel, rule: 'FORBIDDEN_ICON_TAG', severity: 'error',
        message: `${sel} uses <i> without data-icon. Use <span class="icon" data-icon="name"> instead.`,
        fix: `Replace with <span class="icon hug" data-icon="name" data-size="20"></span>.`,
      });
    }
    const clsStr = el.className;
    if (typeof clsStr === 'string' && (clsStr.includes('fa-') || clsStr.includes('material-icons') || clsStr.includes('bi-'))) {
      violations.push({
        selector: sel, rule: 'ICON_FONT_CLASS', severity: 'error',
        message: `${sel} uses an icon font class (${clsStr}). Use data-icon instead.`,
        fix: `Replace with <span class="icon hug" data-icon="name" data-size="20"></span>.`,
      });
    }

    // ── Rule 13: .img must have data-img, data-alt, valid data-ratio ──────
    if (classes.includes('img')) {
      if (!el.getAttribute('data-img')) {
        violations.push({
          selector: sel, rule: 'IMG_MISSING_DATA', severity: 'error',
          message: `${sel} is .img but missing data-img attribute.`,
          fix: 'Add data-img="slug" data-alt="description" data-ratio="16:9".',
        });
      }
      const ratio = el.getAttribute('data-ratio') ?? '';
      if (ratio && !/^\d+:\d+$/.test(ratio)) {
        violations.push({
          selector: sel, rule: 'IMG_INVALID_RATIO', severity: 'error',
          message: `${sel} has invalid data-ratio="${ratio}". Must be W:H (e.g. "16:9").`,
          fix: 'Set data-ratio to "16:9", "4:3", "1:1", "3:4", or "21:9".',
        });
      }
    }

    // ── Rule 14: .avatar must have data-name ─────────────────────────────
    if (classes.includes('avatar') && !el.getAttribute('data-name')) {
      violations.push({
        selector: sel, rule: 'AVATAR_MISSING_NAME', severity: 'error',
        message: `${sel} is .avatar but missing data-name.`,
        fix: 'Add data-name="First Last" to the avatar element.',
      });
    }

    // ── Rule 15: data-motion / data-stagger values in allowlist ──────────
    const motionVal = el.getAttribute('data-motion');
    if (motionVal !== null && !ALLOWED_ALL_MOTIONS.has(motionVal)) {
      violations.push({
        selector: sel, rule: 'INVALID_MOTION', severity: 'error',
        message: `${sel} has data-motion="${motionVal}" which is not in the allowed set.`,
        fix: `Use one of: ${[...ALLOWED_ALL_MOTIONS].join(', ')}.`,
      });
    }

    const staggerVal = el.getAttribute('data-stagger');
    if (staggerVal !== null && !ALLOWED_ENTRANCE_MOTIONS.has(staggerVal)) {
      violations.push({
        selector: sel, rule: 'INVALID_STAGGER', severity: 'error',
        message: `${sel} has data-stagger="${staggerVal}". data-stagger only accepts entrance motions.`,
        fix: `Use one of: ${[...ALLOWED_ENTRANCE_MOTIONS].join(', ')}.`,
      });
    }

    // ── Rule 16: No inline animation/transition/@keyframes ────────────────
    const styleRaw = (el.getAttribute('style') ?? '').toLowerCase();
    if (/animation\s*:/.test(styleRaw) || /transition\s*:/.test(styleRaw) || /@keyframes/.test(styleRaw)) {
      violations.push({
        selector: sel, rule: 'INLINE_ANIMATION', severity: 'error',
        message: `${sel} has inline animation or transition CSS. Use data-motion/data-press instead.`,
        fix: 'Remove animation/transition from style. Use data-motion="fade-up" or data-press attribute.',
      });
    }

    if (/transform\s*:/.test(styleRaw)) {
      violations.push({
        selector: sel, rule: 'INLINE_TRANSFORM', severity: 'error',
        message: `${sel} uses an inline transform that can move content over neighboring elements.`,
        fix: 'Remove the inline transform and use a supported data-motion effect instead.',
      });
    }

    // ── Rule 17: Loop animations ≤ 3 per screen ───────────────────────────
    if (motionVal && LOOP_MOTIONS.has(motionVal)) {
      loopMotionCount++;
      if (loopMotionCount > 3) {
        violations.push({
          selector: sel, rule: 'TOO_MANY_LOOPS', severity: 'error',
          message: `${sel} is the ${loopMotionCount}th loop animation. Max 3 per screen.`,
          fix: 'Remove data-motion from this element (keep only the 3 most impactful loops).',
        });
      }
    }

    // ── Rule 18: No http(s):// or data: URLs in attributes ───────────────
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name === 'href') return; // links are allowed
      if (/https?:\/\//.test(attr.value) || /^data:/.test(attr.value)) {
        violations.push({
          selector: sel, rule: 'EXTERNAL_URL', severity: 'error',
          message: `${sel} attr "${attr.name}" contains an external URL or data URI.`,
          fix: 'Remove the URL. For images use <div class="img" data-img="slug">; for icons use data-icon.',
        });
      }
    });

    // ── Rule 20: Text-bearing leaf with sibling .hug in .row must be .fill ─
    if (classes.includes('row')) {
      const children = Array.from(el.children);
      const hasHugSibling = children.some((c) => c.classList.contains('hug'));
      if (hasHugSibling) {
        children.forEach((child) => {
          const childCls = Array.from(child.classList);
          const isTextEl = ['H1','H2','H3','H4','H5','H6','P','SPAN','LABEL'].includes(child.tagName);
          const hasText = child.textContent && child.textContent.trim().length > 0;
          if (isTextEl && hasText && !childCls.includes('fill') && !childCls.includes('hug')) {
            violations.push({
              selector: getSelector(child), rule: 'TEXT_NEEDS_FILL', severity: 'error',
              message: `${getSelector(child)} is a text element in .row next to a .hug sibling but lacks .fill. It will overlap.`,
              fix: 'Add .fill class to this text element so it stretches and pushes .hug siblings aside.',
            });
          }
        });
      }
    }

    // ── Rule 22: .nav-item text must have .nowrap ─────────────────────────
    if (classes.includes('nav-item')) {
      const textChildren = el.querySelectorAll('span, p, label');
      textChildren.forEach((tc) => {
        if (!tc.classList.contains('nowrap') && !tc.classList.contains('text-xs')) {
          violations.push({
            selector: getSelector(tc), rule: 'NAV_LABEL_NEEDS_NOWRAP', severity: 'warning',
            message: `Nav item label "${tc.textContent?.trim()}" may wrap. Add .nowrap class.`,
            fix: 'Add class "nowrap" to the nav label element.',
          });
        }
      });
    }

    // Recurse
    Array.from(el.children).forEach(walk);
  };

  const root = doc.body.firstElementChild ?? doc.body;
  if (root.tagName !== 'BODY') walk(root);
  else Array.from(root.children).forEach(walk);

  // ── §8 Theme / token rules (require lintContext.designSystem) ────────────
  const ds = lintContext?.designSystem;
  if (ds) {
    // Rule 23: THEME_MODE_MISMATCH — classes/attrs implying the wrong mode
    const modeOpposite = ds.mode === 'light' ? 'dark' : 'light';
    const allClasses = Array.from(doc.querySelectorAll('[class]'))
      .flatMap((el) => Array.from(el.classList))
      .join(' ');
    if (allClasses.includes(modeOpposite) || html.includes(`data-theme="${modeOpposite}"`)) {
      violations.push({
        selector: '.screen',
        rule: 'THEME_MODE_MISMATCH',
        severity: 'error',
        message: `Project mode is "${ds.mode}" but output contains "${modeOpposite}" classes or data-theme.`,
        fix: `Remove all "${modeOpposite}" class references. Use var(--c-*) tokens; they reflect the project mode.`,
      });
    }

    // Rule 24: RAW_COLOR — inline hex/rgb/hsl in style attributes
    doc.querySelectorAll('[style]').forEach((el) => {
      const styleRaw = el.getAttribute('style') ?? '';
      if (/#[0-9a-fA-F]{3,8}\b/.test(styleRaw) ||
          /\brgb\s*\(/.test(styleRaw) ||
          /\bhsl\s*\(/.test(styleRaw)) {
        violations.push({
          selector: getSelector(el),
          rule: 'RAW_COLOR',
          severity: 'error',
          message: `${getSelector(el)} has a raw color value in style attribute. Use var(--c-*) tokens.`,
          fix: 'Replace the color with the nearest var(--c-*) token (e.g. var(--c-primary), var(--c-surface)).',
        });
      }
    });

    // Rule 25: RADIUS_ROLE — card/button/input/sheet/chip/avatar must use semantic radius classes
    const RADIUS_ROLE_CHECKS: [string, string, string, string][] = [
      ['.card, [data-role="card"]', 'rounded-card', 'card', 'var(--r-card)'],
      ['button, .btn, [role="button"], [data-role="button"]', 'rounded-button', 'button', 'var(--r-button)'],
      ['input, textarea, select, .field, [data-role="input"]', 'rounded-input', 'input', 'var(--r-input)'],
      ['.sheet, [data-role="sheet"]', 'rounded-sheet', 'sheet', 'var(--r-sheet)'],
      ['.chip, [data-role="chip"]', 'rounded-chip', 'chip', 'var(--r-chip)'],
      ['.avatar, [data-role="avatar"]', 'rounded-avatar', 'avatar', 'var(--r-avatar)'],
    ];

    for (const [selector, expectedClass, roleName, tokenVar] of RADIUS_ROLE_CHECKS) {
      doc.querySelectorAll(selector).forEach((el) => {
        const styleRaw = (el.getAttribute('style') ?? '').toLowerCase();
        if (/border-radius\s*:\s*\d/.test(styleRaw) && !el.classList.contains(expectedClass)) {
          violations.push({
            selector: getSelector(el),
            rule: 'RADIUS_ROLE',
            severity: 'error',
            message: `${getSelector(el)} has a raw border-radius. ${roleName} elements must use class "${expectedClass}" (${tokenVar}).`,
            fix: `Remove border-radius from style and add class "${expectedClass}".`,
          });
        }
      });
    }

    // Rule: TYPE_SCALE — inline font-size must be from the type scale or use token
    doc.querySelectorAll('[style*="font-size"]').forEach((el) => {
      const styleRaw = el.getAttribute('style') ?? '';
      const match = styleRaw.match(/font-size\s*:\s*([^;]+)/i);
      if (match) {
        const val = match[1].trim();
        if (!val.includes('var(--fs-')) {
          const pxVal = parseInt(val, 10);
          if (isNaN(pxVal) || !(TYPE_SCALE_PX as readonly number[]).includes(pxVal as any)) {
            violations.push({
              selector: getSelector(el),
              rule: 'TYPE_SCALE',
              severity: 'error',
              message: `${getSelector(el)} has font-size: ${val} which is outside the type scale.`,
              fix: 'Use a valid type scale token (e.g. var(--fs-base), var(--fs-lg)) or text-* utility class.',
            });
          }
        }
      }
    });

    // Rule 26: FONT_NOT_ALLOWED — inline font-family not from tokens
    doc.querySelectorAll('[style*="font-family"]').forEach((el) => {
      const styleRaw = el.getAttribute('style') ?? '';
      if (!/var\(--font-/.test(styleRaw)) {
        violations.push({
          selector: getSelector(el),
          rule: 'FONT_NOT_ALLOWED',
          severity: 'error',
          message: `${getSelector(el)} has an inline font-family not using a token variable.`,
          fix: 'Use var(--font-body), var(--font-heading), or var(--font-mono).',
        });
      }
    });

    // Rule 27: ICON_LIBRARY_MIXED — icon class from a different library
    const LIBRARY_PATTERNS: Record<string, RegExp> = {
      fontawesome: /\bfa[srbl]?-/,
      'material-symbols': /\b(material-symbols|material-icons)\b/,
      lucide: /\blucide-/,
    };
    const otherLibraries = Object.entries(LIBRARY_PATTERNS)
      .filter(([lib]) => lib !== ds.icons.library);
    doc.querySelectorAll('[class]').forEach((el) => {
      const cls = el.className;
      for (const [lib, pattern] of otherLibraries) {
        if (pattern.test(cls)) {
          violations.push({
            selector: getSelector(el),
            rule: 'ICON_LIBRARY_MIXED',
            severity: 'error',
            message: `${getSelector(el)} uses ${lib} icon classes but project icon library is "${ds.icons.library}".`,
            fix: `Replace with <span class="icon hug" data-icon="name"></span> from the project allowlist.`,
          });
          break;
        }
      }
    });

    // Rule 28: COMPONENT_REIMPLEMENTED — common patterns without data-component
    const componentHints = ['text-input', 'btn-primary', 'button-primary', 'bottom-nav', 'app-bar'];
    for (const hint of componentHints) {
      if (html.includes(`class="${hint}"`) && !html.includes(`data-component="${hint}"`)) {
        violations.push({
          selector: `.${hint}`,
          rule: 'COMPONENT_REIMPLEMENTED',
          severity: 'warning',
          message: `Class "${hint}" looks like a registered component. Use data-component="${hint}" and pull from the registry.`,
          fix: `Add data-component="${hint}" attribute to use the registered component instead of reimplementing it.`,
        });
      }
    }
  }

  // ── §13 Composition / richness rules (require lintContext.composition) ────
  const composition = lintContext?.composition;
  if (composition) {
    // Rule 29: SECTION_MISSING — required section not in output
    for (const section of composition.sections) {
      const found = doc.querySelector(`[data-section="${section.id}"]`);
      if (!found) {
        violations.push({
          selector: '.screen',
          rule: 'SECTION_MISSING',
          severity: 'error',
          message: `Required section "${section.id}" (role: ${section.role}) is absent from the output.`,
          fix: `Add a container with data-section="${section.id}" and the ${section.role} layout.`,
        });
      }
    }

    // Rule 30: LIST_TOO_SHORT — list sections below minItems
    for (const section of composition.sections) {
      if (!section.minItems) continue;
      const el = doc.querySelector(`[data-section="${section.id}"]`);
      if (!el) continue;
      const items = el.querySelectorAll('[data-role="list-item"], .list-item, li');
      if (items.length < section.minItems) {
        violations.push({
          selector: `[data-section="${section.id}"]`,
          rule: 'LIST_TOO_SHORT',
          severity: 'error',
          message: `Section "${section.id}" has ${items.length} items but requires ≥ ${section.minItems}.`,
          fix: `Add ${section.minItems - items.length} more realistic list items to this section.`,
        });
      }
    }

    // Rule 31: LIST_ITEM_NO_LEADING_VISUAL
    doc.querySelectorAll('[data-role="list-item"], .list-item').forEach((item) => {
      const hasLeading =
        item.querySelector('.icon, .avatar, .img, [data-icon], [data-img], [data-name]') !== null;
      if (!hasLeading) {
        violations.push({
          selector: getSelector(item),
          rule: 'LIST_ITEM_NO_LEADING_VISUAL',
          severity: 'warning',
          message: `${getSelector(item)} has no leading visual (icon, avatar, or image).`,
          fix: 'Add a leading <span class="icon hug" data-icon="..."> or <div class="avatar hug" data-name="..."> as the first child.',
        });
      }
    });

    // Rule 32: ACTION_NO_ICON — buttons/tabs without icons (unless data-text-only)
    doc.querySelectorAll('button:not([data-text-only]), [role="tab"]:not([data-text-only])').forEach((btn) => {
      const hasIcon = btn.querySelector('.icon, [data-icon]') !== null;
      const isNavItem = btn.classList.contains('nav-item');
      if (!hasIcon && !isNavItem) {
        violations.push({
          selector: getSelector(btn),
          rule: 'ACTION_NO_ICON',
          severity: 'warning',
          message: `${getSelector(btn)} has no icon. Add a leading or trailing <span class="icon"> or mark with data-text-only.`,
          fix: 'Add <span class="icon hug" data-icon="..."></span> inside the button, or add data-text-only if purely textual.',
        });
      }
    });

    // Rule 33: FLAT_LAYOUT — section with > 6 direct text/icon children and no grouping containers
    doc.querySelectorAll('[data-section]').forEach((section) => {
      const directChildren = Array.from(section.children);
      const directLeaves = directChildren.filter((c) =>
        ['SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL'].includes(c.tagName)
      );
      if (directLeaves.length > 6) {
        violations.push({
          selector: getSelector(section),
          rule: 'FLAT_LAYOUT',
          severity: 'warning',
          message: `${getSelector(section)} has ${directLeaves.length} direct text children with no grouping containers.`,
          fix: 'Group related elements into container divs with data-role (e.g. card, list-item, toolbar).',
        });
      }
    });

    // Rule 34: NESTING_DEPTH — depth > 8
    const checkDepth = (el: Element, depth: number) => {
      if (depth > 8) {
        violations.push({
          selector: getSelector(el),
          rule: 'NESTING_DEPTH',
          severity: 'error',
          message: `${getSelector(el)} is at nesting depth ${depth} (max 8). Flatten unnecessary wrappers.`,
          fix: 'Remove empty or purpose-free wrapper divs. Merge into the parent container.',
        });
        return; // stop counting deeper
      }
      Array.from(el.children).forEach((child) => checkDepth(child, depth + 1));
    };
    checkDepth(root, 0);

    // Rule 35: ICON_INCONSISTENT — same concept uses different icon than iconUsage map
    const iconUsage = lintContext?.iconUsage;
    if (iconUsage) {
      doc.querySelectorAll('[data-icon]').forEach((el) => {
        const iconName = el.getAttribute('data-icon') ?? '';
        const label = (el.getAttribute('aria-label') ?? '').toLowerCase();
        for (const [concept, expectedIcon] of Object.entries(iconUsage)) {
          if (label.includes(concept) && iconName !== expectedIcon) {
            violations.push({
              selector: getSelector(el),
              rule: 'ICON_INCONSISTENT',
              severity: 'warning',
              message: `Icon for concept "${concept}" is "${iconName}" but project uses "${expectedIcon}" consistently.`,
              fix: `Change data-icon to "${expectedIcon}" to match project icon conventions.`,
            });
          }
        }
      });
    }

    // Rule: ICON_PLAN_UNUSED — planned icons absent from output
    if (composition.iconPlan && composition.iconPlan.length > 0) {
      const usedIcons = new Set<string>();
      doc.querySelectorAll('[data-icon]').forEach((el) => {
        const iconName = el.getAttribute('data-icon');
        if (iconName) usedIcons.add(iconName.trim().toLowerCase());
      });
      for (const planned of composition.iconPlan) {
        if (!usedIcons.has(planned.name.trim().toLowerCase())) {
          violations.push({
            selector: '.screen',
            rule: 'ICON_PLAN_UNUSED',
            severity: 'warning',
            message: `Planned icon "${planned.name}" (purpose: ${planned.purpose}, location: ${planned.where}) was not used in the screen.`,
            fix: `Add <span class="icon hug" data-icon="${planned.name}"></span> in ${planned.where}.`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Format violations into a compact repair prompt for LLM.
 * Only errors are included (warnings are informational).
 */
export function buildRepairPrompt(
  html: string,
  violations: HtmlLintViolation[],
  contractSummary?: string,
): string {
  const errors = violations.filter((v) => v.severity === 'error');
  const violationList = errors
    .slice(0, 20)
    .map((v, i) => `${i + 1}. [${v.rule}] on ${v.selector}\n   ISSUE: ${v.message}\n   FIX: ${v.fix}`)
    .join('\n\n');

  const contract = contractSummary
    ? `\n\nLAYOUT CONTRACT REMINDER:\n${contractSummary}`
    : '';

  return `The following HTML has layout contract violations. Make ONLY the minimal edits to fix each violation. Do not rewrite the entire HTML. Keep all data-tz-id values unchanged. Return the complete corrected HTML.${contract}

VIOLATIONS TO FIX:
${violationList}

ORIGINAL HTML:
${html}

Output ONLY the fixed HTML. Apply all fixes. Do not change any design, colors, copy, or structure beyond what is required.`;
}
