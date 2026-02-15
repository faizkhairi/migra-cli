import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { generateMigrationName } from '../core/parser.js';
import { getTemplate, TEMPLATE_TYPES } from '../templates/index.js';
import type { MigraConfig, TemplateType } from '../types.js';

export function generate(
  description: string,
  config: MigraConfig,
  templateType?: string
): void {
  const template = templateType || 'blank';

  if (!TEMPLATE_TYPES.includes(template as TemplateType)) {
    console.log(
      chalk.red(`  Unknown template: ${template}`)
    );
    console.log(
      chalk.dim(`  Available: ${TEMPLATE_TYPES.join(', ')}`)
    );
    return;
  }

  const fileName = generateMigrationName(description);
  const filePath = join(config.migrationsDir, fileName);
  const content = getTemplate(template as TemplateType);

  writeFileSync(filePath, content, 'utf-8');
  console.log(chalk.green(`  Created ${filePath}`));
}
