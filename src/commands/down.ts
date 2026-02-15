import chalk from 'chalk';
import ora from 'ora';
import type { Knex } from 'knex';
import { migrateDown } from '../core/migrator.js';
import type { MigraConfig } from '../types.js';

export async function down(db: Knex, config: MigraConfig): Promise<void> {
  const spinner = ora('Rolling back last batch...').start();

  try {
    const results = await migrateDown(db, config.migrationsDir);

    if (results.length === 0) {
      spinner.info('Nothing to rollback');
      return;
    }

    spinner.succeed(`Rolled back ${results.length} migration(s)`);

    for (const r of results) {
      console.log(chalk.red(`  ↩ ${r.name}`));
      for (const w of r.warnings) {
        console.log(chalk.yellow(`    ⚠ ${w}`));
      }
    }
  } catch (err) {
    spinner.fail('Rollback failed');
    console.error(chalk.red(`  ${(err as Error).message}`));
    process.exit(1);
  }
}
