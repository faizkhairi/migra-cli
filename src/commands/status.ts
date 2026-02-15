import chalk from 'chalk';
import Table from 'cli-table3';
import type { Knex } from 'knex';
import { getStatus } from '../core/migrator.js';
import type { MigraConfig } from '../types.js';

export async function status(db: Knex, config: MigraConfig): Promise<void> {
  const statuses = await getStatus(db, config.migrationsDir);

  if (statuses.length === 0) {
    console.log(chalk.dim('  No migrations found'));
    return;
  }

  const table = new Table({
    head: [chalk.white('Status'), chalk.white('Batch'), chalk.white('Migration')],
    style: { head: [], border: [] },
  });

  for (const s of statuses) {
    table.push([
      s.status === 'applied'
        ? chalk.green('Applied')
        : chalk.yellow('Pending'),
      s.batch?.toString() ?? chalk.dim('-'),
      s.name,
    ]);
  }

  console.log(table.toString());
}
