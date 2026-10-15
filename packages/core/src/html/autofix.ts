/**
 * TezMind Deterministic Autofix (Contract v2)
 *
 * Runs before linting (and after continuation/repair).
 * Guaranteed idempotent: running it twice returns identical HTML.
 */

import { parseScreen } from './parse';
import { stripFences } from './completeness';
import { ICON_NAMES } from '../icons/names';
import { COMPOSER_HTML, SEARCH_HTML, BOTTOM_NAV_HTML } from './templates';
import type { Role } from './roles';
import type { DesignSystem } from '../designSystem/schema';

export interface FixCtx {
  required: Role[];
  designSystem?: DesignSystem;
}

export const ALLOWED_ENTRANCE_MOTIONS = new Set(['fade-in', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'scale-in']);
export const ALLOWED_LOOP_MOTIONS = new Set(['pulse', 'float', 'glow', 'shimmer']);
export const ALLOWED_ALL_MOTIONS = new Set([...ALLOWED_ENTRANCE_MOTIONS, ...ALLOWED_LOOP_MOTIONS]);

const has = (el: Element, re: RegExp) => Array.from(el.classList).some((c) => re.test(c));
const SAFE_OVERLAYS = new Set(['badge-overlay', 'fab', 'sheet', 'dialog', 'toast']);
const isSafeOverlay = (el: Element) =>
  !!el.parentElement?.classList.contains('overlay-anchor') &&
  Array.from(el.classList).some((name) => SAFE_OVERLAYS.has(name));
const ENTRANCE = ['fade-in', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'scale-in'];
const LOOPS = ['pulse', 'float', 'glow', 'shimmer'];
const ALIASES: Record<string, string> = {
  'paper-plane': 'send',
  paperplane: 'send',
  'send-fill': 'send',
  magic: 'wand-2',
  'magic-wand': 'wand-2',
  sparkle: 'sparkles',
  chat: 'message-circle',
  comment: 'message-circle',
  gear: 'settings',
  cog: 'settings',
  person: 'user',
  back: 'arrow-left',
};

export function autofix(raw: string, ctx: FixCtx = { required: [] }): string {
  const doc = parseScreen(stripFences(raw));
  const body = doc.body;
  let root = body.firstElementChild as HTMLElement | null;

  // Ensure single .screen root
  if (!root || !root.classList.contains('screen') || body.children.length > 1) {
    const wrap = doc.createElement('div');
    wrap.className = 'screen';
    Array.from(body.childNodes).forEach((n) => wrap.appendChild(n));
    body.appendChild(wrap);
    root = wrap;
  }

  sanitize(doc);
  legacyIcons(doc);
  vocabulary(doc);
  spacing(root);
  snapOffGridSpacing(root);
  if (ctx.designSystem) {
    snapRawColors(root, ctx.designSystem);
  }
  unwrapEmptyContainers(root);
  textFill(root);
  normalizeBottomNavigation(root);
  scrollStructure(root);
  normalizeDecorativeImageLayers(root);
  normalizeAppBar(root);
  normalizeBottomActionBar(root);
  normalizeHorizontalScroll(root);
  ensureRoles(doc, root, ctx);
  nameNodes(root);

  return root.outerHTML;
}

function sanitize(doc: Document) {
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((n) => n.remove());
  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.hasAttribute('data-tz-overlay') && !isSafeOverlay(el)) {
      el.removeAttribute('data-tz-overlay');
    }
    for (const a of Array.from(el.attributes)) {
      if (a.name === 'data-image-url' && isTrustedImageUrl(a.value)) continue;
      if (a.name === 'data-image-credit-url' && isTrustedImageLink(a.value)) continue;
      if (/^on/i.test(a.name) || /javascript:|https?:\/\/|url\(|data:/i.test(a.value)) {
        el.removeAttribute(a.name);
      }
    }
    const st = el.getAttribute('style');
    if (st) {
      const kept = st
        .split(';')
        .map((s) => s.trim())
        .filter((declaration) => {
          if (!declaration || /^(margin|float|animation|transition|transform)\b/i.test(declaration)) return false;
          if (/^position\s*:\s*(absolute|fixed)/i.test(declaration) && !isSafeOverlay(el)) return false;

          // Fixed dimensions on containers are a common cause of clipped or
          // overlapping copy when generated content is longer than expected.
          if (el.children.length > 0) {
            const match = declaration.match(/^(?:width|height|min-width|max-width|min-height|max-height)\s*:\s*(\d+(?:\.\d+)?)px(?:\s*!important)?$/i);
            if (match && Number(match[1]) > 56) return false;
          }
          return true;
        });
      if (kept.length) {
        el.setAttribute('style', kept.join('; '));
      } else {
        el.removeAttribute('style');
      }
    }
  });
}

function isTrustedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isTrustedImageLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

function legacyIcons(doc: Document) {
  doc.querySelectorAll<HTMLElement>('i,svg').forEach((el) => {
    const token =
      Array.from(el.classList)
        .map((c) => c.replace(/^(fa[srb]?|bi|ph|material-icons|icon)-?/, ''))
        .filter(Boolean)
        .pop() ?? '';
    const name = ALIASES[token] ?? token;
    const span = doc.createElement('span');
    span.className = 'icon hug';
    span.setAttribute('data-icon', (ICON_NAMES as readonly string[]).includes(name) ? name : 'circle');
    el.replaceWith(span);
  });

  doc.querySelectorAll<HTMLElement>('img').forEach((el) => {
    const alt = el.getAttribute('alt') ?? 'image';
    const d = doc.createElement('div');
    d.className = 'img';
    d.setAttribute('data-img', alt.toLowerCase().replace(/\W+/g, '-').slice(0, 30) || 'image');
    d.setAttribute('data-alt', alt);
    d.setAttribute('data-ratio', '1:1');
    el.replaceWith(d);
  });
}

function vocabulary(doc: Document) {
  doc.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const n = ALIASES[el.dataset.icon!] ?? el.dataset.icon!;
    el.setAttribute('data-icon', (ICON_NAMES as readonly string[]).includes(n) ? n : 'circle');
    if (!el.classList.contains('icon')) el.classList.add('icon');
  });

  doc.querySelectorAll<HTMLElement>('[data-motion]').forEach((el) => {
    if (![...ENTRANCE, ...LOOPS].includes(el.dataset.motion!)) el.removeAttribute('data-motion');
  });

  doc.querySelectorAll<HTMLElement>('[data-stagger]').forEach((el) => {
    if (!ENTRANCE.includes(el.dataset.stagger!)) el.removeAttribute('data-stagger');
  });

  doc.querySelectorAll<HTMLElement>('[data-delay]').forEach((el) => {
    el.setAttribute('data-delay', String(Math.max(0, Math.min(8, parseInt(el.dataset.delay!) || 0))));
  });

  // Cap looping motions at 3 per screen
  Array.from(doc.querySelectorAll<HTMLElement>('[data-motion]'))
    .filter((e) => LOOPS.includes(e.dataset.motion!))
    .slice(3)
    .forEach((e) => e.removeAttribute('data-motion'));
}

function spacing(root: HTMLElement) {
  // Gaps: every .row, and every multi-child .col (except the screen root, whose regions stay flush)
  root.querySelectorAll<HTMLElement>('.row,.col').forEach((el) => {
    if (el === root) return;
    if (el.children.length > 1 && !has(el, /^gap-\d$/)) el.classList.add('gap-2');
  });

  // Page padding on the screen's direct children
  Array.from(root.children).forEach((c) => {
    if (c.classList.contains('fab')) return;
    if (c.hasAttribute('data-bleed')) return;
    const hasP = has(c, /^p-\d$/);
    const hasPx = hasP || has(c, /^px-\d$/);
    const hasPy = hasP || has(c, /^py-\d$/);
    if (!hasPx) c.classList.add('px-4');
    if (!hasPy) c.classList.add('py-3');
  });
}

const NON_GRID_PROPS = new Set([
  'border-radius', 'font-size', 'line-height', 'letter-spacing',
  'opacity', 'border-width', 'border', 'flex-grow', 'flex-shrink', 'z-index',
]);

function snapOffGridSpacing(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const st = el.getAttribute('style');
    if (!st) return;
    const decls = st.split(';').map((s) => s.trim()).filter(Boolean);
    let changed = false;
    const newDecls = decls.map((decl) => {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) return decl;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const val = decl.slice(colonIdx + 1).trim();
      if (NON_GRID_PROPS.has(prop)) return decl;
      const replaced = val.replace(/(\d+(?:\.\d+)?)px/g, (match, numStr) => {
        const num = parseFloat(numStr);
        if (num === 1 || isNaN(num) || num % 4 === 0) return match;
        changed = true;
        return `${Math.round(num / 4) * 4}px`;
      });
      return `${prop}: ${replaced}`;
    });
    if (changed) {
      el.setAttribute('style', newDecls.join('; '));
    }
  });
}

function parseHex(h: string): [number, number, number] | null {
  const clean = h.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function findNearestColorToken(hex: string, colors: Record<string, string>): string {
  const targetRgb = parseHex(hex);
  if (!targetRgb) return hex;
  let bestDist = Infinity;
  let bestToken = 'background';
  for (const [name, colorHex] of Object.entries(colors)) {
    const rgb = parseHex(colorHex);
    if (!rgb) continue;
    const dist = (targetRgb[0] - rgb[0]) ** 2 + (targetRgb[1] - rgb[1]) ** 2 + (targetRgb[2] - rgb[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestToken = name.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
    }
  }
  return `var(--c-${bestToken})`;
}

function snapRawColors(root: HTMLElement, ds: DesignSystem) {
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const st = el.getAttribute('style');
    if (!st) return;
    const replaced = st.replace(/#(?:[0-9a-fA-F]{3}){1,2}\b/g, (hexMatch) => {
      return findNearestColorToken(hexMatch, ds.colors as Record<string, string>);
    });
    if (replaced !== st) {
      el.setAttribute('style', replaced);
    }
  });
}

function unwrapEmptyContainers(root: HTMLElement) {
  for (let pass = 0; pass < 3; pass++) {
    let unwrapOccurred = false;
    const divs = Array.from(root.querySelectorAll<HTMLElement>('div'));
    for (const div of divs) {
      if (div === root) continue;
      // Skip if has semantic markers or attributes
      if (
        div.hasAttribute('data-tz-id') ||
        div.hasAttribute('data-role') ||
        div.hasAttribute('data-section') ||
        div.hasAttribute('data-component') ||
        div.hasAttribute('style') ||
        div.id
      ) {
        continue;
      }
      // Check if div has no class or only empty class
      const cls = (div.getAttribute('class') ?? '').trim();
      if (cls !== '') continue;

      // Only unwrap if exactly one child element and no text nodes outside
      if (div.children.length === 1 && (div.textContent?.trim() === (div.firstElementChild as HTMLElement)?.textContent?.trim())) {
        const child = div.firstElementChild as HTMLElement;
        div.replaceWith(child);
        unwrapOccurred = true;
      }
    }
    if (!unwrapOccurred) break;
  }
}

function textFill(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.row').forEach((row) => {
    const kids = Array.from(row.children) as HTMLElement[];
    if (kids.length < 2) return;
    const anyHug = kids.some((k) => k.classList.contains('hug') || k.matches('.icon,.avatar,.icon-btn'));
    kids.forEach((k) => {
      if (k.classList.contains('hug') || k.classList.contains('fill')) return;
      if (k.matches('.icon,.avatar,.icon-btn')) {
        k.classList.add('hug');
        return;
      }
      if (k.matches('.field,input,textarea')) {
        k.classList.add('fill');
        return;
      }
      if (anyHug && (k.textContent ?? '').trim()) k.classList.add('fill');
    });
  });
}

function normalizeBottomNavigation(root: HTMLElement) {
  const directTabs = (container: HTMLElement) => Array.from(container.children)
    .filter((child) => child.matches('.nav-item,[role="tab"],button,a')) as HTMLElement[];
  let nav = root.querySelector<HTMLElement>(':scope > [data-role="bottom-nav"], :scope > nav, :scope > [role="tablist"], :scope > footer');
  if (nav && (directTabs(nav).length < 3 || directTabs(nav).length > 5)) nav = null;

  if (!nav) {
    for (const item of Array.from(root.querySelectorAll<HTMLElement>('.nav-item,[role="tab"]'))) {
      let parent = item.parentElement;
      while (parent && parent !== root) {
        const tabs = directTabs(parent);
        if (tabs.length >= 3 && tabs.length <= 5 && tabs.every((tab) => tab.matches('.nav-item,[role="tab"]'))) {
          nav = parent;
          break;
        }
        parent = parent.parentElement;
      }
      if (nav) break;
    }
  }

  if (!nav) return;
  const tabs = directTabs(nav);
  if (tabs.length < 3 || tabs.length > 5) return;

  nav.setAttribute('data-role', 'bottom-nav');
  nav.classList.remove('col', 'scroll', 'fill');
  nav.classList.add('row', 'hug', 'px-2', 'py-2', 'gap-1');
  tabs.forEach((tab) => {
    tab.classList.add('nav-item', 'fill');
    tab.classList.remove('row');
  });
}

function scrollStructure(root: HTMLElement) {
  let scroll = root.querySelector<HTMLElement>(':scope > .scroll');

  // A nested scroll area does not satisfy the screen contract and can leave
  // the whole canvas unscrollable. Promote its direct screen region instead.
  if (!scroll) {
    const list = root.querySelector<HTMLElement>(':scope > [data-role="message-list"], :scope > [data-role="item-list"]');
    const directContent = Array.from(root.children)
      .filter((child) => !child.matches('header,[data-role="app-bar"],[data-role="composer"],[data-role="bottom-nav"],nav,[data-role="footer"]'))
      .sort((a, b) => b.querySelectorAll('*').length - a.querySelectorAll('*').length)[0] as HTMLElement | undefined;
    scroll = list ?? directContent ?? null;

    if (!scroll) {
      scroll = root.ownerDocument.createElement('div');
      scroll.className = 'col gap-3 px-4 py-3';
      scroll.setAttribute('data-role', 'screen-body');
      const firstFooter = root.querySelector(':scope > [data-role="composer"], :scope > [data-role="bottom-nav"], :scope > nav');
      root.insertBefore(scroll, firstFooter);
    }

    scroll.classList.add('scroll');
  }

  // Keep one page-level scrolling region. Inner lists remain in normal flow
  // so the phone viewport, rather than a nested panel, owns vertical scrolling.
  scroll.querySelectorAll<HTMLElement>('.scroll').forEach((nested) => nested.classList.remove('scroll'));

  root.querySelectorAll('[data-role="composer"],[data-role="bottom-nav"]').forEach((el) => {
    if (scroll && scroll !== el && scroll.contains(el)) {
      root.appendChild(el); // Footer must be outside .scroll
    }
  });

  root.querySelectorAll<HTMLElement>('.scroll .fab').forEach((fab) => root.appendChild(fab));

  // Keep footers last: nav is always last
  const nav = root.querySelector(':scope > [data-role="bottom-nav"]');
  if (nav) root.appendChild(nav);
}

function normalizeAppBar(root: HTMLElement) {
  let appBar = root.querySelector<HTMLElement>(':scope > header, :scope > [data-role="app-bar"]');

  // Generated screens sometimes omit the semantic role from a top row. Recover
  // it from the row immediately before the page scroll region so the renderer
  // can guarantee full-width app-bar sizing without changing body content.
  if (!appBar) {
    const scroll = root.querySelector(':scope > .scroll');
    const beforeScroll = Array.from(root.children).slice(0, scroll ? Array.from(root.children).indexOf(scroll) : 2);
    appBar = beforeScroll.find((child): child is HTMLElement => {
      if (child.nodeType !== 1) return false;
      const element = child as HTMLElement;
      if (!element.classList.contains('row')) return false;
      if (element.children.length < 2 || element.matches('[data-role="bottom-nav"], nav, footer')) return false;
      return !!element.querySelector('button,a,[data-icon]') || /\b(skip|back|search|settings)\b/i.test(element.textContent ?? '');
    }) ?? [...beforeScroll].reverse().find((child): child is HTMLElement =>
      child.nodeType === 1
      && (child as HTMLElement).classList.contains('row')
      && !child.matches('[data-role="bottom-nav"], nav, footer')
      && !!(child.textContent ?? '').trim(),
    ) ?? null;
  }

  if (!appBar) return;
  appBar.setAttribute('data-role', 'app-bar');
  appBar.classList.add('row', 'between', 'w-full');
  if (appBar.children.length > 1) {
    const flexibleLead = Array.from(appBar.children).find((child) => child.classList.contains('fill'));
    flexibleLead?.classList.remove('center');
  }
}

function normalizeDecorativeImageLayers(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[style]').forEach((layer) => {
    const style = layer.getAttribute('style') ?? '';
    const looksLikeUnpositionedBackdrop = /\binset\s*:/i.test(style)
      && /\bz-index\s*:\s*-\d+/i.test(style)
      && !/\bposition\s*:\s*(absolute|fixed)\b/i.test(style)
      && !!layer.querySelector('.img[data-img]')
      && !layer.querySelector('button,a,input,[data-role]');
    if (looksLikeUnpositionedBackdrop) layer.remove();
  });
}

function normalizeBottomActionBar(root: HTMLElement) {
  const children = Array.from(root.children) as HTMLElement[];
  const scrollIndex = children.findIndex((child) => child.classList.contains('scroll'));
  if (scrollIndex < 0) return;

  const footer = children.slice(scrollIndex + 1).find((child) => {
    if (child.matches('nav,[data-role="bottom-nav"]')) return false;
    const hasPrimaryAction = child.matches('[data-role="primary-cta"],.btn-primary,button')
      || !!child.querySelector('[data-role="primary-cta"],.btn-primary,button');
    const footerLike = child.matches('footer,[data-role="footer"],.footer,.bottom-bar')
      || child.classList.contains('hug')
      || /border-top\s*:/i.test(child.getAttribute('style') ?? '');
    return hasPrimaryAction && footerLike;
  });
  if (!footer) return;

  // A footer is a screen region, not a content-sized item. Generated `.hug`
  // on its wrapper otherwise constrains the background and action area to the
  // button's intrinsic width.
  footer.setAttribute('data-role', 'footer');
  footer.classList.remove('hug');
  footer.classList.add('w-full');
}

function normalizeHorizontalScroll(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.row,.scroll-x').forEach((scroller) => {
    const style = scroller.getAttribute('style') ?? '';
    const permitsHorizontalScroll = scroller.classList.contains('scroll-x')
      || /\boverflow-x\s*:\s*(auto|scroll)\b/i.test(style)
      || /\bscroll-snap-type\s*:\s*x\b/i.test(style);
    if (!permitsHorizontalScroll) return;

    scroller.classList.add('scroll-x');
    if (/\bscroll-snap-type\s*:\s*x\b/i.test(style)) {
      scroller.querySelectorAll<HTMLElement>(':scope > .card').forEach((card) => {
        card.classList.add('carousel-item');
        card.querySelectorAll<HTMLElement>(':scope > .col.fill').forEach((content) => {
          content.classList.remove('fill');
        });
      });
    }
  });
}

function inject(doc: Document, root: HTMLElement, html: string, beforeNav = false) {
  const t = doc.createElement('div');
  t.innerHTML = html.trim();
  const el = t.firstElementChild!;
  const nav = root.querySelector(':scope > [data-role="bottom-nav"]');
  if (beforeNav && nav) {
    root.insertBefore(el, nav);
  } else {
    root.appendChild(el);
  }
}

function ensureRoles(doc: Document, root: HTMLElement, ctx: FixCtx) {
  const hasRole = (r: string) => !!root.querySelector(`[data-role="${r}"]`);
  const req = (r: Role) => ctx.required.includes(r);

  // 1) Tag existing-but-untagged controls
  if (req('composer-input') && !hasRole('composer-input')) {
    const f = root.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio]),textarea');
    if (f) {
      f.setAttribute('data-role', 'composer-input');
      f.classList.add('field', 'fill');
    }
  }

  if (req('send-button') && !hasRole('send-button')) {
    const input = root.querySelector('[data-role="composer-input"]');
    const btn = input?.parentElement?.querySelector('button');
    if (btn) {
      btn.setAttribute('data-role', 'send-button');
      btn.classList.add('icon-btn', 'hug');
    }
  }

  // 2) Input exists but button doesn't -> add button beside it
  if (req('send-button') && !hasRole('send-button') && hasRole('composer-input')) {
    const parent = root.querySelector('[data-role="composer-input"]')!.parentElement!;
    const t = doc.createElement('div');
    t.innerHTML = COMPOSER_HTML;
    const sendBtn = t.querySelector('[data-role="send-button"]');
    if (sendBtn) parent.appendChild(sendBtn);
  }

  // 3) Nothing there -> inject whole composer
  if ((req('composer-input') || req('send-button')) && !hasRole('composer-input')) {
    inject(doc, root, COMPOSER_HTML, true);
  }

  if (req('composer') && !hasRole('composer')) {
    root.querySelector('[data-role="composer-input"]')?.parentElement?.setAttribute('data-role', 'composer');
  }

  if (req('search-field') && !hasRole('search-field')) {
    inject(doc, root, SEARCH_HTML);
  }

  if (req('bottom-nav') && !hasRole('bottom-nav')) {
    inject(doc, root, BOTTOM_NAV_HTML);
  }
}

const UTIL = /^(row|col|fill|hug|scroll|center|between|wrap|card|icon|avatar|img|text-|muted|gap-|p-|px-|py-|self-|nowrap|clamp-|field|icon-btn|bubble|chip|btn|nav-)/;

function nameNodes(root: HTMLElement) {
  let n = 0;
  const seen = new Set<string>();
  const pascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());

  [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].forEach((el) => {
    let id = el.getAttribute('data-tz-id');
    if (!id || seen.has(id)) {
      do id = `n${++n}`;
      while (seen.has(id));
      el.setAttribute('data-tz-id', id);
    }
    seen.add(id);

    if (!el.getAttribute('data-tz-name')) {
      const cls = Array.from(el.classList).find((c) => !UTIL.test(c));
      el.setAttribute('data-tz-name', pascal(el.getAttribute('data-role') ?? cls ?? el.tagName.toLowerCase()));
    }
  });
}
