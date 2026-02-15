import knex, { type Knex } from 'knex';
import type { MigraConfig } from '../types.js';

let db: Knex | null = null;

export function getConnection(config: MigraConfig): Knex {
  if (db) return db;

  db = knex({
    client: config.client,
    connection: config.connection,
    useNullAsDefault: true,
  });

  return db;
}

export async function closeConnection(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}

/**
 * Ensure the migrations tracking table exists.
 */
export async function ensureMigrationsTable(connection: Knex): Promise<void> {
  const exists = await connection.schema.hasTable('migra_migrations');
  if (!exists) {
    await connection.schema.createTable('migra_migrations', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable().unique();
      table.integer('batch').notNullable();
      table.timestamp('applied_at').defaultTo(connection.fn.now());
    });
  }
}
