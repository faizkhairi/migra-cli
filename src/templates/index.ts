import type { TemplateType } from '../types.js';

const templates: Record<TemplateType, string> = {
  'create-table': `-- UP
CREATE TABLE table_name (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS table_name;
`,

  'add-column': `-- UP
ALTER TABLE table_name
  ADD COLUMN column_name VARCHAR(255);

-- DOWN
ALTER TABLE table_name
  DROP COLUMN column_name;
`,

  'add-index': `-- UP
CREATE INDEX idx_table_column ON table_name (column_name);

-- DOWN
DROP INDEX IF EXISTS idx_table_column;
`,

  'add-foreign-key': `-- UP
ALTER TABLE child_table
  ADD CONSTRAINT fk_child_parent
  FOREIGN KEY (parent_id) REFERENCES parent_table (id)
  ON DELETE CASCADE;

-- DOWN
ALTER TABLE child_table
  DROP CONSTRAINT fk_child_parent;
`,

  blank: `-- UP


-- DOWN

`,
};

export function getTemplate(type: TemplateType): string {
  return templates[type];
}

export const TEMPLATE_TYPES = Object.keys(templates) as TemplateType[];
