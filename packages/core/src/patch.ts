/**
 * Patch applier — applies a JSON patch (from AI edit-by-prompt) to a DesignNode tree.
 *
 * Security rules enforced here:
 * 1. Operations targeting nodes outside the selected subtree are rejected
 *    (unless the request is screen-level, indicated by selectedNodeId = undefined).
 * 2. All operations are applied atomically — if any operation fails, the original
 *    tree is returned unchanged.
 * 3. No partial application — either all ops succeed or none are applied.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import type { DesignNode } from './dsl';
import {
  findNode,
  replaceNode,
  updateNode,
  deleteNode,
  insertNode,
  moveNode,
  isDescendant,
} from './tree';
import { normalizeIds } from './tree';

// ─── PATCH OPERATIONS ────────────────────────────────────────────────────────

export interface ReplaceOp {
  op: 'replace';
  target: string;
  node: DesignNode;
}

export interface UpdateStyleOp {
  op: 'update_style';
  target: string;
  style: Partial<DesignNode['style']>;
}

export interface UpdatePropsOp {
  op: 'update_props';
  target: string;
  props: Record<string, unknown>;
}

export interface InsertOp {
  op: 'insert';
  parent: string;
  index: number;
  node: DesignNode;
}

export interface DeleteOp {
  op: 'delete';
  target: string;
}

export interface MoveOp {
  op: 'move';
  target: string;
  parent: string;
  index: number;
}

export type PatchOp = ReplaceOp | UpdateStyleOp | UpdatePropsOp | InsertOp | DeleteOp | MoveOp;

export interface Patch {
  ops: PatchOp[];
}

// ─── PATCH RESULT ────────────────────────────────────────────────────────────

export interface PatchSuccess {
  ok: true;
  root: DesignNode;
  appliedOps: number;
}

export interface PatchFailure {
  ok: false;
  error: string;
  rejectedOps: string[];
}

export type PatchResult = PatchSuccess | PatchFailure;

// ─── SCOPE GUARD ─────────────────────────────────────────────────────────────

/**
 * Returns the IDs that are in-scope for editing.
 * If selectedNodeId is undefined, all nodes are in scope (screen-level edit).
 */
function isInScope(
  root: DesignNode,
  nodeId: string,
  selectedNodeId: string | undefined,
): boolean {
  if (!selectedNodeId) return true; // screen-level edit — all in scope
  return nodeId === selectedNodeId || isDescendant(root, selectedNodeId, nodeId);
}

// ─── APPLY PATCH ─────────────────────────────────────────────────────────────

/**
 * Apply a patch to the root tree.
 *
 * @param root The current root DesignNode.
 * @param patch The patch to apply (from AI or manual).
 * @param selectedNodeId The currently selected node id (restricts op scope).
 *        Pass undefined for screen-level edits.
 * @param existingIds Set of all current node IDs (for ID conflict detection on insert).
 */
export function applyPatch(
  root: DesignNode,
  patch: Patch,
  selectedNodeId: string | undefined,
  existingIds?: Set<string>,
): PatchResult {
  const rejectedOps: string[] = [];
  let current = root;

  for (const op of patch.ops) {
    try {
      switch (op.op) {
        case 'replace': {
          if (!isInScope(root, op.target, selectedNodeId)) {
            rejectedOps.push(
              `replace(${op.target}): out of scope — only ${selectedNodeId} subtree may be modified`,
            );
            return { ok: false, error: 'Scope violation', rejectedOps };
          }
          if (!findNode(current, op.target)) {
            rejectedOps.push(`replace(${op.target}): node not found`);
            return { ok: false, error: `Node ${op.target} not found`, rejectedOps };
          }
          const normalized = normalizeIds(op.node);
          current = replaceNode(current, op.target, { ...normalized, id: op.target });
          break;
        }

        case 'update_style': {
          if (!isInScope(root, op.target, selectedNodeId)) {
            rejectedOps.push(`update_style(${op.target}): out of scope`);
            return { ok: false, error: 'Scope violation', rejectedOps };
          }
          current = updateNode(current, op.target, (node) => ({
            style: { ...node.style, ...op.style },
          }));
          break;
        }

        case 'update_props': {
          if (!isInScope(root, op.target, selectedNodeId)) {
            rejectedOps.push(`update_props(${op.target}): out of scope`);
            return { ok: false, error: 'Scope violation', rejectedOps };
          }
          current = updateNode(current, op.target, (node) => ({
            props: { ...node.props, ...op.props },
          }));
          break;
        }

        case 'insert': {
          if (!isInScope(root, op.parent, selectedNodeId)) {
            rejectedOps.push(`insert(parent=${op.parent}): out of scope`);
            return { ok: false, error: 'Scope violation', rejectedOps };
          }
          const normalized = normalizeIds(op.node);
          current = insertNode(current, op.parent, normalized, op.index);
          break;
        }

        case 'delete': {
          if (!isInScope(root, op.target, selectedNodeId)) {
            rejectedOps.push(`delete(${op.target}): out of scope`);
            return { ok: false, error: 'Scope violation', rejectedOps };
          }
          if (!findNode(current, op.target)) {
            rejectedOps.push(`delete(${op.target}): node not found`);
            return { ok: false, error: `Node ${op.target} not found`, rejectedOps };
          }
          current = deleteNode(current, op.target);
          break;
        }

        case 'move': {
          if (
            !isInScope(root, op.target, selectedNodeId) ||
            !isInScope(root, op.parent, selectedNodeId)
          ) {
            rejectedOps.push(`move(${op.target} → ${op.parent}): out of scope`);
            return { ok: false, error: 'Scope violation', rejectedOps };
          }
          const result = moveNode(current, op.target, op.parent, op.index);
          if ('error' in result) {
            rejectedOps.push(`move(${op.target}): ${result.error}`);
            return { ok: false, error: result.error, rejectedOps };
          }
          current = result;
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      rejectedOps.push(`${op.op}: ${msg}`);
      return { ok: false, error: msg, rejectedOps };
    }
  }

  return { ok: true, root: current, appliedOps: patch.ops.length };
}
