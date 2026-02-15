import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import knex, { type Knex } from 'knex';
import { migrateUp, migrateDown, getStatus } from '../src/core/migrator.js';

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

    const results = await migrateDown(db, TEST_DIR);
    expect(results).toHaveLength(1);
    expect(results[0].direction).toBe('down');

    const hasTable = await db.schema.hasTable('users');
    expect(hasTable).toBe(false);
  });

  it('returns empty for no migrations', async () => {
    const results = await migrateDown(db, TEST_DIR);
    expect(results).toHaveLength(0);
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
