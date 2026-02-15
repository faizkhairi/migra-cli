/**
 * Detect destructive SQL operations that need user confirmation.
 */

const DESTRUCTIVE_PATTERNS = [
  { pattern: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE' },
  { pattern: /\bDROP\s+COLUMN\b/i, label: 'DROP COLUMN' },
  { pattern: /\bTRUNCATE\b/i, label: 'TRUNCATE' },
  { pattern: /\bDELETE\s+FROM\b/i, label: 'DELETE FROM' },
  { pattern: /\bALTER\s+TABLE\s+\S+\s+DROP\b/i, label: 'ALTER TABLE DROP' },
];

export interface SafetyWarning {
  label: string;
  line: number;
}

export function checkSafety(sql: string): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];
  const lines = sql.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(line)) {
        warnings.push({ label, line: i + 1 });
      }
    }
  }

  return warnings;
}
