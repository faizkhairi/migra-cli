/**
 * Parse a SQL migration file into UP and DOWN sections.
 * Format:
 *   -- UP
 *   CREATE TABLE ...;
 *   -- DOWN
 *   DROP TABLE ...;
 */
export function parseMigration(content: string): { up: string; down: string } {
  const upMatch = content.match(/--\s*UP\s*\n([\s\S]*?)(?=--\s*DOWN|$)/i);
  const downMatch = content.match(/--\s*DOWN\s*\n([\s\S]*?)$/i);

  return {
    up: upMatch?.[1]?.trim() || '',
    down: downMatch?.[1]?.trim() || '',
  };
}

/**
 * Generate a timestamped migration filename.
 */
export function generateMigrationName(description: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${timestamp}_${slug}.sql`;
}
