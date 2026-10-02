/**
 * Unit tests for tree utilities
 * Tests: findNode, findParent, insertNode, deleteNode, moveNode, countNodes, getMaxDepth
 */

import type { DesignNode } from '../../src/dsl';
import {
  findNode,
  findParent,
  insertNode,
  deleteNode,
  moveNode,
  countNodes,
  getMaxDepth,
  isDescendant,
} from '../../src/tree';

// ─── TEST HELPERS ─────────────────────────────────────────────────────────────

function makeNode(id: string, children?: DesignNode[]): DesignNode {
  return {
    id,
    type: 'frame',
    props: {},
    style: {},
    sizing: { width: { mode: 'fill' }, height: { mode: 'fill' } },
    layout: { direction: 'column', gap: 8, padding: { top: 0, right: 0, bottom: 0, left: 0 }, mainAxis: 'start', crossAxis: 'stretch' },
    children,
  };
}

const TREE: DesignNode = makeNode('root', [
  makeNode('header'),
  makeNode('body', [
    makeNode('title'),
    makeNode('content', [
      makeNode('item1'),
      makeNode('item2'),
    ]),
  ]),
  makeNode('footer'),
]);

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('findNode', () => {
  it('finds root node', () => {
    expect(findNode(TREE, 'root')?.id).toBe('root');
  });

  it('finds deeply nested node', () => {
    expect(findNode(TREE, 'item1')?.id).toBe('item1');
  });

  it('returns undefined for missing node', () => {
    expect(findNode(TREE, 'missing')).toBeUndefined();
  });
});

describe('findParent', () => {
  it('finds parent of a direct child', () => {
    expect(findParent(TREE, 'header')?.id).toBe('root');
  });

  it('finds parent of a nested node', () => {
    expect(findParent(TREE, 'item1')?.id).toBe('content');
  });

  it('returns undefined for root', () => {
    expect(findParent(TREE, 'root')).toBeUndefined();
  });
});

describe('countNodes', () => {
  it('counts all nodes', () => {
    // root + header + body + title + content + item1 + item2 + footer = 8
    expect(countNodes(TREE)).toBe(8);
  });

  it('counts single node', () => {
    expect(countNodes(makeNode('solo'))).toBe(1);
  });
});

describe('getMaxDepth', () => {
  it('returns correct max depth', () => {
    // root(1) > body(2) > content(3) > item1(4)
    expect(getMaxDepth(TREE)).toBe(4);
  });

  it('returns 1 for a leaf node', () => {
    expect(getMaxDepth(makeNode('leaf'))).toBe(1);
  });
});

describe('insertNode', () => {
  it('inserts at the correct index', () => {
    const newNode = makeNode('newNode');
    const updated = insertNode(TREE, 'root', newNode, 1);
    expect(updated.children?.[1].id).toBe('newNode');
    expect(updated.children?.length).toBe(4);
  });

  it('inserts at end when index is beyond length', () => {
    const newNode = makeNode('last');
    const updated = insertNode(TREE, 'root', newNode, 999);
    expect(updated.children?.[updated.children.length - 1].id).toBe('last');
  });

  it('does not mutate original tree', () => {
    const newNode = makeNode('x');
    insertNode(TREE, 'root', newNode, 0);
    expect(TREE.children?.length).toBe(3); // unchanged
  });
});

describe('deleteNode', () => {
  it('deletes a direct child', () => {
    const updated = deleteNode(TREE, 'header');
    expect(findNode(updated, 'header')).toBeUndefined();
    expect(countNodes(updated)).toBe(7);
  });

  it('deletes a nested node and all descendants', () => {
    const updated = deleteNode(TREE, 'content');
    expect(findNode(updated, 'content')).toBeUndefined();
    expect(findNode(updated, 'item1')).toBeUndefined();
    expect(findNode(updated, 'item2')).toBeUndefined();
    expect(countNodes(updated)).toBe(5);
  });

  it('does not mutate original', () => {
    deleteNode(TREE, 'header');
    expect(findNode(TREE, 'header')).toBeDefined();
  });
});

describe('moveNode', () => {
  it('moves a node to a new parent', () => {
    const result = moveNode(TREE, 'header', 'body', 0);
    if ('error' in result) throw new Error(result.error);
    expect(findNode(result, 'header')).toBeDefined();
    expect(findParent(result, 'header')?.id).toBe('body');
    // header should no longer be under root
    expect(result.children?.find((c: DesignNode) => c.id === 'header')).toBeUndefined();
  });

  it('returns error when moving node into itself', () => {
    const result = moveNode(TREE, 'root', 'root', 0);
    expect('error' in result).toBe(true);
  });

  it('returns error when moving into a descendant', () => {
    const result = moveNode(TREE, 'body', 'content', 0);
    expect('error' in result).toBe(true);
  });
});

describe('isDescendant', () => {
  it('returns true for nested descendant', () => {
    expect(isDescendant(TREE, 'body', 'item1')).toBe(true);
  });

  it('returns false for non-descendant', () => {
    expect(isDescendant(TREE, 'header', 'body')).toBe(false);
  });
});
