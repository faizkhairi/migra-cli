import { describe, it, expect } from 'vitest';
import { checkSafety } from '../src/core/safety.js';

describe('checkSafety', () => {
  it('detects DROP TABLE', () => {
    const warnings = checkSafety('DROP TABLE users;');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].label).toBe('DROP TABLE');
    expect(warnings[0].line).toBe(1);
  });

  it('detects TRUNCATE', () => {
    const warnings = checkSafety('TRUNCATE TABLE orders;');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].label).toBe('TRUNCATE');
  });

  it('detects DELETE FROM', () => {
    const warnings = checkSafety('DELETE FROM sessions WHERE expired = true;');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].label).toBe('DELETE FROM');
  });

  it('detects ALTER TABLE DROP', () => {
    const sql = 'ALTER TABLE users DROP COLUMN email;';
    const warnings = checkSafety(sql);
    expect(warnings.some((w) => w.label.includes('DROP'))).toBe(true);
  });

  it('returns no warnings for safe SQL', () => {
    const sql = `CREATE TABLE users (id SERIAL PRIMARY KEY);
ALTER TABLE users ADD COLUMN name VARCHAR(255);
CREATE INDEX idx_name ON users (name);`;
    expect(checkSafety(sql)).toHaveLength(0);
  });

  it('detects multiple warnings', () => {
    const sql = `DROP TABLE old_users;
TRUNCATE TABLE cache;
DELETE FROM logs;`;
    const warnings = checkSafety(sql);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('reports correct line numbers', () => {
    const sql = `CREATE TABLE foo (id INT);
DROP TABLE bar;
SELECT 1;`;
    const warnings = checkSafety(sql);
    expect(warnings[0].line).toBe(2);
  });
});
