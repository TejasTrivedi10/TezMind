/**
 * TezMind Web Database — Dexie (IndexedDB) implementation.
 * Implements the ProjectStore interface from @tezmind/core.
 *
 * Schema:
 *   projects: ProjectMeta (keyed by id)
 *   screens: ScreenRecord + projectId
 *   components: ComponentRecord + projectId
 *   history: HistoryEntry + projectId + screenId
 *   assets: AssetRecord + projectId
 *   settings: key-value store
 */

import Dexie, { type Table } from 'dexie';
import type { ProjectMeta, ScreenRecord, ComponentRecord, AssetRecord, HistoryEntry } from '@tezmind/core';

// Extended types for Dexie (need projectId for compound queries)
interface ScreenRow extends ScreenRecord {
  projectId: string;
}

interface ComponentRow extends ComponentRecord {
  projectId: string;
}

interface AssetRow extends AssetRecord {
  projectId: string;
}

interface HistoryRow extends HistoryEntry {
  projectId: string;
  screenId: string;
}

interface SettingsRow {
  key: string;
  value: string;
}

class TezMindDB extends Dexie {
  projects!: Table<ProjectMeta, string>;
  screens!: Table<ScreenRow, string>;
  components!: Table<ComponentRow, string>;
  assets!: Table<AssetRow, string>;
  history!: Table<HistoryRow, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('tezmind-v1');
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
      screens: 'id, projectId, name, order, updatedAt',
      components: 'id, projectId, name, updatedAt',
      assets: 'id, projectId, name',
      history: 'id, projectId, screenId, timestamp',
      settings: 'key',
    });
  }
}

let _db: TezMindDB | null = null;

export function getDatabase(): TezMindDB {
  if (!_db) {
    _db = new TezMindDB();
  }
  return _db;
}

/**
 * Settings helpers
 */
export async function getSetting(key: string): Promise<string | undefined> {
  const db = getDatabase();
  const row = await db.settings.get(key);
  return row?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDatabase();
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = getDatabase();
  await db.settings.delete(key);
}
