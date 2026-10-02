/**
 * Tree utilities — find, insert, move, delete, patch nodes in a DesignNode tree.
 * All operations are pure (return new trees, never mutate).
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import type { DesignNode } from './dsl';
import { nanoid } from './id';

// ─── TRAVERSAL ───────────────────────────────────────────────────────────────

/** Find a node by id in the tree. Returns undefined if not found. */
export function findNode(root: DesignNode, id: string): DesignNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

/** Find the parent of a node by child id. */
export function findParent(root: DesignNode, id: string): DesignNode | undefined {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return undefined;
}

/** Get the path (array of ids from root to node, inclusive). */
export function getNodePath(root: DesignNode, id: string): string[] | undefined {
  if (root.id === id) return [root.id];
  for (const child of root.children ?? []) {
    const path = getNodePath(child, id);
    if (path) return [root.id, ...path];
  }
  return undefined;
}

/** Count total nodes in tree (including root). */
export function countNodes(root: DesignNode): number {
  return 1 + (root.children ?? []).reduce((acc, c) => acc + countNodes(c), 0);
}

/** Get maximum depth of tree (root = depth 1). */
export function getMaxDepth(root: DesignNode, depth = 1): number {
  if (!root.children || root.children.length === 0) return depth;
  return Math.max(...root.children.map((c) => getMaxDepth(c, depth + 1)));
}

/** Collect all node ids in the tree. */
export function collectIds(root: DesignNode): Set<string> {
  const ids = new Set<string>();
  function traverse(node: DesignNode) {
    ids.add(node.id);
    (node.children ?? []).forEach(traverse);
  }
  traverse(root);
  return ids;
}

// ─── ID NORMALIZATION ────────────────────────────────────────────────────────

/**
 * Assign stable unique IDs to all nodes, replacing any AI-generated IDs.
 * This ensures no duplicate IDs and IDs are never reused after deletion.
 */
export function normalizeIds(node: DesignNode, existingIds = new Set<string>()): DesignNode {
  const newId = nanoid();
  existingIds.add(newId);
  return {
    ...node,
    id: newId,
    children: (node.children ?? []).map((child) => normalizeIds(child, existingIds)),
  };
}

// ─── IMMUTABLE TREE OPERATIONS ───────────────────────────────────────────────

/** Replace a node in the tree. Returns a new tree. */
export function replaceNode(root: DesignNode, id: string, replacement: DesignNode): DesignNode {
  if (root.id === id) return replacement;
  return {
    ...root,
    children: (root.children ?? []).map((c) => replaceNode(c, id, replacement)),
  };
}

/** Update properties of a node. Returns a new tree. */
export function updateNode(
  root: DesignNode,
  id: string,
  updater: (node: DesignNode) => Partial<DesignNode>,
): DesignNode {
  if (root.id === id) return { ...root, ...updater(root) };
  return {
    ...root,
    children: (root.children ?? []).map((c) => updateNode(c, id, updater)),
  };
}

/** Delete a node from the tree. Returns a new tree. */
export function deleteNode(root: DesignNode, id: string): DesignNode {
  return {
    ...root,
    children: (root.children ?? [])
      .filter((c) => c.id !== id)
      .map((c) => deleteNode(c, id)),
  };
}

/** Insert a node as a child of the given parent at the given index. */
export function insertNode(
  root: DesignNode,
  parentId: string,
  node: DesignNode,
  index: number,
): DesignNode {
  if (root.id === parentId) {
    const children = [...(root.children ?? [])];
    const safeIndex = Math.max(0, Math.min(index, children.length));
    children.splice(safeIndex, 0, node);
    return { ...root, children };
  }
  return {
    ...root,
    children: (root.children ?? []).map((c) => insertNode(c, parentId, node, index)),
  };
}

/**
 * Move a node to a new parent at a given index.
 * First removes from current location, then inserts at target.
 */
export function moveNode(
  root: DesignNode,
  nodeId: string,
  newParentId: string,
  newIndex: number,
): DesignNode | { error: string } {
  const node = findNode(root, nodeId);
  if (!node) return { error: `Node ${nodeId} not found` };
  if (nodeId === newParentId) return { error: 'Cannot move node into itself' };
  // Check that newParentId is not a descendant of nodeId
  const nodePath = getNodePath(root, nodeId);
  const parentPath = getNodePath(root, newParentId);
  if (nodePath && parentPath && parentPath.some((id) => id === nodeId)) {
    return { error: 'Cannot move node into one of its descendants' };
  }
  const withoutNode = deleteNode(root, nodeId);
  return insertNode(withoutNode, newParentId, node, newIndex);
}

/** Check if nodeId is a descendant of ancestorId. */
export function isDescendant(root: DesignNode, ancestorId: string, nodeId: string): boolean {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) return false;
  return !!findNode(ancestor, nodeId);
}
