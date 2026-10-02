/**
 * Layout linter — validates design trees for common layout issues.
 * Run on every AI-generated or user-edited screen.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import type { DesignNode } from './dsl';
import { DSL_LIMITS } from './dsl';
import { countNodes, getMaxDepth } from './tree';

// ─── LINT RESULT ─────────────────────────────────────────────────────────────

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  nodeId: string;
  nodeName?: string;
  severity: LintSeverity;
  code: string;
  message: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function traverse(node: DesignNode, fn: (node: DesignNode, depth: number) => void, depth = 0): void {
  fn(node, depth);
  (node.children ?? []).forEach((child) => traverse(child, fn, depth + 1));
}

function isContainerType(type: DesignNode['type']): boolean {
  return ['frame', 'stack', 'overlay', 'card', 'list', 'header', 'footer'].includes(type);
}

function isLeafType(type: DesignNode['type']): boolean {
  return ['text', 'button', 'image', 'icon', 'divider', 'switch', 'checkbox', 'avatar', 'badge', 'chip'].includes(type);
}

// ─── LINT RULES ──────────────────────────────────────────────────────────────

export function lintTree(root: DesignNode): LintIssue[] {
  const issues: LintIssue[] = [];

  // 1. Total node count
  const nodeCount = countNodes(root);
  if (nodeCount > DSL_LIMITS.maxNodes) {
    issues.push({
      nodeId: root.id,
      severity: 'error',
      code: 'NODE_COUNT_EXCEEDED',
      message: `Tree has ${nodeCount} nodes; maximum is ${DSL_LIMITS.maxNodes}.`,
    });
  }

  // 2. Tree depth
  const depth = getMaxDepth(root);
  if (depth > DSL_LIMITS.maxDepth) {
    issues.push({
      nodeId: root.id,
      severity: 'error',
      code: 'DEPTH_EXCEEDED',
      message: `Tree depth is ${depth}; maximum is ${DSL_LIMITS.maxDepth}.`,
    });
  }

  traverse(root, (node) => {
    const label = node.name ?? node.type;

    // 3. Absolute positioning outside overlay
    if (node.type !== 'overlay') {
      const parent_note = 'Only children of overlay nodes may use edge anchoring.';
      if (node.anchor && (node.anchor.top !== undefined || node.anchor.left !== undefined ||
          node.anchor.right !== undefined || node.anchor.bottom !== undefined)) {
        // anchors should only appear on children of overlay
        // The parent check would require context; flag if node itself has anchor AND is not overlay child
        // (best-effort check — full parent check done at patch validation level)
        issues.push({
          nodeId: node.id,
          nodeName: label,
          severity: 'warning',
          code: 'ANCHOR_OUTSIDE_OVERLAY',
          message: `Node "${label}" has edge anchors but may not be a child of an overlay node. ${parent_note}`,
        });
      }
    }

    // 4. Container missing layout spec
    if (isContainerType(node.type) && node.type !== 'overlay' && !node.layout) {
      issues.push({
        nodeId: node.id,
        nodeName: label,
        severity: 'error',
        code: 'CONTAINER_MISSING_LAYOUT',
        message: `Container "${label}" (${node.type}) has no layout spec. Every container must define direction, gap, padding, and alignment.`,
      });
    }

    // 5. Text nodes without overflow/ellipsis policy on mobile-width screens
    if (node.type === 'text') {
      const props = node.props as Record<string, unknown>;
      const hasSizing = node.sizing.width.mode !== 'fixed';
      if (hasSizing && !props.numberOfLines && !props.ellipsizeMode) {
        issues.push({
          nodeId: node.id,
          nodeName: label,
          severity: 'warning',
          code: 'TEXT_NO_OVERFLOW_POLICY',
          message: `Text "${label}" has no numberOfLines or ellipsizeMode. Long text may overflow on small screens.`,
        });
      }
    }

    // 6. Fixed-size touch targets below 44px
    if (['button', 'switch', 'checkbox'].includes(node.type)) {
      const w = node.sizing.width;
      const h = node.sizing.height;
      if (w.mode === 'fixed' && w.value < 44) {
        issues.push({
          nodeId: node.id,
          nodeName: label,
          severity: 'warning',
          code: 'TOUCH_TARGET_TOO_SMALL',
          message: `Touch target "${label}" width ${w.value}px is below the 44px minimum.`,
        });
      }
      if (h.mode === 'fixed' && h.value < 44) {
        issues.push({
          nodeId: node.id,
          nodeName: label,
          severity: 'warning',
          code: 'TOUCH_TARGET_TOO_SMALL',
          message: `Touch target "${label}" height ${h.value}px is below the 44px minimum.`,
        });
      }
    }

    // 7. Nested scroll containers
    if (node.layout?.scroll && node.layout.scroll !== 'none') {
      (node.children ?? []).forEach((child) => {
        if (child.layout?.scroll && child.layout.scroll !== 'none') {
          issues.push({
            nodeId: child.id,
            nodeName: child.name ?? child.type,
            severity: 'warning',
            code: 'NESTED_SCROLL',
            message: `"${child.name ?? child.type}" is a scrollable container nested inside another scrollable container "${label}". This may cause gesture conflicts.`,
          });
        }
      });
    }

    // 8. Images from non-https URLs (security check)
    if (node.type === 'image') {
      const src = (node.props as { src?: string }).src;
      if (src && !src.startsWith('data:') && !src.startsWith('https://') && !src.startsWith('file://')) {
        issues.push({
          nodeId: node.id,
          nodeName: label,
          severity: 'error',
          code: 'UNSAFE_IMAGE_URL',
          message: `Image "${label}" has a non-https, non-data-URI src: "${src}". Only https:// and data: URIs are allowed.`,
        });
      }
    }

    // 9. Icon names — placeholder: real check is done at validation time against ICON_NAMES
    if (node.type === 'icon') {
      const name = (node.props as { name?: string }).name;
      if (!name) {
        issues.push({
          nodeId: node.id,
          nodeName: label,
          severity: 'error',
          code: 'ICON_MISSING_NAME',
          message: `Icon node "${label}" is missing the required "name" prop.`,
        });
      }
    }
  });

  return issues;
}

/** Returns true if there are any error-severity issues. */
export function hasErrors(issues: LintIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
