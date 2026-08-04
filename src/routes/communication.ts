import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const communicationRouter = Router();

// Apply tenant middleware to ALL routes
communicationRouter.use(injectTenant);
communicationRouter.use(requireTenant);

// ============ SMS ============

communicationRouter.get('/sms', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', status } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND sm.status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM sms_messages sm ${where}`).get(...params) as any;
  const messages = db.prepare(`
    SELECT sm.*, u.first_name || ' ' || u.last_name as sender_name
    FROM sms_messages sm
    LEFT JOIN users u ON sm.sender_id = u.id
    ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: messages, total: total.count, page: parseInt(page), limit: lim });
});

communicationRouter.post('/sms', authorize('platform_admin', 'institution_admin', 'branch_admin', 'principal'), (req: AuthRequest, res: Response) => {
  try {
    const { recipient_type, recipient_group_id, phone_numbers, message, scheduled_at } = req.body;
    if (!recipient_type || !message) {
      res.status(400).json({ error: 'Recipient type and message are required' });
      return;
    }

    const db = getDatabase();
    const id = generateId();

  let phones: string[] = [];
  if (recipient_type === 'individual' && phone_numbers) {
    phones = Array.isArray(phone_numbers) ? phone_numbers : phone_numbers.split(',').map((p: string) => p.trim());
  } else if (recipient_type === 'all_parents') {
    phones = (db.prepare("SELECT DISTINCT phone FROM parents WHERE phone IS NOT NULL AND phone != ''").all() as any[]).map(r => r.phone);
  } else if (recipient_type === 'all_staff') {
    phones = (db.prepare("SELECT DISTINCT phone FROM employees WHERE phone IS NOT NULL AND phone != '' AND is_active = 1").all() as any[]).map(r => r.phone);
  } else if (recipient_type === 'all_students') {
    phones = (db.prepare("SELECT DISTINCT phone FROM students WHERE phone IS NOT NULL AND phone != '' AND status = 'active'").all() as any[]).map(r => r.phone);
  } else if (recipient_type === 'class' && recipient_group_id) {
    phones = (db.prepare(`
      SELECT DISTINCT p.phone FROM parents p
      JOIN student_parents sp ON p.id = sp.parent_id
      JOIN students s ON sp.student_id = s.id
      WHERE s.class_id = ? AND p.phone IS NOT NULL AND p.phone != ''
    `).all(recipient_group_id) as any[]).map(r => r.phone);
  }

  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO sms_messages (id, sender_id, recipient_type, recipient_group_id, phone_numbers, message, total_recipients, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, req.user?.id || null, recipient_type, recipient_group_id || null,
      phones.join(','), message, phones.length,
      scheduled_at ? 'queued' : 'sent', scheduled_at || null
    );

    const insertRecipient = db.prepare('INSERT INTO sms_recipients (id, message_id, phone, status) VALUES (?, ?, ?, ?)');
    for (const phone of phones) {
      insertRecipient.run(generateId(), id, phone, scheduled_at ? 'pending' : 'sent');
    }

    if (!scheduled_at) {
      db.prepare("UPDATE sms_messages SET sent_count = ?, sent_at = datetime('now') WHERE id = ?").run(phones.length, id);
    }

    db.prepare('INSERT INTO communication_log (id, channel, reference_id, sender_id, recipient, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      generateId(), 'sms', id, req.user?.id || null, `${phones.length} recipients`, message, 'sent'
    );
  });

  transaction();
  res.status(201).json({ id, total_recipients: phones.length, message: 'SMS sent successfully' });
  } catch (err: any) {
    console.error('SMS send error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

communicationRouter.get('/sms/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const msg = db.prepare(`
    SELECT sm.*, u.first_name || ' ' || u.last_name as sender_name
    FROM sms_messages sm LEFT JOIN users u ON sm.sender_id = u.id WHERE sm.id = ?
  `).get(id) as any;
  if (!msg) { res.status(404).json({ error: 'Message not found' }); return; }
  const recipients = db.prepare('SELECT * FROM sms_recipients WHERE message_id = ?').all(id);
  res.json({ message: msg, recipients });
});

// ============ EMAIL ============

communicationRouter.get('/emails', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', status } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND em.status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM email_messages em ${where}`).get(...params) as any;
  const messages = db.prepare(`
    SELECT em.*, u.first_name || ' ' || u.last_name as sender_name
    FROM email_messages em
    LEFT JOIN users u ON em.sender_id = u.id
    ${where} ORDER BY em.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: messages, total: total.count, page: parseInt(page), limit: lim });
});

communicationRouter.post('/emails', authorize('platform_admin', 'institution_admin', 'branch_admin', 'principal'), (req: AuthRequest, res: Response) => {
  try {
    const { recipient_type, recipient_group_id, email_addresses, subject, body, is_html, scheduled_at } = req.body;
    if (!recipient_type || !subject || !body) {
      res.status(400).json({ error: 'Recipient type, subject and body are required' });
      return;
    }

    const db = getDatabase();
    const id = generateId();

  let emails: string[] = [];
  if (recipient_type === 'individual' && email_addresses) {
    emails = Array.isArray(email_addresses) ? email_addresses : email_addresses.split(',').map((e: string) => e.trim());
  } else if (recipient_type === 'all_parents') {
    emails = (db.prepare("SELECT DISTINCT email FROM parents WHERE email IS NOT NULL AND email != ''").all() as any[]).map(r => r.email);
  } else if (recipient_type === 'all_staff') {
    emails = (db.prepare("SELECT DISTINCT email FROM employees WHERE email IS NOT NULL AND email != '' AND is_active = 1").all() as any[]).map(r => r.email);
  } else if (recipient_type === 'all_students') {
    emails = (db.prepare("SELECT DISTINCT email FROM students WHERE email IS NOT NULL AND email != '' AND status = 'active'").all() as any[]).map(r => r.email);
  } else if (recipient_type === 'class' && recipient_group_id) {
    emails = (db.prepare(`
      SELECT DISTINCT p.email FROM parents p
      JOIN student_parents sp ON p.id = sp.parent_id
      JOIN students s ON sp.student_id = s.id
      WHERE s.class_id = ? AND p.email IS NOT NULL AND p.email != ''
    `).all(recipient_group_id) as any[]).map(r => r.email);
  }

  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO email_messages (id, sender_id, recipient_type, recipient_group_id, email_addresses, subject, body, is_html, total_recipients, status, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, req.user?.id || null, recipient_type, recipient_group_id || null,
      emails.join(','), subject, body, is_html ? 1 : 0, emails.length,
      scheduled_at ? 'queued' : 'sent', scheduled_at || null
    );

    const insertRecipient = db.prepare('INSERT INTO email_recipients (id, message_id, email, status) VALUES (?, ?, ?, ?)');
    for (const email of emails) {
      insertRecipient.run(generateId(), id, email, scheduled_at ? 'pending' : 'sent');
    }

    if (!scheduled_at) {
      db.prepare("UPDATE email_messages SET sent_count = ?, sent_at = datetime('now') WHERE id = ?").run(emails.length, id);
    }

    db.prepare('INSERT INTO communication_log (id, channel, reference_id, sender_id, recipient, subject, content, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      generateId(), 'email', id, req.user?.id || null, `${emails.length} recipients`, subject, body.substring(0, 200), 'sent'
    );
  });

  transaction();
  res.status(201).json({ id, total_recipients: emails.length, message: 'Email sent successfully' });
  } catch (err: any) {
    console.error('Email send error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

communicationRouter.get('/emails/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  const msg = db.prepare(`
    SELECT em.*, u.first_name || ' ' || u.last_name as sender_name
    FROM email_messages em LEFT JOIN users u ON em.sender_id = u.id WHERE em.id = ?
  `).get(id) as any;
  if (!msg) { res.status(404).json({ error: 'Email not found' }); return; }
  const recipients = db.prepare('SELECT * FROM email_recipients WHERE message_id = ?').all(id);
  res.json({ email: msg, recipients });
});

// ============ ANNOUNCEMENTS ============

communicationRouter.get('/announcements', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '20', type, audience, published } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (type) { where += ' AND a.type = ?'; params.push(type); }
  if (audience) { where += ' AND a.audience = ?'; params.push(audience); }
  if (published !== undefined) { where += ' AND a.is_published = ?'; params.push(parseInt(published)); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM announcements a ${where}`).get(...params) as any;
  const announcements = db.prepare(`
    SELECT a.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: announcements, total: total.count, page: parseInt(page), limit: lim });
});

communicationRouter.post('/announcements', authorize('platform_admin', 'institution_admin', 'branch_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { title, content, type, priority, audience, audience_id, expires_at, is_published } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required' });
    return;
  }

  const db = getDatabase();
  const id = generateId();
  const published = is_published ? 1 : 0;
  db.prepare(`INSERT INTO announcements (id, title, content, type, priority, audience, audience_id, expires_at, is_published, published_at, created_by, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, title, content, type || 'general', priority || 'normal',
    audience || 'all', audience_id || null, expires_at || null,
    published, published ? new Date().toISOString() : null,
    req.user?.id || null, req.user?.branch_id || null
  );

  res.status(201).json({ id, message: 'Announcement created' });
});

communicationRouter.put('/announcements/:id', authorize('platform_admin', 'institution_admin', 'branch_admin', 'principal'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, content, type, priority, audience, audience_id, expires_at, is_published } = req.body;
  const db = getDatabase();

  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as any;
  if (!existing) { res.status(404).json({ error: 'Announcement not found' }); return; }

  const published = is_published ? 1 : 0;
  db.prepare(`UPDATE announcements SET title = ?, content = ?, type = ?, priority = ?, audience = ?, audience_id = ?, expires_at = ?, is_published = ?, published_at = ?, updated_at = datetime('now') WHERE id = ?`).run(
    title || existing.title, content || existing.content, type || existing.type,
    priority || existing.priority, audience || existing.audience,
    audience_id || existing.audience_id, expires_at || existing.expires_at,
    published, published && !existing.is_published ? new Date().toISOString() : existing.published_at, id
  );

  res.json({ message: 'Announcement updated' });
});

communicationRouter.delete('/announcements/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  res.json({ message: 'Announcement deleted' });
});

// ============ NOTIFICATION TEMPLATES ============

communicationRouter.get('/templates', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const templates = db.prepare('SELECT * FROM notification_templates WHERE is_active = 1 ORDER BY event').all();
  res.json(templates);
});

communicationRouter.post('/templates', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { name, type, event, subject, body, variables } = req.body;
  if (!name || !type || !event || !body) {
    res.status(400).json({ error: 'Name, type, event and body are required' });
    return;
  }
  const db = getDatabase();
  const id = generateId();
  db.prepare('INSERT INTO notification_templates (id, name, type, event, subject, body, variables) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, name, type, event, subject || null, body, variables || null
  );
  res.status(201).json({ id, message: 'Template created' });
});

communicationRouter.put('/templates/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, type, event, subject, body, variables, is_active } = req.body;
  const db = getDatabase();
  db.prepare('UPDATE notification_templates SET name = ?, type = ?, event = ?, subject = ?, body = ?, variables = ?, is_active = ? WHERE id = ?').run(
    name, type, event, subject || null, body, variables || null, is_active !== undefined ? is_active : 1, id
  );
  res.json({ message: 'Template updated' });
});

communicationRouter.delete('/templates/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDatabase();
  db.prepare('DELETE FROM notification_templates WHERE id = ?').run(id);
  res.json({ message: 'Template deleted' });
});

// ============ COMMUNICATION LOG ============

communicationRouter.get('/log', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '50', channel } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (channel) { where += ' AND cl.channel = ?'; params.push(channel); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM communication_log cl ${where}`).get(...params) as any;
  const logs = db.prepare(`
    SELECT cl.*, u.first_name || ' ' || u.last_name as sender_name
    FROM communication_log cl
    LEFT JOIN users u ON cl.sender_id = u.id
    ${where} ORDER BY cl.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: logs, total: total.count, page: parseInt(page), limit: lim });
});
