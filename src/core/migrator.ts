import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Knex } from 'knex';
import { parseMigration } from './parser.js';
import { checkSafety } from './safety.js';
import { ensureMigrationsTable } from './connection.js';
import type { MigrationRecord } from '../types.js';

export interface MigrationResult {
  name: string;
  direction: 'up' | 'down';
  warnings: string[];
}

/**
 * Get all migration files sorted by timestamp.
 */
export function getMigrationFiles(migrationsDir: string): string[] {
  try {
    return readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Get applied migrations from the tracking table.
 */
async function getApplied(db: Knex): Promise<MigrationRecord[]> {
  await ensureMigrationsTable(db);
  return db<MigrationRecord>('migra_migrations').orderBy('id', 'asc');
}

/**
 * Run all pending migrations (UP).
 */
export async function migrateUp(
  db: Knex,
  migrationsDir: string
): Promise<MigrationResult[]> {
  const applied = await getApplied(db);
  const appliedNames = new Set(applied.map((r) => r.name));
  const files = getMigrationFiles(migrationsDir);
  const pending = files.filter((f) => !appliedNames.has(f));

  if (pending.length === 0) return [];

  const batch =
    applied.length > 0 ? Math.max(...applied.map((r) => r.batch)) + 1 : 1;

  const results: MigrationResult[] = [];

  for (const file of pending) {
    const content = readFileSync(join(migrationsDir, file), 'utf-8');
    const { up } = parseMigration(content);

    if (!up) {
      throw new Error(`No UP section found in ${file}`);
    }

    const warnings = checkSafety(up).map(
      (w) => `${w.label} on line ${w.line}`
    );

    await db.raw(up);
    await db('migra_migrations').insert({ name: file, batch });

    results.push({ name: file, direction: 'up', warnings });
  }

  return results;
}

/**
 * Rollback the last batch of migrations (DOWN).
 */
export async function migrateDown(
  db: Knex,
  migrationsDir: string
): Promise<MigrationResult[]> {
  const applied = await getApplied(db);
  if (applied.length === 0) return [];

  const lastBatch = Math.max(...applied.map((r) => r.batch));
  const toRollback = applied
    .filter((r) => r.batch === lastBatch)
    .reverse();

  const results: MigrationResult[] = [];

  for (const record of toRollback) {
    const filePath = join(migrationsDir, record.name);
    const content = readFileSync(filePath, 'utf-8');
    const { down } = parseMigration(content);

    if (!down) {
      throw new Error(`No DOWN section found in ${record.name}`);
    }

    const warnings = checkSafety(down).map(
      (w) => `${w.label} on line ${w.line}`
    );

    await db.raw(down);
    await db('migra_migrations').where('id', record.id).del();

    results.push({ name: record.name, direction: 'down', warnings });
  }

  return results;
}

/**
 * Get migration status (applied vs pending).
 */
export async function getStatus(
  db: Knex,
  migrationsDir: string
): Promise<{ name: string; status: 'applied' | 'pending'; batch?: number }[]> {
  const applied = await getApplied(db);
  const appliedMap = new Map(applied.map((r) => [r.name, r]));
  const files = getMigrationFiles(migrationsDir);

  return files.map((file) => {
    const record = appliedMap.get(file);
    return record
      ? { name: file, status: 'applied' as const, batch: record.batch }
      : { name: file, status: 'pending' as const };
  });
}
