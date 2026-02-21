#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { status } from './commands/status.js';
import { getConnection, closeConnection } from './core/connection.js';
import type { MigraConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };

const program = new Command();

function loadConfig(): MigraConfig {
  if (!existsSync('migra.json')) {
    console.error('  migra.json not found. Run `migra init` first.');
    process.exit(1);
  }
  return JSON.parse(readFileSync('migra.json', 'utf-8'));
}

program
  .name('migra')
  .description('Database migration tool with rollback and safety checks')
  .version(pkg.version);

program
  .command('init')
  .description('Initialize migra in the current directory')
  .action(() => {
    init();
  });

program
  .command('generate')
  .description('Generate a new migration file')
  .argument('<description>', 'Migration description (e.g. "create users table")')
  .option('-t, --template <type>', 'Template: create-table, add-column, add-index, add-foreign-key, blank', 'blank')
  .action((description: string, opts) => {
    const config = loadConfig();
    generate(description, config, opts.template);
  });

program
  .command('up')
  .description('Run all pending migrations')
  .action(async () => {
    const config = loadConfig();
    const db = getConnection(config);
    await up(db, config);
    await closeConnection();
  });

program
  .command('down')
  .description('Rollback the last batch of migrations')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (opts) => {
    const config = loadConfig();
    const db = getConnection(config);
    await down(db, config, { yes: opts.yes });
    await closeConnection();
  });

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    const config = loadConfig();
    const db = getConnection(config);
    await status(db, config);
    await closeConnection();
  });

program.parse();
