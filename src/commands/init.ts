import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';

const DEFAULT_CONFIG = `{
  "client": "better-sqlite3",
  "connection": "./dev.db",
  "migrationsDir": "./migrations"
}
`;

export function init(): void {
  if (existsSync('migra.json')) {
    console.log(chalk.yellow('  migra.json already exists'));
    return;
  }

  writeFileSync('migra.json', DEFAULT_CONFIG, 'utf-8');
  mkdirSync('migrations', { recursive: true });

  console.log(chalk.green('  Created migra.json'));
  console.log(chalk.green('  Created migrations/ directory'));
  console.log();
  console.log(chalk.dim('  Edit migra.json to configure your database connection.'));
}
