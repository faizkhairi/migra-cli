import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Knex } from 'knex';
import { parseMigration } from './parser.js';
import { checkSafety, type SafetyWarning } from './safety.js';
import { ensureMigrationsTable } from './connection.js';
import type { MigrationRecord } from '../types.js';

export interface MigrationResult {
  name: string;
  direction: 'up' | 'down';
  warnings: string[];
}

/**
 * Thrown when a migration contains destructive statements and was refused
 * (no --force, and no interactive confirmation).
 */
export class DestructiveMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DestructiveMigrationError';
  }
}

export interface RunOptions {
  /** Skip the destructive-statement confirmation entirely. */
  force?: boolean;
  /**
   * Called to ask for interactive confirmation when a destructive statement
   * is found and `force` is not set. Only pass this when stdin is a TTY;
   * omitting it means "refuse non-interactively".
   */
  confirmFn?: (message: string) => Promise<boolean>;
}

/**
 * Apply the up-front destructive-statement gate shared by up and down.
 * Throws `DestructiveMigrationError` if the migration is refused.
 */
async function guardDestructive(
  file: string,
  warnings: SafetyWarning[],
  opts: RunOptions
): Promise<void> {
  if (warnings.length === 0 || opts.force) return;

  const labels = warnings.map((w) => w.label).join(', ');

  if (opts.confirmFn) {
    const ok = await opts.confirmFn(
      `'${file}' contains destructive statement(s): ${labels}. Continue?`
    );
    if (ok) return;
    throw new DestructiveMigrationError(
      `Refusing to run '${file}': destructive statement(s) not confirmed (${labels}).`
    );
  }

  throw new DestructiveMigrationError(
    `Refusing to run '${file}': contains destructive statement(s) (${labels}). ` +
      'Pass --force to run anyway, or run interactively to confirm.'
  );
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
  migrationsDir: string,
  opts: RunOptions = {}
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

    const safetyWarnings = checkSafety(up);
    await guardDestructive(file, safetyWarnings, opts);

    await db.transaction(async (trx) => {
      await trx.raw(up);
      await trx('migra_migrations').insert({ name: file, batch });
    });

    const warnings = safetyWarnings.map((w) => `${w.label} on line ${w.line}`);
    results.push({ name: file, direction: 'up', warnings });
  }

  return results;
}

/**
 * Rollback the last batch of migrations (DOWN).
 */
export async function migrateDown(
  db: Knex,
  migrationsDir: string,
  opts: RunOptions = {}
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

    const safetyWarnings = checkSafety(down);
    await guardDestructive(record.name, safetyWarnings, opts);

    await db.transaction(async (trx) => {
      await trx.raw(down);
      await trx('migra_migrations').where('id', record.id).del();
    });

    const warnings = safetyWarnings.map((w) => `${w.label} on line ${w.line}`);
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
