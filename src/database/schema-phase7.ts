export const schemaPhase7 = `
-- Reports Configuration
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('student', 'financial', 'academic', 'attendance', 'staff', 'custom')),
  description TEXT,
  query_template TEXT,
  parameters TEXT,
  format TEXT DEFAULT 'pdf' CHECK(format IN ('pdf', 'excel', 'csv')),
  is_active INTEGER DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Generated Reports Log
CREATE TABLE IF NOT EXISTS report_logs (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES report_templates(id),
  generated_by TEXT REFERENCES users(id),
  parameters TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'generating', 'completed', 'failed')),
  generated_at TEXT DEFAULT (datetime('now')),
  download_count INTEGER DEFAULT 0
);

-- System Backups
CREATE TABLE IF NOT EXISTS system_backups (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('full', 'database', 'files')),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
  initiated_by TEXT REFERENCES users(id),
  completed_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Activity Dashboard Stats (cached)
CREATE TABLE IF NOT EXISTS dashboard_stats (
  id TEXT PRIMARY KEY,
  stat_key TEXT NOT NULL UNIQUE,
  stat_value TEXT NOT NULL,
  category TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Custom Fields (extensibility)
CREATE TABLE IF NOT EXISTS custom_fields (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('student', 'teacher', 'parent', 'class', 'subject')),
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK(field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'textarea')),
  field_options TEXT,
  is_required INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(entity_type, field_name)
);

-- Custom Field Values
CREATE TABLE IF NOT EXISTS custom_field_values (
  id TEXT PRIMARY KEY,
  field_id TEXT REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  field_value TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(field_id, entity_id)
);

-- System Settings (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'string' CHECK(setting_type IN ('string', 'number', 'boolean', 'json')),
  category TEXT DEFAULT 'general',
  description TEXT,
  is_public INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Bulk Operations Log
CREATE TABLE IF NOT EXISTS bulk_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  initiated_by TEXT REFERENCES users(id),
  file_path TEXT,
  error_log TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Performance Metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_logs_generated ON report_logs(generated_at);
CREATE INDEX IF NOT EXISTS idx_backups_created ON system_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(entity_id);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
`;
