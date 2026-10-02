import type { Screen, DesignNode, StyleSpec, Layout, Sizing, Color } from '../dsl';
import { CURRENT_SCHEMA_VERSION } from '../dsl';
import { getDslNodeType, ALLOWED_STYLE_PROPERTIES } from './subset';

export interface HtmlToDslResult {
  screens: Screen[];
  errors: string[];
}

/**
 * Parse inline style string into key-value map of allowed CSS properties
 */
export function parseInlineStyle(styleStr: string | null | undefined): Record<string, string> {
  if (!styleStr) return {};
  const result: Record<string, string> = {};
  const entries = styleStr.split(';');

  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) continue;
    const rawProp = entry.slice(0, colonIdx).trim().toLowerCase();
    const rawVal = entry.slice(colonIdx + 1).trim();

    if (!rawProp || !rawVal) continue;
    if ((ALLOWED_STYLE_PROPERTIES as readonly string[]).includes(rawProp)) {
      result[rawProp] = rawVal;
    }
  }
  return result;
}

/**
 * Convert pixel string (e.g. "16px", "16") to number
 */
function parsePxNumber(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const num = parseFloat(val.replace('px', '').trim());
  return isNaN(num) ? undefined : num;
}

/**
 * Simple browser-safe HTML node interface for DOM / Regex / Fragment parsing
 */
interface SimpleHtmlNode {
  tagName: string;
  attributes: Record<string, string>;
  styleMap: Record<string, string>;
  textContent: string;
  children: SimpleHtmlNode[];
}

/**
 * Lightweight HTML fragment parser working in node & browser without external native dependencies
 */
function parseHtmlFragment(html: string): SimpleHtmlNode[] {
  // If DOMParser is available (browser context)
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
      return domToSimpleNodes(doc.body.firstElementChild || doc.body);
    } catch { /* fallback to regex parser */ }
  }
  return regexParseHtml(html);
}

function domToSimpleNodes(element: Element): SimpleHtmlNode[] {
  const nodes: SimpleHtmlNode[] = [];
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    const attrs: Record<string, string> = {};
    for (let j = 0; j < child.attributes.length; j++) {
      const attr = child.attributes[j];
      attrs[attr.name] = attr.value;
    }
    nodes.push({
      tagName: child.tagName.toLowerCase(),
      attributes: attrs,
      styleMap: parseInlineStyle(attrs.style),
      textContent: (child.textContent || '').trim(),
      children: domToSimpleNodes(child),
    });
  }
  return nodes;
}

/**
 * Fallback regex-based HTML fragment parser for Node / non-DOM environments
 */
function regexParseHtml(rawHtml: string): SimpleHtmlNode[] {
  const nodes: SimpleHtmlNode[] = [];
  // Clean comments
  const cleaned = rawHtml.replace(/<!--[\s\S]*?-->/g, '');

  const tagRegex = /<([a-zA-Z0-9-]+)\s*([^>]*)>([\s\S]*?)<\/ \1>|<([a-zA-Z0-9-]+)\s*([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  let nodeCount = 1;

  // Extract top-level tag blocks
  const rootDivRegex = /<([a-zA-Z0-9-]+)\s*([^>]*)>/gi;
  let attrMatch: RegExpExecArray | null;

  while ((attrMatch = rootDivRegex.exec(cleaned)) !== null) {
    const tagName = attrMatch[1].toLowerCase();
    const rawAttrs = attrMatch[2];

    const attributes: Record<string, string> = {};
    const attrRegex = /([a-zA-Z0-9-:]+)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(rawAttrs)) !== null) {
      attributes[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
    }

    nodes.push({
      tagName,
      attributes,
      styleMap: parseInlineStyle(attributes.style),
      textContent: '',
      children: [],
    });
  }

  return nodes;
}

/**
 * Extract TezDSL StyleSpec from HTML inline style map
 */
function extractStyleSpec(styleMap: Record<string, string>): StyleSpec {
  const style: StyleSpec = {};

  if (styleMap['background-color']) style.backgroundColor = styleMap['background-color'] as Color;
  if (styleMap['color']) style.color = styleMap['color'] as Color;

  const br = parsePxNumber(styleMap['border-radius']);
  if (br !== undefined) style.borderRadius = br;

  const bw = parsePxNumber(styleMap['border-width']);
  if (bw !== undefined) style.borderWidth = bw;
  if (styleMap['border-color']) style.borderColor = styleMap['border-color'] as Color;

  const op = parseFloat(styleMap['opacity']);
  if (!isNaN(op)) style.opacity = op;

  const fs = parsePxNumber(styleMap['font-size']);
  if (fs !== undefined) style.fontSize = fs;

  if (styleMap['font-weight']) {
    const fw = styleMap['font-weight'].trim();
    style.fontWeight = fw as any;
  }

  if (styleMap['font-family']) style.fontFamily = styleMap['font-family'];

  const lh = parseFloat(styleMap['line-height']);
  if (!isNaN(lh)) style.lineHeight = lh;

  if (styleMap['text-align'] && ['left', 'center', 'right', 'justify'].includes(styleMap['text-align'])) {
    style.textAlign = styleMap['text-align'] as any;
  }

  const overflow = styleMap['overflow-y'] || styleMap['overflow'] || styleMap['overflow-x'];
  if (overflow) {
    if (overflow === 'hidden' || overflow === 'visible' || overflow === 'scroll' || overflow === 'auto' || overflow === 'ellipsis') {
      style.overflow = overflow === 'ellipsis' ? 'hidden' : overflow as any;
    }
  }

  return style;
}

/**
 * Extract TezDSL Sizing from HTML style map
 */
function extractSizing(styleMap: Record<string, string>): Sizing {
  const widthStr = styleMap['width'];
  const heightStr = styleMap['height'];
  const flexStr = styleMap['flex'];
  const alignSelf = styleMap['align-self'];

  let width: Sizing['width'] = { mode: 'hug' };
  let height: Sizing['height'] = { mode: 'hug' };

  // Flex fill main axis
  if (flexStr) {
    const flexVal = parseFloat(flexStr);
    if (!isNaN(flexVal) && flexVal > 0) {
      width = { mode: 'fill', flex: flexVal };
    }
  } else if (alignSelf === 'stretch' || widthStr === '100%') {
    width = { mode: 'fill' };
  } else if (widthStr) {
    const px = parsePxNumber(widthStr);
    if (px !== undefined) {
      width = { mode: 'fixed', value: px };
    }
  }

  if (heightStr === '100%') {
    height = { mode: 'fill' };
  } else if (heightStr) {
    const px = parsePxNumber(heightStr);
    if (px !== undefined) {
      height = { mode: 'fixed', value: px };
    }
  }

  return { width, height };
}

/**
 * Extract TezDSL Layout from HTML style map for container nodes
 */
function extractLayout(styleMap: Record<string, string>): Layout {
  const dir = styleMap['flex-direction'] === 'row' ? 'row' : 'column';
  const gap = parsePxNumber(styleMap['gap']) ?? 8;

  const pt = parsePxNumber(styleMap['padding-top']) ?? parsePxNumber(styleMap['padding']) ?? 0;
  const pr = parsePxNumber(styleMap['padding-right']) ?? parsePxNumber(styleMap['padding']) ?? 0;
  const pb = parsePxNumber(styleMap['padding-bottom']) ?? parsePxNumber(styleMap['padding']) ?? 0;
  const pl = parsePxNumber(styleMap['padding-left']) ?? parsePxNumber(styleMap['padding']) ?? 0;

  const jc = styleMap['justify-content'];
  let mainAxis: Layout['mainAxis'] = 'start';
  if (jc === 'center') mainAxis = 'center';
  else if (jc === 'flex-end' || jc === 'end') mainAxis = 'end';
  else if (jc === 'space-between') mainAxis = 'spaceBetween';
  else if (jc === 'space-around') mainAxis = 'spaceAround';
  else if (jc === 'space-evenly') mainAxis = 'spaceEvenly';

  const ai = styleMap['align-items'];
  let crossAxis: Layout['crossAxis'] = 'stretch';
  if (ai === 'flex-start' || ai === 'start') crossAxis = 'start';
  else if (ai === 'center') crossAxis = 'center';
  else if (ai === 'flex-end' || ai === 'end') crossAxis = 'end';
  else if (ai === 'baseline') crossAxis = 'baseline';

  const wrap = styleMap['flex-wrap'] === 'wrap';
  const scrollY = styleMap['overflow-y'] === 'auto' || styleMap['overflow-y'] === 'scroll';
  const scrollX = styleMap['overflow-x'] === 'auto' || styleMap['overflow-x'] === 'scroll';

  return {
    direction: dir,
    gap,
    padding: { top: pt, right: pr, bottom: pb, left: pl },
    mainAxis,
    crossAxis,
    wrap: wrap ? true : undefined,
    scroll: scrollY ? 'vertical' : scrollX ? 'horizontal' : 'none',
  };
}

/**
 * Convert HTML subset string to TezDSL Screen array
 */
export function htmlToDsl(html: string, options?: { width?: number; height?: number; projectName?: string }): HtmlToDslResult {
  const errors: string[] = [];
  const width = options?.width ?? 393;
  const height = options?.height ?? 852;

  // Split multi-screen comments <!--TZ-SCREEN name="Screen Name"-->
  const screenBlocks = html.split(/<!--\s*TZ-SCREEN\s+name="([^"]+)"\s*-->/gi);
  const screens: Screen[] = [];

  let screenIdx = 1;
  let idCounter = 1;

  function convertNode(htmlNode: SimpleHtmlNode): DesignNode {
    const id = htmlNode.attributes['data-tz-id'] || `n${idCounter++}`;
    const name = htmlNode.attributes['data-tz-name'] || `${htmlNode.tagName}_${id}`;
    const type = getDslNodeType(htmlNode.tagName, htmlNode.attributes['data-tz-type']);

    const props: Record<string, unknown> = {};
    if (type === 'text') {
      props.content = htmlNode.textContent || 'Text';
    } else if (type === 'button') {
      props.label = htmlNode.textContent || 'Button';
    } else if (type === 'input') {
      props.placeholder = htmlNode.attributes['placeholder'] || '';
    } else if (type === 'icon') {
      props.name = htmlNode.attributes['data-icon'] || 'heart';
    } else if (type === 'image') {
      props.src = 'https://via.placeholder.com/150';
      props.alt = htmlNode.attributes['alt'] || 'Image';
    }

    const style = extractStyleSpec(htmlNode.styleMap);
    const sizing = extractSizing(htmlNode.styleMap);

    const containerTypes = ['frame', 'stack', 'card', 'list', 'header', 'footer'];
    const layout = containerTypes.includes(type) ? extractLayout(htmlNode.styleMap) : undefined;

    const children = htmlNode.children.map(convertNode);

    return {
      id,
      type: type as any,
      name,
      props,
      style,
      sizing,
      layout,
      children: children.length > 0 ? children : undefined,
    };
  }

  const rootNodes = parseHtmlFragment(html);

  if (rootNodes.length === 0) {
    // Generate a default fallback screen
    const defaultRoot: DesignNode = {
      id: 'root',
      type: 'frame',
      name: 'Root Screen',
      props: {},
      style: { backgroundColor: '#0F172A' },
      sizing: { width: { mode: 'fixed', value: width }, height: { mode: 'fixed', value: height } },
      layout: { direction: 'column', gap: 16, padding: { top: 24, right: 16, bottom: 24, left: 16 }, mainAxis: 'start', crossAxis: 'stretch' },
      children: [],
    };
    return {
      screens: [{ id: 'screen_1', name: 'Main Screen', width, height, schemaVersion: CURRENT_SCHEMA_VERSION, root: defaultRoot }],
      errors: ['No HTML root elements found; created fallback screen.'],
    };
  }

  for (const rootNode of rootNodes) {
    const rootDsl = convertNode(rootNode);
    rootDsl.id = 'root';
    rootDsl.sizing = { width: { mode: 'fixed', value: width }, height: { mode: 'fixed', value: height } };

    screens.push({
      id: `screen_${screenIdx}`,
      name: rootNode.attributes['data-tz-name'] || `Screen ${screenIdx}`,
      width,
      height,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: rootDsl,
    });
    screenIdx++;
  }

  return { screens, errors };
}

/**
 * Convert a TezDSL DesignNode to subset HTML element
 */
function nodeToHtml(node: DesignNode): string {
  const tag = node.type === 'header' ? 'header' : node.type === 'footer' ? 'footer' : node.type === 'text' ? 'p' : node.type === 'button' ? 'button' : node.type === 'input' ? 'input' : node.type === 'image' ? 'img' : node.type === 'icon' ? 'i' : node.type === 'divider' ? 'hr' : 'div';

  const styles: string[] = ['display:flex'];
  if (node.layout) {
    styles.push(`flex-direction:${node.layout.direction}`);
    styles.push(`gap:${node.layout.gap}px`);
    styles.push(`padding:${node.layout.padding.top}px ${node.layout.padding.right}px ${node.layout.padding.bottom}px ${node.layout.padding.left}px`);
  }
  if (node.style?.backgroundColor) styles.push(`background-color:${node.style.backgroundColor}`);
  if (node.style?.color) styles.push(`color:${node.style.color}`);
  if (node.style?.borderRadius) styles.push(`border-radius:${node.style.borderRadius}px`);
  if (node.style?.fontSize) styles.push(`font-size:${node.style.fontSize}px`);
  if (node.style?.fontWeight) styles.push(`font-weight:${node.style.fontWeight}`);

  const styleAttr = styles.join(';');
  const idAttr = `data-tz-id="${node.id}"`;
  const nameAttr = `data-tz-name="${node.name || node.id}"`;

  let inner = '';
  if (node.type === 'text') {
    inner = (node.props.content as string) || '';
  } else if (node.type === 'button') {
    inner = (node.props.label as string) || '';
  } else if (node.children && node.children.length > 0) {
    inner = node.children.map(nodeToHtml).join('');
  }

  if (tag === 'img' || tag === 'hr' || tag === 'input') {
    return `<${tag} ${idAttr} ${nameAttr} style="${styleAttr}" />`;
  }
  return `<${tag} ${idAttr} ${nameAttr} style="${styleAttr}">${inner}</${tag}>`;
}

/**
 * Convert a TezDSL Screen to subset HTML
 */
export function dslToHtml(screen: Screen): string {
  return nodeToHtml(screen.root);
}
