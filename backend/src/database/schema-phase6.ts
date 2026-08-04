export const schemaPhase6 = `
-- SMS Messages
CREATE TABLE IF NOT EXISTS sms_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id),
  recipient_type TEXT NOT NULL CHECK(recipient_type IN ('individual', 'group', 'class', 'all_students', 'all_parents', 'all_staff')),
  recipient_group_id TEXT,
  phone_numbers TEXT,
  message TEXT NOT NULL,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'queued', 'sending', 'sent', 'failed')),
  scheduled_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- SMS Recipients (individual tracking)
CREATE TABLE IF NOT EXISTS sms_recipients (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES sms_messages(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TEXT,
  error_message TEXT
);

-- Email Messages
CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id),
  recipient_type TEXT NOT NULL CHECK(recipient_type IN ('individual', 'group', 'class', 'all_students', 'all_parents', 'all_staff')),
  recipient_group_id TEXT,
  email_addresses TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_html INTEGER DEFAULT 0,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'queued', 'sending', 'sent', 'failed')),
  scheduled_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Email Recipients
CREATE TABLE IF NOT EXISTS email_recipients (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES email_messages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at TEXT,
  error_message TEXT
);

-- Announcements / Notices
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK(type IN ('general', 'academic', 'event', 'emergency', 'holiday', 'exam')),
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
  audience TEXT DEFAULT 'all' CHECK(audience IN ('all', 'students', 'parents', 'staff', 'teachers', 'class')),
  audience_id TEXT,
  attachment TEXT,
  is_published INTEGER DEFAULT 0,
  published_at TEXT,
  expires_at TEXT,
  created_by TEXT REFERENCES users(id),
  branch_id TEXT REFERENCES branches(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Notification Templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('sms', 'email', 'both')),
  event TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Communication Log (unified log for audit)
CREATE TABLE IF NOT EXISTS communication_log (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK(channel IN ('sms', 'email', 'notification')),
  reference_id TEXT,
  sender_id TEXT REFERENCES users(id),
  recipient TEXT,
  recipient_name TEXT,
  subject TEXT,
  content TEXT,
  status TEXT DEFAULT 'sent',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sender ON sms_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_sms_recipients_message ON sms_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender ON email_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_message ON email_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);
CREATE INDEX IF NOT EXISTS idx_communication_log_channel ON communication_log(channel);
CREATE INDEX IF NOT EXISTS idx_communication_log_date ON communication_log(created_at);
`;
