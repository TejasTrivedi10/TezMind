/**
 * Unit tests for the patch applier
 * Tests: scope enforcement, atomic application, all op types, error handling
 */

import type { DesignNode } from '../../src/dsl';
import { applyPatch } from '../../src/patch';
import type { Patch } from '../../src/patch';

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
    makeNode('subtitle'),
  ]),
  makeNode('footer'),
]);

describe('applyPatch — update_style', () => {
  it('applies a style update within selected subtree', () => {
    const patch: Patch = {
      ops: [{ op: 'update_style', target: 'header', style: { backgroundColor: '#ff0000' } }],
    };
    const result = applyPatch(TREE, patch, 'header');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const header = result.root.children?.find((c: DesignNode) => c.id === 'header');
      expect(header?.style.backgroundColor).toBe('#ff0000');
    }
  });

  it('rejects style update outside selected subtree', () => {
    const patch: Patch = {
      ops: [{ op: 'update_style', target: 'footer', style: { backgroundColor: '#ff0000' } }],
    };
    const result = applyPatch(TREE, patch, 'header'); // selected is header, footer is out of scope
    expect(result.ok).toBe(false);
  });

  it('allows all nodes when selectedNodeId is undefined (screen-level edit)', () => {
    const patch: Patch = {
      ops: [{ op: 'update_style', target: 'footer', style: { backgroundColor: '#00ff00' } }],
    };
    const result = applyPatch(TREE, patch, undefined);
    expect(result.ok).toBe(true);
  });
});

describe('applyPatch — update_props', () => {
  it('updates props within scope', () => {
    const patch: Patch = {
      ops: [{ op: 'update_props', target: 'title', props: { content: 'New Title' } }],
    };
    const result = applyPatch(TREE, patch, 'body');
    expect(result.ok).toBe(true);
  });
});

describe('applyPatch — delete', () => {
  it('deletes a node within scope', () => {
    const patch: Patch = {
      ops: [{ op: 'delete', target: 'title' }],
    };
    const result = applyPatch(TREE, patch, 'body');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const body = result.root.children?.find((c: DesignNode) => c.id === 'body');
      expect(body?.children?.find((c: DesignNode) => c.id === 'title')).toBeUndefined();
    }
  });

  it('rejects delete outside scope', () => {
    const patch: Patch = {
      ops: [{ op: 'delete', target: 'footer' }],
    };
    const result = applyPatch(TREE, patch, 'body');
    expect(result.ok).toBe(false);
  });

  it('fails gracefully when deleting non-existent node', () => {
    const patch: Patch = {
      ops: [{ op: 'delete', target: 'nonexistent' }],
    };
    const result = applyPatch(TREE, patch, undefined);
    expect(result.ok).toBe(false);
  });
});

describe('applyPatch — insert', () => {
  it('inserts a new node within scope', () => {
    const newNode = makeNode('newChild');
    const patch: Patch = {
      ops: [{ op: 'insert', parent: 'body', index: 0, node: newNode }],
    };
    const result = applyPatch(TREE, patch, 'body');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const body = result.root.children?.find((c: DesignNode) => c.id === 'body');
      expect(body?.children?.length).toBe(3);
    }
  });
});

describe('applyPatch — atomicity', () => {
  it('does not apply any ops if one fails', () => {
    // First op is valid, second op targets out-of-scope node
    const patch: Patch = {
      ops: [
        { op: 'update_style', target: 'header', style: { backgroundColor: '#ff0000' } },
        { op: 'update_style', target: 'footer', style: { backgroundColor: '#00ff00' } }, // out of scope
      ],
    };
    const result = applyPatch(TREE, patch, 'header');
    expect(result.ok).toBe(false);
    // Verify original tree is unchanged
    const originalHeader = TREE.children?.find((c: DesignNode) => c.id === 'header');
    expect(originalHeader?.style.backgroundColor).toBeUndefined();
  });
});

describe('applyPatch — replace', () => {
  it('replaces a node within scope', () => {
    const replacement = makeNode('header', [makeNode('logo')]);
    replacement.style = { backgroundColor: '#purple' };
    const patch: Patch = {
      ops: [{ op: 'replace', target: 'header', node: replacement }],
    };
    const result = applyPatch(TREE, patch, 'header');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const header = result.root.children?.find((c: DesignNode) => c.id === 'header');
      expect(header?.children?.length).toBe(1);
      expect(header?.id).toBe('header'); // ID preserved from target
    }
  });
});
