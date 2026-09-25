import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import knex, { type Knex } from 'knex';
import {
  migrateUp,
  migrateDown,
  getStatus,
  DestructiveMigrationError,
} from '../src/core/migrator.js';

const TEST_DIR = join(process.cwd(), '.test-migrations');
let db: Knex;

beforeEach(async () => {
  db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });

  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await db.destroy();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeMigration(name: string, up: string, down: string) {
  writeFileSync(
    join(TEST_DIR, name),
    `-- UP\n${up}\n\n-- DOWN\n${down}\n`,
    'utf-8'
  );
}

describe('migrateUp', () => {
  it('applies pending migrations', async () => {
    writeMigration(
      '001_create_users.sql',
      'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);',
      'DROP TABLE users;'
    );

    const results = await migrateUp(db, TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('001_create_users.sql');
    expect(results[0].direction).toBe('up');

    // Verify table exists
    const hasTable = await db.schema.hasTable('users');
    expect(hasTable).toBe(true);
  });

  it('skips already applied migrations', async () => {
    writeMigration(
      '001_create_users.sql',
      'CREATE TABLE users (id INTEGER PRIMARY KEY);',
      'DROP TABLE users;'
    );

    await migrateUp(db, TEST_DIR);
    const second = await migrateUp(db, TEST_DIR);
    expect(second).toHaveLength(0);
  });

  it('applies migrations in order', async () => {
    writeMigration('001_first.sql', 'CREATE TABLE first (id INTEGER);', 'DROP TABLE first;');
    writeMigration('002_second.sql', 'CREATE TABLE second (id INTEGER);', 'DROP TABLE second;');

    const results = await migrateUp(db, TEST_DIR);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('001_first.sql');
    expect(results[1].name).toBe('002_second.sql');
  });
});

describe('migrateDown', () => {
  it('rolls back the last batch', async () => {
    writeMigration('001_create_users.sql', 'CREATE TABLE users (id INTEGER);', 'DROP TABLE users;');
    await migrateUp(db, TEST_DIR);

    // DROP TABLE is destructive, so this rollback needs --force (or confirmation).
    const results = await migrateDown(db, TEST_DIR, { force: true });
    expect(results).toHaveLength(1);
    expect(results[0].direction).toBe('down');

    const hasTable = await db.schema.hasTable('users');
    expect(hasTable).toBe(false);
  });

  it('returns empty for no migrations', async () => {
    const results = await migrateDown(db, TEST_DIR);
    expect(results).toHaveLength(0);
  });

  it('refuses a destructive rollback without force or confirmation', async () => {
    writeMigration('001_create_users.sql', 'CREATE TABLE users (id INTEGER);', 'DROP TABLE users;');
    await migrateUp(db, TEST_DIR);

    await expect(migrateDown(db, TEST_DIR)).rejects.toThrow(DestructiveMigrationError);

    // Nothing was rolled back: the table is still there and the tracking row remains.
    const hasTable = await db.schema.hasTable('users');
    expect(hasTable).toBe(true);
    const applied = await db('migra_migrations').select();
    expect(applied).toHaveLength(1);
  });
});

describe('destructive migration safety gate', () => {
  it('refuses a destructive up migration without --force or confirmation', async () => {
    writeMigration('001_seed.sql', 'CREATE TABLE seed (id INTEGER);', 'DROP TABLE seed;');
    await migrateUp(db, TEST_DIR);

    writeMigration('002_wipe.sql', 'DELETE FROM seed;', 'SELECT 1;');

    await expect(migrateUp(db, TEST_DIR)).rejects.toThrow(DestructiveMigrationError);

    const statuses = await getStatus(db, TEST_DIR);
    const wipe = statuses.find((s) => s.name === '002_wipe.sql');
    expect(wipe?.status).toBe('pending');
  });

  it('runs a destructive up migration when --force is passed', async () => {
    writeMigration('001_seed.sql', 'CREATE TABLE seed (id INTEGER);', 'DROP TABLE seed;');
    await migrateUp(db, TEST_DIR);

    writeMigration('002_wipe.sql', 'DELETE FROM seed;', 'SELECT 1;');

    const results = await migrateUp(db, TEST_DIR, { force: true });
    expect(results).toHaveLength(1);
    expect(results[0].warnings.length).toBeGreaterThan(0);

    const statuses = await getStatus(db, TEST_DIR);
    const wipe = statuses.find((s) => s.name === '002_wipe.sql');
    expect(wipe?.status).toBe('applied');
  });

  it('runs a destructive up migration when confirmFn resolves true', async () => {
    writeMigration('001_seed.sql', 'CREATE TABLE seed (id INTEGER);', 'DROP TABLE seed;');
    await migrateUp(db, TEST_DIR);

    writeMigration('002_wipe.sql', 'DELETE FROM seed;', 'SELECT 1;');
    const confirmFn = vi.fn().mockResolvedValue(true);

    const results = await migrateUp(db, TEST_DIR, { confirmFn });
    expect(confirmFn).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
  });

  it('refuses a destructive up migration when confirmFn resolves false', async () => {
    writeMigration('001_seed.sql', 'CREATE TABLE seed (id INTEGER);', 'DROP TABLE seed;');
    await migrateUp(db, TEST_DIR);

    writeMigration('002_wipe.sql', 'DELETE FROM seed;', 'SELECT 1;');
    const confirmFn = vi.fn().mockResolvedValue(false);

    await expect(migrateUp(db, TEST_DIR, { confirmFn })).rejects.toThrow(
      DestructiveMigrationError
    );
  });
});

describe('transactional atomicity', () => {
  it('rolls back the DDL/DML side effect when the tracking insert fails', async () => {
    // Pre-create migra_migrations with an incompatible schema (a NOT NULL
    // column with no default) so the insert step fails after the migration
    // SQL has already run. Since ensureMigrationsTable only creates the
    // table when it's missing, this custom schema is preserved.
    await db.schema.createTable('migra_migrations', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable().unique();
      table.integer('batch').notNullable();
      table.string('extra').notNullable();
      table.timestamp('applied_at').defaultTo(db.fn.now());
    });

    writeMigration(
      '001_create_widgets.sql',
      'CREATE TABLE widgets (id INTEGER PRIMARY KEY);',
      'DROP TABLE widgets;'
    );

    await expect(migrateUp(db, TEST_DIR)).rejects.toThrow();

    // The CREATE TABLE from the failed migration must be rolled back too,
    // not left dangling with no tracking row.
    const hasTable = await db.schema.hasTable('widgets');
    expect(hasTable).toBe(false);

    const rows = await db('migra_migrations').select();
    expect(rows).toHaveLength(0);
  });
});

describe('getStatus', () => {
  it('shows applied and pending migrations', async () => {
    writeMigration('001_applied.sql', 'CREATE TABLE applied (id INTEGER);', 'DROP TABLE applied;');
    writeMigration('002_pending.sql', 'CREATE TABLE pending (id INTEGER);', 'DROP TABLE pending;');

    await migrateUp(db, TEST_DIR);

    // Add another pending migration
    writeMigration('003_new.sql', 'CREATE TABLE new_table (id INTEGER);', 'DROP TABLE new_table;');

    const statuses = await getStatus(db, TEST_DIR);
    expect(statuses).toHaveLength(3);
    expect(statuses[0].status).toBe('applied');
    expect(statuses[1].status).toBe('applied');
    expect(statuses[2].status).toBe('pending');
  });
});
