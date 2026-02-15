import { describe, it, expect } from 'vitest';
import { parseMigration, generateMigrationName } from '../src/core/parser.js';

describe('parseMigration', () => {
  it('parses UP and DOWN sections', () => {
    const content = `-- UP
CREATE TABLE users (id SERIAL PRIMARY KEY);

-- DOWN
DROP TABLE users;`;

    const result = parseMigration(content);
    expect(result.up).toBe('CREATE TABLE users (id SERIAL PRIMARY KEY);');
    expect(result.down).toBe('DROP TABLE users;');
  });

  it('handles multi-line SQL', () => {
    const content = `-- UP
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)
);

-- DOWN
DROP TABLE users;`;

    const result = parseMigration(content);
    expect(result.up).toContain('id SERIAL PRIMARY KEY');
    expect(result.up).toContain('name VARCHAR(255)');
  });

  it('returns empty strings for missing sections', () => {
    const result = parseMigration('-- just a comment');
    expect(result.up).toBe('');
    expect(result.down).toBe('');
  });

  it('handles case-insensitive markers', () => {
    const content = `-- up
SELECT 1;
-- down
SELECT 2;`;

    const result = parseMigration(content);
    expect(result.up).toBe('SELECT 1;');
    expect(result.down).toBe('SELECT 2;');
  });
});

describe('generateMigrationName', () => {
  it('generates a timestamped filename', () => {
    const name = generateMigrationName('create users table');
    expect(name).toMatch(/^\d{14}_create_users_table\.sql$/);
  });

  it('slugifies special characters', () => {
    const name = generateMigrationName('add email-index to users!');
    expect(name).toMatch(/^\d{14}_add_email_index_to_users\.sql$/);
  });

  it('handles empty description', () => {
    const name = generateMigrationName('');
    expect(name).toMatch(/^\d{14}_\.sql$/);
  });
});
