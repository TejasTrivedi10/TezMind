/**
 * TezDSL HTML Subset — Single Source of Truth
 *
 * Defines the contract for:
 * - System prompt instructions
 * - HTML Sanitizer whitelist
 * - HTML -> TezDSL Converter
 * - TezDSL -> HTML Exporter
 */

export const ALLOWED_TAGS = [
  'div',
  'section',
  'main',
  'nav',
  'ul',
  'li',
  'article',
  'aside',
  'header',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'label',
  'button',
  'a',
  'input',
  'textarea',
  'img',
  'hr',
  'i',
] as const;

export const ALLOWED_ATTRIBUTES = [
  'data-tz-screen',
  'data-tz-id',
  'data-tz-name',
  'data-tz-type',
  'data-tz-overlay',
  'data-icon',
  'style',
  'placeholder',
  'type',
  'alt',
  'href',
] as const;

export const ALLOWED_STYLE_PROPERTIES = [
  'display',
  'flex-direction',
  'gap',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'justify-content',
  'align-items',
  'align-self',
  'flex-wrap',
  'flex',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'aspect-ratio',
  'overflow-y',
  'overflow-x',
  'overflow',
  'background-color',
  'color',
  'border-radius',
  'border',
  'border-width',
  'border-color',
  'opacity',
  'box-shadow',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'text-align',
  'letter-spacing',
  'position',
  'top',
  'right',
  'bottom',
  'left',
] as const;

/** Map HTML tag / data-tz-type to TezDSL NodeType */
export function getDslNodeType(tagName: string, tzType?: string): string {
  if (tzType && tzType.trim()) {
    return tzType.trim().toLowerCase();
  }
  const tag = tagName.toLowerCase();
  switch (tag) {
    case 'header':
      return 'header';
    case 'footer':
      return 'footer';
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'p':
    case 'span':
    case 'label':
      return 'text';
    case 'button':
    case 'a':
      return 'button';
    case 'input':
    case 'textarea':
      return 'input';
    case 'img':
      return 'image';
    case 'hr':
      return 'divider';
    case 'i':
      return 'icon';
    default:
      return 'frame';
  }
}
