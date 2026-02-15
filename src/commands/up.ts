import chalk from 'chalk';
import ora from 'ora';
import type { Knex } from 'knex';
import { migrateUp } from '../core/migrator.js';
import type { MigraConfig } from '../types.js';

export async function up(db: Knex, config: MigraConfig): Promise<void> {
  const spinner = ora('Running pending migrations...').start();

  try {
    const results = await migrateUp(db, config.migrationsDir);

    if (results.length === 0) {
      spinner.info('No pending migrations');
      return;
    }

    spinner.succeed(`Applied ${results.length} migration(s)`);

    for (const r of results) {
      console.log(chalk.green(`  ✓ ${r.name}`));
      for (const w of r.warnings) {
        console.log(chalk.yellow(`    ⚠ ${w}`));
      }
    }
  } catch (err) {
    spinner.fail('Migration failed');
    console.error(chalk.red(`  ${(err as Error).message}`));
    process.exit(1);
  }
}
