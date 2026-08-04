import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const communicationRouter = Router();

// Apply tenant middleware to ALL routes
communicationRouter.use(injectTenant);
communicationRouter.use(requireTenant);

// SMS - List
communicationRouter.get('/sms', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { page = '1', limit = '20' } = req.query as any;
    const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

    const total = db.prepare('SELECT COUNT(*) as count FROM sms_messages').get() as any;
    const messages = db.prepare('SELECT * FROM sms_messages ORDER BY created_at DESC LIMIT ? OFFSET ?').all(lim, offset);

    res.json({ data: messages, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SMS - Send
communicationRouter.post('/sms', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const { phone_numbers, message } = req.body;
    if (!phone_numbers || !message) {
      res.status(400).json({ error: 'Phone numbers and message required' });
      return;
    }

    const db = getDatabase();
    const id = generateId();
    const phones = Array.isArray(phone_numbers) ? phone_numbers : phone_numbers.split(',').map((p: string) => p.trim());

    db.prepare('INSERT INTO sms_messages (id, sender_id, recipient_type, phone_numbers, message, total_recipients, sent_count, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))').run(
      id, req.user?.id || null, 'individual', phones.join(','), message, phones.length, phones.length, 'sent'
    );

    res.status(201).json({ id, total_recipients: phones.length, message: 'SMS sent' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Emails - List
communicationRouter.get('/emails', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { page = '1', limit = '20' } = req.query as any;
    const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

    const total = db.prepare('SELECT COUNT(*) as count FROM email_messages').get() as any;
    const messages = db.prepare('SELECT * FROM email_messages ORDER BY created_at DESC LIMIT ? OFFSET ?').all(lim, offset);

    res.json({ data: messages, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Emails - Send
communicationRouter.post('/emails', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const { email_addresses, subject, body } = req.body;
    if (!email_addresses || !subject || !body) {
      res.status(400).json({ error: 'Email addresses, subject and body required' });
      return;
    }

    const db = getDatabase();
    const id = generateId();
    const emails = Array.isArray(email_addresses) ? email_addresses : email_addresses.split(',').map((e: string) => e.trim());

    db.prepare('INSERT INTO email_messages (id, sender_id, recipient_type, email_addresses, subject, body, total_recipients, sent_count, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))').run(
      id, req.user?.id || null, 'individual', emails.join(','), subject, body, emails.length, emails.length, 'sent'
    );

    res.status(201).json({ id, total_recipients: emails.length, message: 'Email sent' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Announcements - List
communicationRouter.get('/announcements', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { page = '1', limit = '20', published } = req.query as any;
    const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (published !== undefined) { where += ' AND is_published = ?'; params.push(parseInt(published)); }

    const total = db.prepare(`SELECT COUNT(*) as count FROM announcements ${where}`).get(...params) as any;
    const announcements = db.prepare(`SELECT * FROM announcements ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, lim, offset);

    res.json({ data: announcements, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Announcements - Create
communicationRouter.post('/announcements', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const { title, content, type, priority, audience, is_published } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content required' });
      return;
    }

    const db = getDatabase();
    const id = generateId();
    const published = is_published ? 1 : 0;

    db.prepare('INSERT INTO announcements (id, institution_id, title, content, type, priority, audience, is_published, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, req.institution_id, title, content, type || 'general', priority || 'normal', audience || 'all',
      published, published ? new Date().toISOString() : null, req.user?.id || null
    );

    res.status(201).json({ id, message: 'Announcement created' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Announcements - Delete
communicationRouter.delete('/announcements/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
    res.json({ message: 'Announcement deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Templates - List
communicationRouter.get('/templates', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const templates = db.prepare('SELECT * FROM notification_templates WHERE is_active = 1 ORDER BY event').all();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Templates - Create
communicationRouter.post('/templates', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const { name, type, event, subject, body, variables } = req.body;
    if (!name || !type || !event || !body) {
      res.status(400).json({ error: 'Name, type, event and body required' });
      return;
    }

    const db = getDatabase();
    const id = generateId();
    db.prepare('INSERT INTO notification_templates (id, name, type, event, subject, body, variables) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, name, type, event, subject || null, body, variables || null
    );

    res.status(201).json({ id, message: 'Template created' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Templates - Delete
communicationRouter.delete('/templates/:id', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM notification_templates WHERE id = ?').run(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Communication Log
communicationRouter.get('/log', (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase();
    const { page = '1', limit = '50' } = req.query as any;
    const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

    const total = db.prepare('SELECT COUNT(*) as count FROM communication_log').get() as any;
    const logs = db.prepare('SELECT * FROM communication_log ORDER BY created_at DESC LIMIT ? OFFSET ?').all(lim, offset);

    res.json({ data: logs, total: total.count, page: parseInt(page), limit: lim });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
