#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { status } from './commands/status.js';
import { getConnection, closeConnection } from './core/connection.js';
import type { MigraConfig } from './types.js';

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
  .version('1.0.0');

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
  .action(async () => {
    const config = loadConfig();
    const db = getConnection(config);
    await down(db, config);
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
