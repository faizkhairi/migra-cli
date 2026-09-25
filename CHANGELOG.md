# Changelog

All notable changes to this project are documented in this file.

## 2.0.0

### Breaking

- `up` and `down` now refuse to run a migration that contains a destructive
  statement (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`,
  `ALTER TABLE ... DROP`) unless you confirm interactively (TTY only) or pass
  `--force`. In a non-interactive context (CI, scripts) without `--force`,
  the command now exits non-zero instead of applying the migration. Automated
  destructive runs (CI pipelines, deploy scripts) need `--force` added to
  their `migra up` / `migra down` invocation.

### Fixed

- Each migration's SQL and its `migra_migrations` tracking row now run
  inside a single database transaction, instead of two unguarded
  sequential statements. Previously, a failure between the SQL statement
  and the tracking insert (or a partially failing multi-statement
  migration) could leave the database and the tracking table out of sync.
  Note this is a strong guarantee on PostgreSQL; MySQL implicitly commits
  DDL, and SQLite implicitly commits some DDL forms, so atomicity there is
  best-effort, see the README "Transactions and DDL" section.
- Destructive-statement warnings were previously computed but only printed
  after a migration had already run; they now gate execution instead.

### Added

- `--force` / `-f` flag on both `migra up` and `migra down` to skip the
  destructive-statement confirmation.
- `DestructiveMigrationError`, exported from `src/core/migrator.ts`, thrown
  when a destructive migration is refused.
- Shared `confirm()` prompt helper at `src/core/prompt.ts` (used by both
  `up` and `down`; previously duplicated in `down.ts` only).

## Migration from 1.x

If you run `migra up` or `migra down` in CI or any non-interactive script and
your migrations contain destructive statements, add `--force` to that
invocation, or switch the migration to a non-destructive equivalent. Without
this change, those runs will now exit non-zero instead of applying the
migration.

## 1.0.2 and earlier

No changelog was kept prior to 2.0.0. See git history for details.
