/**
 * TezMind HTML Hydrator (v2)
 *
 * Idempotent hydration of model-generated HTML:
 * 1. Icons  — inserts inline SVG for data-icon attributes
 * 2. Avatars — renders initials with deterministic colors
 * 3. Images  — renders gradient placeholder seeded by slug + palette
 * 4. Motion stagger — distributes data-motion + --i index to children
 *
 * Browser-only (uses DOM APIs). Safe to call on partial HTML during streaming.
 * Idempotent via data-h="1" sentinel on already-hydrated elements.
 *
 * PURE TYPESCRIPT — no host-specific imports beyond DOM.
 */

import { iconSvg, resolveIconName } from '../icons';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Palette {
  primary: string;
  background: string;
  surface: string;
  text: string;
  border: string;
}

export const DEFAULT_PALETTE: Palette = {
  primary: '#6C5CE7',
  background: '#FFFFFF',
  surface: '#F7F7F8',
  text: '#202123',
  border: '#E5E7EB',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate up to 2-letter initials from a full name string */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Simple djb2-like hash of a string → integer */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h);
}

function hexToHsl(hex: string): [number, number, number] | null {
  const match = hex.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  const raw = match[1].length === 3 ? match[1].split('').map((char) => char + char).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, saturation, lightness];
}

/**
 * Deterministic avatar background + foreground colors derived from name hash
 * and the current palette. Returns CSS color strings.
 */
export function avatarColors(
  name: string,
  palette: Palette,
): { bg: string; fg: string } {
  const idx = hashStr(name);
  const [baseHue, baseSaturation] = hexToHsl(palette.primary) ?? [258, 0.55, 0.5];
  const pageIsLight = isLightHex(palette.background);
  const hueOffset = ((idx % 5) - 2) * 9;
  const hue = (baseHue + hueOffset + 360) % 360;
  const saturation = baseSaturation < 0.08 ? 0.08 : Math.min(0.56, Math.max(0.3, baseSaturation));
  const lightness = pageIsLight ? 88 - (idx % 3) * 4 : 43 + (idx % 3) * 5;
  return {
    bg: `hsl(${Math.round(hue)} ${Math.round(saturation * 100)}% ${lightness}%)`,
    fg: pageIsLight ? (palette.text || '#202123') : '#FFFFFF',
  };
}

function isLightHex(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return hsl ? hsl[2] > 0.55 : true;
}

/**
 * Deterministic gradient background for image placeholders.
 * Seeded by slug + palette primary color.
 */
export function placeholderGradient(slug: string, palette: Palette): string {
  const h = hashStr(slug);
  const [baseHue, baseSaturation] = hexToHsl(palette.primary) ?? [258, 0.55, 0.5];
  const pageIsLight = isLightHex(palette.background);
  const hue1 = (baseHue + (h % 44) - 22 + 360) % 360;
  const hue2 = (hue1 + 18) % 360;
  const saturation = Math.round(Math.max(24, Math.min(52, baseSaturation * 100)));
  const l1 = pageIsLight ? 88 - (h % 8) : 18 + (h % 9);
  const l2 = pageIsLight ? 82 - ((h >> 4) % 8) : 25 + ((h >> 4) % 9);
  return `linear-gradient(135deg, hsl(${Math.round(hue1)},${saturation}%,${l1}%), hsl(${Math.round(hue2)},${saturation}%,${l2}%))`;
}

/** Faint image glyph SVG for placeholder slots */
export function placeholderGlyph(alt: string): string {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:32px;height:32px;opacity:0.25;stroke:#fff;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M21 15l-5-5-4 4-3-2-5 4"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
  </svg>`;
}

// ── Main hydrator ─────────────────────────────────────────────────────────────

export interface HydrateOptions {
  palette?: Palette;
  materialDesign3?: boolean;
}

/**
 * Hydrate a DOM subtree in-place.
 * Safe to call multiple times — already-hydrated nodes have data-h="1" and are skipped.
 * Safe on partial HTML during streaming — incomplete elements are simply missed this pass.
 */
export function hydrate(
  root: HTMLElement,
  opts: HydrateOptions = {},
): void {
  const palette = { ...DEFAULT_PALETTE, ...(opts.palette ?? {}) };

  if (opts.materialDesign3) hydrateMaterialControls(root);

  // 1. Icons ─────────────────────────────────────────────────────────────────
  root.querySelectorAll<HTMLElement>('[data-icon]:not([data-h])').forEach((el) => {
    const name = resolveIconName(el.dataset.icon ?? '');
    const size = snapIconSize(Number(el.dataset.size ?? 20));
    el.style.setProperty('--sz', `${size}px`);
    el.innerHTML = iconSvg(name, size);
    el.dataset.h = '1';
  });

  // 2. Avatars (initials + deterministic color) ───────────────────────────────
  root.querySelectorAll<HTMLElement>('.avatar[data-name]:not([data-h])').forEach((el) => {
    const name = el.dataset.name ?? '';
    const size = Number(el.dataset.size ?? 40);
    const { bg, fg } = avatarColors(name, palette);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = bg;
    el.style.color = fg;
    el.style.fontSize = `${Math.round(size * 0.38)}px`;
    el.textContent = initials(name);
    el.dataset.h = '1';
  });

  // 3. Image placeholders ────────────────────────────────────────────────────
  root.querySelectorAll<HTMLElement>('.img[data-img]:not([data-h])').forEach((el) => {
    const ratioStr = el.dataset.ratio ?? '16:9';
    const [w, h] = ratioStr.split(':').map(Number);
    if (w && h) {
      el.style.aspectRatio = `${w} / ${h}`;
    }
    const imageUrl = safeUnsplashImageUrl(el.dataset.imageUrl ?? '');
    if (imageUrl) {
      el.style.background = `center / cover no-repeat url("${imageUrl}")`;
      el.replaceChildren();
      const creditUrl = safeUnsplashLink(el.dataset.imageCreditUrl ?? '');
      if (creditUrl) {
        const credit = el.ownerDocument.createElement('a');
        credit.className = 'img-credit';
        credit.dataset.imgCredit = 'true';
        credit.href = creditUrl;
        credit.target = '_blank';
        credit.rel = 'noopener noreferrer';
        const photographer = (el.dataset.imageCredit ?? 'Unsplash photographer').slice(0, 80);
        credit.setAttribute('aria-label', `Photo by ${photographer} on Unsplash`);
        credit.textContent = `Photo by ${photographer} · Unsplash`;
        el.appendChild(credit);
      }
    } else {
      el.style.background = placeholderGradient(el.dataset.img ?? '', palette);
      el.innerHTML = placeholderGlyph(el.dataset.alt ?? '');
    }
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', el.dataset.alt ?? '');
    el.dataset.h = '1';
  });

  // 4. Motion stagger ────────────────────────────────────────────────────────
  // data-stagger="fade-up" on a container → set data-motion + --i on each direct child
  root.querySelectorAll<HTMLElement>('[data-stagger]:not([data-h])').forEach((container) => {
    const kind = container.dataset.stagger!;
    const children = Array.from(container.children) as HTMLElement[];
    children.slice(0, 9).forEach((child, i) => {
      // Don't overwrite a more specific data-motion already set by model
      if (!child.dataset.motion) {
        child.dataset.motion = kind;
      }
      child.style.setProperty('--i', String(i));
    });
    container.dataset.h = '1';
  });

  // 5. data-delay clamping ───────────────────────────────────────────────────
  root.querySelectorAll<HTMLElement>('[data-delay]').forEach((el) => {
    const d = Math.min(8, Math.max(0, Number(el.dataset.delay) || 0));
    el.style.setProperty('--d', String(d));
  });
}

function safeUnsplashImageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'images.unsplash.com' ? url.href : null;
  } catch {
    return null;
  }
}

function safeUnsplashLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)unsplash\.com$/i.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/** Replace generated semantic controls with the actual Material Web elements. */
function hydrateMaterialControls(root: HTMLElement): void {
  const replace = (source: HTMLElement, tagName: string, omittedClasses: Set<string> = new Set(), moveChildren = true) => {
    const element = root.ownerDocument.createElement(tagName);
    for (const attribute of Array.from(source.attributes)) {
      if (attribute.name === 'class' || attribute.name === 'data-h') continue;
      element.setAttribute(attribute.name, attribute.value);
    }
    const classes = Array.from(source.classList).filter((name) => !omittedClasses.has(name));
    if (classes.length) element.className = classes.join(' ');
    if (source.hasAttribute('style')) element.setAttribute('style', source.getAttribute('style') || '');
    if (moveChildren) element.append(...Array.from(source.childNodes));
    element.setAttribute('data-m3-control', 'true');
    source.replaceWith(element);
    return element;
  };

  root.querySelectorAll<HTMLButtonElement>('button:not([data-m3-control])').forEach((button) => {
    const classes = new Set(Array.from(button.classList));
    const isIconOnly = classes.has('icon-btn') && !button.textContent?.trim();
    const requestedVariant = button.getAttribute('data-variant') || button.getAttribute('variant');
    const variant = requestedVariant === 'outlined' || classes.has('btn-secondary') ? 'md-outlined-button'
      : requestedVariant === 'tonal' || classes.has('btn-tonal') ? 'md-filled-tonal-button'
      : requestedVariant === 'icon' || isIconOnly ? 'md-icon-button'
      : requestedVariant === 'filled' || classes.has('btn-primary') ? 'md-filled-button'
      : 'md-text-button';
    replace(button, variant, new Set(['btn-primary', 'btn-secondary', 'btn-tonal', 'btn-text', 'icon-btn']));
  });

  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([data-m3-control]), textarea:not([data-m3-control])').forEach((control) => {
    const inputType = control.getAttribute('type')?.toLowerCase();
    if (control.tagName === 'INPUT' && inputType === 'checkbox') {
      const switchControl = control.getAttribute('role') === 'switch';
      replace(control, switchControl ? 'md-switch' : 'md-checkbox', new Set(['field', 'fill', 'hug']), false);
      return;
    }
    if (control.tagName === 'INPUT' && inputType === 'radio') {
      replace(control, 'md-radio', new Set(['field', 'fill', 'hug']), false);
      return;
    }
    if (control.tagName === 'INPUT' && inputType && !['email', 'number', 'password', 'search', 'tel', 'text', 'url'].includes(inputType)) return;
    const field = replace(control, 'md-outlined-text-field', new Set(['field']), false);
    if (control.tagName === 'TEXTAREA') {
      field.setAttribute('type', 'textarea');
      if (control.value) field.setAttribute('value', control.value);
    }
    if (!field.hasAttribute('label') && control.getAttribute('aria-label')) {
      field.setAttribute('label', control.getAttribute('aria-label')!);
    }
  });
}

/** Snap icon size to nearest allowed value: 16, 20, 24, 32 */
function snapIconSize(size: number): 16 | 20 | 24 | 32 {
  if (size <= 18) return 16;
  if (size <= 22) return 20;
  if (size <= 28) return 24;
  return 32;
}
