# migra-cli

![CI](https://github.com/faizkhairi/migra-cli/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/@faizkhairi/migra-cli)

A database migration tool CLI with rollback support, destructive operation safety checks, and SQL template generation.

## Features

- **Generate migrations** — Timestamped SQL files with UP/DOWN sections
- **Run pending** — Apply all pending migrations with batch tracking
- **Rollback** — Undo the last batch of migrations
- **Status table** — See applied vs pending migrations at a glance
- **Safety checks**: Refuses to run DROP TABLE, TRUNCATE, DELETE FROM, DROP COLUMN, or ALTER TABLE ... DROP unless confirmed or run with `--force`
- **Transactional**: Each migration's SQL and its tracking row are applied in a single database transaction
- **Templates** — create-table, add-column, add-index, add-foreign-key
- **Multi-database** — PostgreSQL, MySQL, SQLite via Knex.js

## Install

```bash
npm install -g @faizkhairi/migra-cli
```

## Quick Start

```bash
# Initialize in your project
migra init

# Generate a migration
migra generate "create users table" --template create-table

# Edit the generated SQL file, then run it
migra up

# Check status
migra status

# Rollback
migra down
```

## Commands

| Command | Description |
|---|---|
| `migra init` | Create `migra.json` config and `migrations/` directory |
| `migra generate <desc>` | Generate a timestamped migration file |
| `migra up [--force]` | Run all pending migrations |
| `migra down [--yes] [--force]` | Rollback the last batch |
| `migra status` | Show applied vs pending migrations |

### Destructive migration safety

Before running a migration, `migra` scans its SQL for destructive statements
(`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, `ALTER TABLE ... DROP`).
If any are found:

- In a TTY, you'll be asked to confirm before it runs.
- Outside a TTY (CI, scripts) it is refused and the process exits non-zero.
- Pass `--force` (or `-f`) to `up`/`down` to skip the prompt and run anyway.

This applies to both `up` and `down`: a `DOWN` section that drops what its
`UP` created is destructive too, and needs `--force` (or confirmation) the
same as any other destructive statement.

### Transactions and DDL

Each migration's SQL and its `migra_migrations` tracking row are executed in
a single database transaction, so a failure partway through (a bad statement,
or the tracking insert itself failing) leaves neither applied. On
**PostgreSQL**, DDL is transactional, so this gives you a real all-or-nothing
guarantee. On **MySQL**, DDL statements implicitly commit the current
transaction, so a `CREATE TABLE`/`ALTER TABLE` cannot be rolled back once it
runs; only the parts of the migration before/after that point are protected.
**SQLite** supports transactional DDL for most statements, but some
operations (certain `ALTER TABLE` forms) still cause an implicit commit.
Design migrations to be safely re-run (e.g. `CREATE TABLE IF NOT EXISTS`)
when targeting MySQL.

### Generate Options

```bash
migra generate "add email index" --template add-index
```

Templates: `create-table`, `add-column`, `add-index`, `add-foreign-key`, `blank`

## Configuration

`migra.json`:

```json
{
  "client": "better-sqlite3",
  "connection": "./dev.db",
  "migrationsDir": "./migrations"
}
```

### PostgreSQL

```json
{
  "client": "pg",
  "connection": "postgresql://user:pass@localhost:5432/mydb",
  "migrationsDir": "./migrations"
}
```

### MySQL

```json
{
  "client": "mysql2",
  "connection": "mysql://user:pass@localhost:3306/mydb",
  "migrationsDir": "./migrations"
}
```

## Migration File Format

```sql
-- UP
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS users;
```

## Project Structure

```
migra-cli/
├── src/
│   ├── index.ts              # CLI entry (Commander.js)
│   ├── types.ts              # TypeScript interfaces
│   ├── commands/
│   │   ├── init.ts           # Initialize project
│   │   ├── generate.ts       # Generate migration files
│   │   ├── up.ts             # Run pending migrations
│   │   ├── down.ts           # Rollback last batch
│   │   └── status.ts         # Show migration status
│   ├── core/
│   │   ├── migrator.ts       # Migration execution engine
│   │   ├── parser.ts         # SQL UP/DOWN parser
│   │   ├── safety.ts         # Destructive operation detector
│   │   └── connection.ts     # Knex connection manager
│   └── templates/
│       └── index.ts          # SQL migration templates
└── tests/
    ├── parser.test.ts        # SQL parser tests
    ├── safety.test.ts        # Safety check tests
    └── migrator.test.ts      # Full migration lifecycle (SQLite in-memory)
```

## License

MIT
