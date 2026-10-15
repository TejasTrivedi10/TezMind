import type { DesignComponentRecord as ComponentRecord } from '@tezmind/core';

export class ComponentRegistry {
  private records = new Map<string, ComponentRecord>();

  constructor(initialRecords: ComponentRecord[] = []) {
    initialRecords.forEach((r) => this.records.set(r.id, r));
  }

  get(id: string): ComponentRecord | undefined {
    return this.records.get(id);
  }

  has(id: string): boolean {
    return this.records.has(id);
  }

  getAll(): ComponentRecord[] {
    return Array.from(this.records.values());
  }

  register(record: ComponentRecord): void {
    this.records.set(record.id, record);
  }

  markUsedByScreen(componentId: string, screenId: string): void {
    const record = this.records.get(componentId);
    if (record && !record.usedByScreens.includes(screenId)) {
      record.usedByScreens.push(screenId);
    }
  }

  findMatching(nameOrRole: string): ComponentRecord | undefined {
    const target = nameOrRole.toLowerCase().trim();
    for (const record of this.records.values()) {
      if (
        record.id.toLowerCase() === target ||
        record.name.toLowerCase() === target ||
        record.variants.some((v) => v.toLowerCase() === target)
      ) {
        return record;
      }
    }
    return undefined;
  }
}
