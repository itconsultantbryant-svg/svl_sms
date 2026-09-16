import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId } from '../utils/helpers';

export const notificationsRouter = Router();
notificationsRouter.use(injectTenant);
notificationsRouter.use(requireTenant);

function audienceMatches(userType: string | undefined, audience: string): boolean {
  if (!audience || audience === 'all') return true;
  if (audience === 'students' && userType === 'student') return true;
  if (audience === 'parents' && userType === 'parent') return true;
  if (audience === 'teachers' && userType === 'teacher') return true;
  if (audience === 'staff' && ['staff', 'institution_admin', 'finance_officer', 'accountant'].includes(userType || '')) return true;
  if (['platform_admin', 'institution_admin'].includes(userType || '')) return true;
  return false;
}

notificationsRouter.get('/inbox', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const notifications = db.prepare(`
    SELECT n.*,
      CASE WHEN n.is_acknowledged = 1 THEN 1 ELSE 0 END as acknowledged
    FROM notifications n
    WHERE n.user_id = ? AND (? IS NULL OR n.institution_id = ?)
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(userId, req.institution_id || null, req.institution_id || null) as any[];

  const announcements = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM announcement_acknowledgements ack
       WHERE ack.announcement_id = a.id AND ack.user_id = ?) as acknowledged
    FROM announcements a
    WHERE a.institution_id = ?
      AND a.is_published = 1
      AND (a.expires_at IS NULL OR a.expires_at >= date('now'))
    ORDER BY a.published_at DESC, a.created_at DESC
    LIMIT 30
  `).all(userId, req.institution_id) as any[];

  const visibleAnnouncements = announcements.filter((item) => audienceMatches(req.user?.user_type, item.audience));

  const unread =
    notifications.filter((item) => !item.is_read).length +
    visibleAnnouncements.filter((item) => !item.acknowledged && item.require_ack !== 0).length;

  res.json({
    unread,
    notifications,
    announcements: visibleAnnouncements,
  });
});

notificationsRouter.post('/:id/read', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  db.prepare(`
    UPDATE notifications SET is_read = 1, read_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user?.id);
  res.json({ message: 'Marked as read' });
});

notificationsRouter.post('/:id/acknowledge', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const note = db.prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (note) {
    db.prepare(`
      UPDATE notifications
      SET is_acknowledged = 1, acknowledged_at = datetime('now'), is_read = 1, read_at = COALESCE(read_at, datetime('now'))
      WHERE id = ?
    `).run(req.params.id);
    res.json({ message: 'Acknowledged' });
    return;
  }

  const announcement = db.prepare(`
    SELECT id FROM announcements WHERE id = ? AND institution_id = ?
  `).get(req.params.id, req.institution_id);
  if (!announcement) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  db.prepare(`
    INSERT OR IGNORE INTO announcement_acknowledgements (id, institution_id, announcement_id, user_id)
    VALUES (?, ?, ?, ?)
  `).run(generateId(), req.institution_id, req.params.id, userId);

  res.json({ message: 'Acknowledged' });
});
