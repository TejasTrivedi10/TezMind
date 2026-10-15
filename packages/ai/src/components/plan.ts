import type { Composition, DesignComponentRecord as ComponentRecord } from '@tezmind/core';
import type { ComponentRegistry } from './registry';

export interface ComponentPlan {
  neededRoles: string[];
  toReuse: ComponentRecord[];
  toBuild: string[];
}

export function planComponents(
  composition: Composition,
  registry: ComponentRegistry,
): ComponentPlan {
  const neededSet = new Set<string>();

  const extractRoles = (containers: any[]) => {
    for (const c of containers) {
      if (c.role && c.role !== 'default') {
        neededSet.add(c.role);
      }
      if (c.children && Array.isArray(c.children)) {
        extractRoles(c.children);
      }
    }
  };

  for (const s of composition.sections) {
    if (s.containers) {
      extractRoles(s.containers);
    }
  }

  const neededRoles = Array.from(neededSet);
  const toReuse: ComponentRecord[] = [];
  const toBuild: string[] = [];

  for (const role of neededRoles) {
    const existing = registry.findMatching(role);
    if (existing && existing.status === 'ready') {
      toReuse.push(existing);
    } else {
      toBuild.push(role);
    }
  }

  return {
    neededRoles,
    toReuse,
    toBuild,
  };
}
