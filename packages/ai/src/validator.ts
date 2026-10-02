/**
 * AI output validator — parses and validates AI-generated JSON against the TezDSL schema.
 * Implements the 3-step validation and retry loop.
 *
 * Steps:
 * 1. Parse JSON (strip accidental code fences; extract first balanced JSON object).
 * 2. Validate with Zod schemas.
 * 3. Run semantic checks (icon names, font names, ID uniqueness, depth/count limits).
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import { ScreenSchema, DesignTokensSchema, DSL_LIMITS } from '@tezmind/core';
import { applyPatch } from '@tezmind/core';
import type { Screen, DesignNode, DesignTokens } from '@tezmind/core';
import { countNodes, getMaxDepth, collectIds, normalizeIds } from '@tezmind/core';
import type { Patch } from '@tezmind/core';
import { z } from 'zod';
import { ICON_NAMES, ALLOWED_FONTS } from './allowlists';

// ─── EXTRACT JSON ────────────────────────────────────────────────────────────

/**
 * Strip markdown code fences and extract the first balanced JSON object or array.
 */
export function extractJson(raw: string): string {
  let cleaned = raw.trim();

  // Extract content inside ```json ... ``` if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  } else {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/gi, '')
      .replace(/\s*```$/gi, '')
      .trim();
  }

  // Find the first balanced { or [
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  if (start !== -1) {
    let slice = cleaned.slice(start);
    if (inString) {
      slice += '"';
    }
    slice = slice.replace(/[,:]\s*$/, '');

    const openStack: string[] = [];
    let str = false;
    let esc = false;
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      if (esc) { esc = false; continue; }
      if (c === '\\' && str) { esc = true; continue; }
      if (c === '"') { str = !str; continue; }
      if (str) continue;
      if (c === '{') openStack.push('}');
      else if (c === '[') openStack.push(']');
      else if (c === '}' || c === ']') openStack.pop();
    }
    while (openStack.length > 0) {
      slice += openStack.pop();
    }
    return slice;
  }

  return cleaned;
}

// ─── VALIDATION RESULT ───────────────────────────────────────────────────────

export interface ValidationSuccess {
  ok: true;
  screens?: Screen[];
  patch?: Patch;
  tokens?: DesignTokens;
}

export interface ValidationFailure {
  ok: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ─── OUTPUT SCHEMAS ──────────────────────────────────────────────────────────

const ScreensOutputSchema = z.object({
  screens: z.array(ScreenSchema).min(1).max(DSL_LIMITS.maxScreensPerRequest),
  tokens: DesignTokensSchema.optional(),
});

const PatchOutputSchema = z.object({
  ops: z.array(z.object({ op: z.string() }).passthrough()).min(1),
});

// ─── SEMANTIC CHECKS ─────────────────────────────────────────────────────────

function semanticCheck(screens: Screen[]): string[] {
  const errors: string[] = [];

  for (const screen of screens) {
    const ids = new Set<string>();
    const nodeCount = countNodes(screen.root);
    const depth = getMaxDepth(screen.root);

    if (nodeCount > DSL_LIMITS.maxNodes) {
      errors.push(`Screen "${screen.name}": ${nodeCount} nodes exceeds the ${DSL_LIMITS.maxNodes} node limit.`);
    }
    if (depth > DSL_LIMITS.maxDepth) {
      errors.push(`Screen "${screen.name}": tree depth ${depth} exceeds the ${DSL_LIMITS.maxDepth} depth limit.`);
    }

    function checkNode(node: DesignNode) {
      // Duplicate IDs
      if (ids.has(node.id)) {
        errors.push(`Screen "${screen.name}": duplicate node ID "${node.id}".`);
      }
      ids.add(node.id);

      // Icon names
      if (node.type === 'icon') {
        const name = (node.props as { name?: string }).name;
        if (name && !ICON_NAMES.has(name)) {
          errors.push(`Icon node "${node.id}": unknown icon name "${name}". Use a name from the allowlist.`);
        }
      }

      // Font families
      const fontFamily = node.style?.fontFamily;
      if (fontFamily && !(ALLOWED_FONTS as readonly string[]).includes(fontFamily)) {
        errors.push(`Node "${node.id}": font family "${fontFamily}" is not in the allowed list.`);
      }

      // Image src security
      if (node.type === 'image') {
        const src = (node.props as { src?: string }).src;
        if (src && !src.startsWith('data:') && !src.startsWith('https://') && !src.startsWith('file://')) {
          errors.push(`Image node "${node.id}": unsafe src URL "${src}". Only https:// and data: URIs allowed.`);
        }
      }

      // Container without layout
      const containerTypes = ['frame', 'stack', 'card', 'list', 'header', 'footer'];
      if (containerTypes.includes(node.type) && !node.layout) {
        errors.push(`Container node "${node.id}" (${node.type}) is missing a "layout" field.`);
      }

      (node.children ?? []).forEach(checkNode);
    }

    checkNode(screen.root);
  }

  return errors;
}

// ─── SANITIZER ──────────────────────────────────────────────────────────────

/**
 * Auto-heal common AI output quirks before Zod validation.
 */
function sanitizeNode(node: any, idCounter = { val: 1 }): any {
  if (!node || typeof node !== 'object') return node;

  // 1. Ensure ID
  if (!node.id || typeof node.id !== 'string') {
    node.id = `node_${idCounter.val++}`;
  }

  // 2. Ensure type
  if (!node.type || typeof node.type !== 'string') {
    node.type = 'frame';
  }

  // 3. Ensure props object
  if (!node.props || typeof node.props !== 'object') {
    node.props = {};
  }

  // 4. Ensure style object
  if (!node.style || typeof node.style !== 'object') {
    node.style = {};
  } else {
    const style = node.style;
    if (style.overflow === 'ellipsis') {
      style.overflow = 'hidden';
    }
    if (typeof style.fontWeight === 'number') {
      style.fontWeight = String(style.fontWeight);
    } else if (typeof style.fontWeight === 'string') {
      const fw = style.fontWeight.toLowerCase();
      if (fw === 'bold') style.fontWeight = '700';
      else if (fw === 'normal' || fw === 'regular') style.fontWeight = '400';
      else if (fw === 'medium') style.fontWeight = '500';
      else if (fw === 'semibold') style.fontWeight = '600';
      else if (fw === 'extrabold') style.fontWeight = '800';
    }
  }

  // 5. Ensure sizing object
  if (!node.sizing || typeof node.sizing !== 'object') {
    node.sizing = { width: { mode: 'hug' }, height: { mode: 'hug' } };
  } else {
    if (typeof node.sizing.width === 'string' || typeof node.sizing.width === 'number') {
      if (node.sizing.width === 'fill' || node.sizing.width === '100%') {
        node.sizing.width = { mode: 'fill' };
      } else if (typeof node.sizing.width === 'number') {
        node.sizing.width = { mode: 'fixed', value: node.sizing.width };
      } else {
        node.sizing.width = { mode: 'hug' };
      }
    }
    if (typeof node.sizing.height === 'string' || typeof node.sizing.height === 'number') {
      if (node.sizing.height === 'fill' || node.sizing.height === '100%') {
        node.sizing.height = { mode: 'fill' };
      } else if (typeof node.sizing.height === 'number') {
        node.sizing.height = { mode: 'fixed', value: node.sizing.height };
      } else {
        node.sizing.height = { mode: 'hug' };
      }
    }
  }

  // 6. Ensure layout object for containers
  const containerTypes = ['frame', 'stack', 'card', 'list', 'header', 'footer'];
  if (containerTypes.includes(node.type) && (!node.layout || typeof node.layout !== 'object')) {
    node.layout = {
      direction: 'column',
      gap: 8,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      mainAxis: 'start',
      crossAxis: 'stretch',
    };
  } else if (node.layout && typeof node.layout === 'object') {
    if (typeof node.layout.padding === 'number') {
      const p = node.layout.padding;
      node.layout.padding = { top: p, right: p, bottom: p, left: p };
    } else if (node.layout.padding && typeof node.layout.padding === 'object') {
      node.layout.padding.top = node.layout.padding.top ?? 0;
      node.layout.padding.right = node.layout.padding.right ?? 0;
      node.layout.padding.bottom = node.layout.padding.bottom ?? 0;
      node.layout.padding.left = node.layout.padding.left ?? 0;
    } else {
      node.layout.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    }
    node.layout.direction = node.layout.direction === 'row' ? 'row' : 'column';
    node.layout.gap = typeof node.layout.gap === 'number' ? Math.max(0, node.layout.gap) : 8;
    node.layout.mainAxis = node.layout.mainAxis ?? 'start';
    node.layout.crossAxis = node.layout.crossAxis ?? 'stretch';
  }

  // 7. Sanitize children
  if (Array.isArray(node.children)) {
    node.children = node.children.map((child: any) => sanitizeNode(child, idCounter));
  }

  return node;
}

function sanitizeParsedData(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (Array.isArray(parsed.screens)) {
    parsed.screens = parsed.screens.map((s: any, idx: number) => {
      if (!s || typeof s !== 'object') return s;
      return {
        id: s.id || `screen_${idx + 1}`,
        name: s.name || `Screen ${idx + 1}`,
        width: typeof s.width === 'number' ? s.width : 393,
        height: typeof s.height === 'number' ? s.height : 852,
        root: sanitizeNode(s.root),
      };
    });
  }
  return parsed;
}

// ─── VALIDATE SCREENS ────────────────────────────────────────────────────────

export function validateScreensOutput(raw: string): ValidationResult {
  const errors: string[] = [];

  // 1. Extract JSON
  let parsed: unknown;
  try {
    const extracted = extractJson(raw);
    parsed = sanitizeParsedData(JSON.parse(extracted));
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`] };
  }

  // 2. Zod validation
  const result = ScreensOutputSchema.safeParse(parsed);
  if (!result.success) {
    const zodErrors = result.error.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`,
    );
    return { ok: false, errors: zodErrors };
  }

  // 3. Semantic checks
  const semanticErrors = semanticCheck(result.data.screens);
  if (semanticErrors.length > 0) {
    return { ok: false, errors: semanticErrors };
  }

  // 4. Normalize IDs (replace AI-generated IDs with stable ones)
  const normalizedScreens = result.data.screens.map((screen) => ({
    ...screen,
    root: normalizeIds(screen.root),
  }));

  return {
    ok: true,
    screens: normalizedScreens,
    tokens: result.data.tokens,
  };
}

// ─── VALIDATE PATCH ──────────────────────────────────────────────────────────

export function validatePatchOutput(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    const extracted = extractJson(raw);
    parsed = JSON.parse(extracted);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const result = PatchOutputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  return { ok: true, patch: result.data as unknown as Patch };
}
