/**
 * Schema migrations — forward-only migrations for the TezDSL project format.
 * Each migration takes a plain object of any older schemaVersion and upgrades it
 * to the next version.
 *
 * Rules:
 * - Migrations are pure functions (no side effects).
 * - Never remove a migration; only add new ones.
 * - Every migration must be tested.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

export interface Migratable {
  schemaVersion: number;
  [key: string]: unknown;
}

export type Migration = {
  fromVersion: number;
  toVersion: number;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
};

/** All registered migrations, in order. */
export const migrations: Migration[] = [
  // Example migration (v0 → v1): nothing to change for v1 yet
  // {
  //   fromVersion: 0,
  //   toVersion: 1,
  //   migrate: (data) => ({ ...data, someNewField: 'default' }),
  // },
];

/**
 * Migrate a plain data object from its current schemaVersion up to targetVersion.
 * If data.schemaVersion === targetVersion, returns data unchanged.
 * Throws if a required migration step is missing.
 */
export function migrateUp(
  data: Record<string, unknown>,
  targetVersion: number,
): Record<string, unknown> {
  let current = data;
  let version = (current.schemaVersion as number) ?? 0;

  while (version < targetVersion) {
    const migration = migrations.find((m) => m.fromVersion === version);
    if (!migration) {
      throw new Error(
        `No migration found from schemaVersion ${version}. ` +
          `Cannot migrate to ${targetVersion}. Add a migration in core/src/migrations.ts.`,
      );
    }
    current = migration.migrate(current);
    version = migration.toVersion;
  }

  return { ...current, schemaVersion: targetVersion };
}
