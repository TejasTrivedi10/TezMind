/**
 * TezMind Layout Contract v2 Linter
 *
 * Runs after deterministic autofix. Identifies any remaining structural issues
 * or missing roles for LLM repair.
 */

import { parseScreen } from './parse';
import { ROLE_DESC, ROLE_REGION, type Role } from './roles';
import { ICON_NAMES } from '../icons/names';
import type { FixCtx } from './autofix';

const SAFE_OVERLAYS = new Set(['badge-overlay', 'fab', 'sheet', 'dialog', 'toast']);
const isSafeOverlay = (el: Element) =>
  !!el.parentElement?.classList.contains('overlay-anchor') &&
  Array.from(el.classList).some((name) => SAFE_OVERLAYS.has(name));

export interface Violation {
  id: string;
  rule: string;
  severity: 'error' | 'warn';
  message: string;
  fix: string;
}

export function lint(html: string, ctx: FixCtx = { required: [] }): Violation[] {
  const v: Violation[] = [];
  const doc = parseScreen(html);
  const root = doc.body.firstElementChild as HTMLElement | null;

  if (!root || !root.classList.contains('screen')) {
    return [
      {
        id: 'root',
        rule: 'R1',
        severity: 'error',
        message: 'Missing root .screen',
        fix: 'Wrap everything in <div class="screen">',
      },
    ];
  }

  // R30: required roles present
  for (const role of ctx.required) {
    if (!root.querySelector(`[data-role="${role}"]`)) {
      v.push({
        id: role,
        rule: 'R30',
        severity: 'error',
        message: `Required element data-role="${role}" is missing`,
        fix: `Add it in the ${ROLE_REGION[role]} region: ${ROLE_DESC[role]}`,
      });
    }
  }

  // R31: single scroll body as direct child
  if (!root.querySelector(':scope > .scroll')) {
    v.push({
      id: 'scroll',
      rule: 'R31',
      severity: 'error',
      message: 'No .scroll body directly under .screen',
      fix: 'Put the main content in one <div class="scroll col ...">',
    });
  }

  // R32: footer inside scroll
  root.querySelectorAll('.scroll [data-role="composer"], .scroll [data-role="bottom-nav"]').forEach((el) => {
    v.push({
      id: el.getAttribute('data-tz-id') ?? '',
      rule: 'R32',
      severity: 'error',
      message: 'Footer is inside .scroll',
      fix: 'Move it to be a direct child of .screen after .scroll',
    });
  });

  // R33: page padding
  Array.from(root.children).forEach((c) => {
    if (!c.hasAttribute('data-bleed') && !/\b(p|px)-\d\b/.test(c.className)) {
      v.push({
        id: c.getAttribute('data-tz-id') ?? '',
        rule: 'R33',
        severity: 'warn',
        message: 'Region has no horizontal padding',
        fix: 'Add px-4',
      });
    }
  });

  // R34: text siblings of .hug must be .fill
  root.querySelectorAll('.row').forEach((r) => {
    const kids = Array.from(r.children);
    if (kids.some((k) => k.classList.contains('hug'))) {
      kids.forEach((k) => {
        if ((k.textContent ?? '').trim() && !k.classList.contains('hug') && !k.classList.contains('fill')) {
          v.push({
            id: k.getAttribute('data-tz-id') ?? '',
            rule: 'R34',
            severity: 'warn',
            message: 'Text sibling of a .hug node is not .fill',
            fix: 'Add class fill',
          });
        }
      });
    }
  });

  // Inline margin check
  if (root.querySelectorAll('.row,.col').length && /\bmargin\b/i.test(root.outerHTML.match(/style="[^"]*"/g)?.join('') ?? '')) {
    v.push({
      id: 'margin',
      rule: 'R1',
      severity: 'error',
      message: 'Inline margin used',
      fix: 'Use gap-*/p-* classes',
    });
  }

  // Contract v2 element checks
  root.querySelectorAll('*').forEach((el) => {
    const id = el.getAttribute('data-tz-id') ?? '';
    const st = el.getAttribute('style') ?? '';

    if (/\bposition\s*:\s*(absolute|fixed)/i.test(st) && !isSafeOverlay(el)) {
      v.push({
        id,
        rule: 'R2',
        severity: 'error',
        message: 'position: absolute/fixed on non-overlay element',
        fix: 'Keep actions and content in normal flow. Only use absolute positioning for .badge-overlay, .fab, .sheet, .dialog, or .toast.',
      });
    }

    if (/\btransform\s*:/i.test(st)) {
      v.push({
        id,
        rule: 'R2',
        severity: 'error',
        message: 'Inline transform can visually move content over other elements.',
        fix: 'Remove the inline transform and use a supported data-motion effect that does not affect layout.',
      });
    }

    if (el.children.length > 0) {
      const fixedSize = st.match(/\b(width|height|min-width|max-width|min-height|max-height)\s*:\s*(\d+(?:\.\d+)?)px/gi) ?? [];
      fixedSize.forEach((declaration) => {
        const value = Number(declaration.match(/(\d+(?:\.\d+)?)px/i)?.[1]);
        if (value > 56) {
          v.push({
            id,
            rule: 'R4',
            severity: 'error',
            message: `Fixed ${declaration} on a content container can clip or overlap generated content.`,
            fix: 'Remove the fixed dimension and let the content determine its size; constrain it with flex and max-width:100%.',
          });
        }
      });
    }

    if (/\bfloat\b/i.test(st)) {
      v.push({
        id,
        rule: 'R3',
        severity: 'error',
        message: 'float used',
        fix: 'Remove float, use .row/.col',
      });
    }

    if (/\bdisplay\s*:\s*grid\b/i.test(st)) {
      v.push({
        id,
        rule: 'R8',
        severity: 'error',
        message: 'display: grid used',
        fix: 'Use nested .row and .col flex containers',
      });
    }

    if (el.tagName === 'I' || el.tagName === 'SVG') {
      v.push({
        id,
        rule: 'R11',
        severity: 'error',
        message: 'Raw <i> or <svg> used for icon',
        fix: 'Use <span class="icon" data-icon="..."></span>',
      });
    }

    if (el.tagName === 'IMG') {
      v.push({
        id,
        rule: 'R12',
        severity: 'error',
        message: 'Raw <img> used',
        fix: 'Use <div class="img" data-img="..."></div>',
      });
    }

    if (el.hasAttribute('data-icon')) {
      const iconName = el.getAttribute('data-icon') ?? '';
      if (!(ICON_NAMES as readonly string[]).includes(iconName)) {
        v.push({
          id,
          rule: 'R13',
          severity: 'error',
          message: `Unknown icon name "${iconName}"`,
          fix: 'Use a valid Lucide icon name',
        });
      }
    }
  });

  return v;
}

/** Validate source-level width constraints against the target canvas. */
export function lintBounds(html: string, maxWidth = 393): Violation[] {
  const violations: Violation[] = [];
  const doc = parseScreen(html);
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root || !root.classList.contains('screen')) return violations;
  const canvasWidth = Math.max(1, maxWidth);

  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    for (const declaration of style.split(';')) {
      const match = declaration.trim().match(/^(width|min-width)\s*:\s*(\d+(?:\.\d+)?)px\s*$/i);
      if (!match || Number(match[2]) <= canvasWidth) continue;
      const id = el.getAttribute('data-tz-id') ?? '';
      violations.push({
        id,
        rule: 'R40',
        severity: 'error',
        message: `${match[1]} ${match[2]}px exceeds the ${canvasWidth}px screen width.`,
        fix: 'Remove the oversized fixed width and use w-full, .fill, or a responsive maximum width.',
      });
    }

    if (/(?:overflow-x\s*:\s*(?:auto|scroll)|scroll-snap-type\s*:\s*x)\b/i.test(style)
      && !el.classList.contains('scroll-x')) {
      violations.push({
        id: el.getAttribute('data-tz-id') ?? '',
        rule: 'R42',
        severity: 'error',
        message: 'Horizontal overflow is not using the touch-scroll layout contract.',
        fix: 'Add .scroll-x so horizontal overflow stays within the viewport and remains touch-scrollable.',
      });
    }

    if (/\bscroll-snap-type\s*:\s*x\b/i.test(style)) {
      el.querySelectorAll<HTMLElement>(':scope > .card').forEach((card) => {
        if (card.classList.contains('carousel-item')) return;
        violations.push({
          id: card.getAttribute('data-tz-id') ?? '',
          rule: 'R43',
          severity: 'error',
          message: 'A snapping carousel card can shrink to fit instead of remaining swipeable.',
          fix: 'Add .carousel-item to keep each card at a swipeable width.',
        });
      });
    }
  });

  const children = Array.from(root.children) as HTMLElement[];
  const scrollIndex = children.findIndex((child) => child.classList.contains('scroll'));
  if (scrollIndex >= 0) {
    const footer = children.slice(scrollIndex + 1).find((child) => {
      if (child.matches('nav,[data-role="bottom-nav"]')) return false;
      const hasAction = child.matches('[data-role="primary-cta"],.btn-primary,button')
        || !!child.querySelector('[data-role="primary-cta"],.btn-primary,button');
      const hasFooterSurface = child.matches('footer,[data-role="footer"],.footer,.bottom-bar')
        || child.classList.contains('hug')
        || /border-top\s*:/i.test(child.getAttribute('style') ?? '');
      return hasAction && hasFooterSurface;
    });
    if (footer && (footer.classList.contains('hug') || !footer.classList.contains('w-full'))) {
      violations.push({
        id: footer.getAttribute('data-tz-id') ?? 'footer',
        rule: 'R41',
        severity: 'error',
        message: 'Bottom action bar does not explicitly fill the screen width.',
        fix: 'Remove .hug from the footer wrapper and add data-role="footer" and w-full.',
      });
    }
  }

  return violations;
}
