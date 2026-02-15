export interface MigraConfig {
  client: 'pg' | 'mysql2' | 'better-sqlite3';
  connection: string | object;
  migrationsDir: string;
}

export interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
}

export interface MigrationRecord {
  id: number;
  name: string;
  batch: number;
  applied_at: string;
}

export type TemplateType =
  | 'create-table'
  | 'add-column'
  | 'add-index'
  | 'add-foreign-key'
  | 'blank';
