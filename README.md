# migra-cli

A database migration tool CLI with rollback support, destructive operation safety checks, and SQL template generation.

## Features

- **Generate migrations** — Timestamped SQL files with UP/DOWN sections
- **Run pending** — Apply all pending migrations with batch tracking
- **Rollback** — Undo the last batch of migrations
- **Status table** — See applied vs pending migrations at a glance
- **Safety checks** — Warns on DROP TABLE, TRUNCATE, DELETE FROM
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
| `migra up` | Run all pending migrations |
| `migra down` | Rollback the last batch |
| `migra status` | Show applied vs pending migrations |

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
