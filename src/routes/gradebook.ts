import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest, authorize } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';
import { generateId, paginate } from '../utils/helpers';

export const gradebookRouter = Router();

gradebookRouter.use(injectTenant);
gradebookRouter.use(requireTenant);

function letterFromPercent(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function recomputeTotals(db: ReturnType<typeof getDatabase>, gradebookId: string) {
  const columns = db.prepare(`
    SELECT id, weight, max_score FROM gradebook_columns WHERE gradebook_id = ? ORDER BY sort_order
  `).all(gradebookId) as Array<{ id: string; weight: number; max_score: number }>;

  const students = db.prepare(`
    SELECT DISTINCT student_id FROM gradebook_entries WHERE gradebook_id = ?
  `).all(gradebookId) as Array<{ student_id: string }>;

  // Also include roster students with no entries yet via totals rebuild from class
  const upsert = db.prepare(`
    INSERT INTO gradebook_totals (id, gradebook_id, student_id, computed_percent, letter_grade, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(gradebook_id, student_id) DO UPDATE SET
      computed_percent = excluded.computed_percent,
      letter_grade = excluded.letter_grade,
      updated_at = datetime('now')
  `);

  for (const { student_id } of students) {
    let total = 0;
    for (const col of columns) {
      const entry = db.prepare(`
        SELECT score FROM gradebook_entries
        WHERE gradebook_id = ? AND student_id = ? AND column_id = ?
      `).get(gradebookId, student_id, col.id) as { score: number | null } | undefined;
      const score = entry?.score;
      if (score == null || !col.max_score) continue;
      const pct = (Number(score) / Number(col.max_score)) * 100;
      total += (pct * Number(col.weight)) / 100;
    }
    const rounded = Math.round(total * 100) / 100;
    upsert.run(generateId(), gradebookId, student_id, rounded, letterFromPercent(rounded));
  }
}

function getTeacherEmployeeId(req: AuthRequest): string | null {
  const db = getDatabase();
  const inst = req.institution_id ? `AND institution_id = '${req.institution_id}'` : '';
  const teacher = db.prepare(`
    SELECT id FROM employees WHERE user_id = ? ${inst} AND is_teacher = 1
  `).get(req.user!.id) as any;
  return teacher?.id || null;
}

function loadGradebookDetail(db: ReturnType<typeof getDatabase>, id: string, institutionId: string | null | undefined) {
  const inst = institutionId ? `AND g.institution_id = '${institutionId}'` : '';
  const gb = db.prepare(`
    SELECT g.*,
      c.name as class_name, sec.name as section_name, sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name,
      t.name as term_name, s.name as session_name
    FROM gradebooks g
    LEFT JOIN classes c ON c.id = g.class_id
    LEFT JOIN sections sec ON sec.id = g.section_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN employees e ON e.id = g.teacher_id
    LEFT JOIN terms t ON t.id = g.term_id
    LEFT JOIN academic_sessions s ON s.id = g.session_id
    WHERE g.id = ? ${inst}
  `).get(id) as any;
  if (!gb) return null;

  const columns = db.prepare(`
    SELECT * FROM gradebook_columns WHERE gradebook_id = ? ORDER BY sort_order, name
  `).all(id);

  let rosterWhere = `s.institution_id = ? AND s.class_id = ? AND (s.status IS NULL OR s.status != 'inactive')`;
  const rosterParams: any[] = [gb.institution_id, gb.class_id];
  if (gb.section_id) {
    rosterWhere += ' AND (s.section_id = ? OR s.section_id IS NULL)';
    rosterParams.push(gb.section_id);
  }
  if (gb.session_id) {
    rosterWhere += ' AND (s.session_id = ? OR s.session_id IS NULL)';
    rosterParams.push(gb.session_id);
  }

  const students = db.prepare(`
    SELECT s.id, s.admission_number, s.first_name, s.last_name, s.photo
    FROM students s
    WHERE ${rosterWhere}
    ORDER BY s.last_name, s.first_name
  `).all(...rosterParams);

  const entries = db.prepare(`
    SELECT * FROM gradebook_entries WHERE gradebook_id = ?
  `).all(id);

  const totals = db.prepare(`
    SELECT * FROM gradebook_totals WHERE gradebook_id = ?
  `).all(id);

  return { ...gb, columns, students, entries, totals };
}

// Admin: list gradebooks
gradebookRouter.get('/', authorize('platform_admin', 'institution_admin', 'teacher'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const { page = '1', limit = '50', status = '', class_id = '', subject_id = '', term_id = '' } = req.query as any;
  const { limit: lim, offset } = paginate(parseInt(page), parseInt(limit));

  const inst = req.institution_id ? `g.institution_id = '${req.institution_id}'` : '1=1';
  let where = `WHERE ${inst}`;
  const params: any[] = [];

  if (status) { where += ' AND g.status = ?'; params.push(status); }
  if (class_id) { where += ' AND g.class_id = ?'; params.push(class_id); }
  if (subject_id) { where += ' AND g.subject_id = ?'; params.push(subject_id); }
  if (term_id) { where += ' AND g.term_id = ?'; params.push(term_id); }

  // Teachers only see their own unless admin
  if (req.user?.user_type === 'teacher') {
    const teacherId = getTeacherEmployeeId(req);
    if (!teacherId) {
      res.json({ data: [], total: 0, page: 1, limit: lim });
      return;
    }
    where += ' AND g.teacher_id = ?';
    params.push(teacherId);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM gradebooks g ${where}`).get(...params) as any;
  const rows = db.prepare(`
    SELECT g.*,
      c.name as class_name, sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name,
      t.name as term_name
    FROM gradebooks g
    LEFT JOIN classes c ON c.id = g.class_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN employees e ON e.id = g.teacher_id
    LEFT JOIN terms t ON t.id = g.term_id
    ${where}
    ORDER BY g.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, lim, offset);

  res.json({ data: rows, total: total.count, page: parseInt(page), limit: lim });
});

gradebookRouter.get('/mine', authorize('teacher', 'platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const teacherId = getTeacherEmployeeId(req);
  if (!teacherId && req.user?.user_type === 'teacher') {
    res.json({ data: [] });
    return;
  }
  const db = getDatabase();
  const inst = req.institution_id ? `AND g.institution_id = '${req.institution_id}'` : '';
  const rows = db.prepare(`
    SELECT g.*,
      c.name as class_name, sub.name as subject_name, t.name as term_name
    FROM gradebooks g
    LEFT JOIN classes c ON c.id = g.class_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN terms t ON t.id = g.term_id
    WHERE g.teacher_id = ? ${inst}
    ORDER BY g.updated_at DESC
  `).all(teacherId);

  res.json({ data: rows });
});

gradebookRouter.get('/pending', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const inst = req.institution_id ? `AND g.institution_id = '${req.institution_id}'` : '';
  const rows = db.prepare(`
    SELECT g.*,
      c.name as class_name, sub.name as subject_name,
      e.first_name || ' ' || e.last_name as teacher_name,
      t.name as term_name
    FROM gradebooks g
    LEFT JOIN classes c ON c.id = g.class_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN employees e ON e.id = g.teacher_id
    LEFT JOIN terms t ON t.id = g.term_id
    WHERE g.status = 'submitted' ${inst}
    ORDER BY g.submitted_at DESC
  `).all();
  res.json({ data: rows });
});

gradebookRouter.get('/student/me', authorize('student'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const student = db.prepare(`
    SELECT id FROM students
    WHERE id = (
      SELECT linked_entity_id FROM users
      WHERE id = ? AND linked_entity_type = 'student'
    )
  `).get(req.user!.id) as any;

  // Fallback: match admission_number = username
  const studentRow = student || db.prepare(`
    SELECT id FROM students WHERE admission_number = (
      SELECT username FROM users WHERE id = ?
    ) AND institution_id = ?
  `).get(req.user!.id, req.institution_id) as any;

  if (!studentRow) {
    res.json({ data: [] });
    return;
  }

  const rows = db.prepare(`
    SELECT gt.*, g.subject_id, g.class_id, g.term_id, g.session_id, g.status,
      sub.name as subject_name, c.name as class_name, t.name as term_name
    FROM gradebook_totals gt
    JOIN gradebooks g ON g.id = gt.gradebook_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN classes c ON c.id = g.class_id
    LEFT JOIN terms t ON t.id = g.term_id
    WHERE gt.student_id = ? AND g.status = 'approved'
      AND g.institution_id = ?
    ORDER BY g.approved_at DESC
  `).all(studentRow.id, req.institution_id);

  res.json({ data: rows });
});

gradebookRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const detail = loadGradebookDetail(db, req.params.id, req.institution_id);
  if (!detail) {
    res.status(404).json({ error: 'Gradebook not found' });
    return;
  }

  if (req.user?.user_type === 'teacher') {
    const teacherId = getTeacherEmployeeId(req);
    if (teacherId !== detail.teacher_id) {
      res.status(403).json({ error: 'Not your gradebook' });
      return;
    }
  }

  if (req.user?.user_type === 'student' && detail.status !== 'approved') {
    res.status(403).json({ error: 'Grades not yet approved' });
    return;
  }

  res.json(detail);
});

// Admin generates gradebook for class/subject/teacher with weighted columns
gradebookRouter.post('/generate', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const {
    session_id, term_id, class_id, section_id, subject_id, teacher_id, columns
  } = req.body;

  if (!class_id || !subject_id || !teacher_id || !Array.isArray(columns) || columns.length === 0) {
    res.status(400).json({
      error: 'class_id, subject_id, teacher_id, and columns[] are required',
    });
    return;
  }

  const weightSum = columns.reduce((s: number, c: any) => s + Number(c.weight || 0), 0);
  if (Math.abs(weightSum - 100) > 0.01) {
    res.status(400).json({ error: 'Column weights must sum to 100', weight_sum: weightSum });
    return;
  }

  const db = getDatabase();

  // Verify teacher assignment exists (or allow admin override by creating if missing)
  const assignment = db.prepare(`
    SELECT id FROM teacher_assignments
    WHERE employee_id = ? AND class_id = ? AND subject_id = ?
      AND institution_id = ?
      ${session_id ? 'AND session_id = ?' : ''}
    LIMIT 1
  `).get(
    ...(session_id
      ? [teacher_id, class_id, subject_id, req.institution_id, session_id]
      : [teacher_id, class_id, subject_id, req.institution_id])
  );

  if (!assignment && session_id) {
    db.prepare(`
      INSERT INTO teacher_assignments (
        id, institution_id, employee_id, class_id, section_id, subject_id, session_id, is_class_teacher
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      generateId(), req.institution_id, teacher_id, class_id, section_id || null, subject_id, session_id
    );
  }

  const id = generateId();
  try {
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO gradebooks (
          id, institution_id, session_id, term_id, class_id, section_id, subject_id,
          teacher_id, status, generated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `).run(
        id, req.institution_id, session_id || null, term_id || null,
        class_id, section_id || null, subject_id, teacher_id, req.user!.id
      );

      const insertCol = db.prepare(`
        INSERT INTO gradebook_columns (id, gradebook_id, name, weight, max_score, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      columns.forEach((col: any, index: number) => {
        insertCol.run(
          generateId(),
          id,
          col.name || `Column ${index + 1}`,
          Number(col.weight),
          Number(col.max_score ?? 100),
          col.sort_order ?? index
        );
      });
    });
    tx();
  } catch (e: any) {
    if (String(e.message || '').includes('UNIQUE')) {
      res.status(409).json({ error: 'A gradebook already exists for this class/subject/teacher/term' });
      return;
    }
    throw e;
  }

  const detail = loadGradebookDetail(db, id, req.institution_id);
  res.status(201).json(detail);
});

gradebookRouter.put('/:id/columns', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const gb = db.prepare(`SELECT * FROM gradebooks WHERE id = ?`).get(req.params.id) as any;
  if (!gb || (req.institution_id && gb.institution_id !== req.institution_id)) {
    res.status(404).json({ error: 'Gradebook not found' });
    return;
  }
  if (gb.status === 'approved' || gb.status === 'submitted') {
    res.status(400).json({ error: 'Cannot edit columns after submit/approve' });
    return;
  }

  const columns = req.body.columns;
  if (!Array.isArray(columns) || columns.length === 0) {
    res.status(400).json({ error: 'columns[] required' });
    return;
  }
  const weightSum = columns.reduce((s: number, c: any) => s + Number(c.weight || 0), 0);
  if (Math.abs(weightSum - 100) > 0.01) {
    res.status(400).json({ error: 'Column weights must sum to 100' });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM gradebook_entries WHERE gradebook_id = ?').run(gb.id);
    db.prepare('DELETE FROM gradebook_totals WHERE gradebook_id = ?').run(gb.id);
    db.prepare('DELETE FROM gradebook_columns WHERE gradebook_id = ?').run(gb.id);
    const insertCol = db.prepare(`
      INSERT INTO gradebook_columns (id, gradebook_id, name, weight, max_score, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    columns.forEach((col: any, index: number) => {
      insertCol.run(
        generateId(), gb.id, col.name, Number(col.weight), Number(col.max_score ?? 100), index
      );
    });
    db.prepare(`UPDATE gradebooks SET updated_at = datetime('now'), status = 'open' WHERE id = ?`).run(gb.id);
  });
  tx();

  res.json(loadGradebookDetail(db, gb.id, req.institution_id));
});

// Teacher bulk enter scores: { entries: [{ student_id, column_id, score }] }
gradebookRouter.put('/:id/entries', authorize('teacher', 'platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const gb = db.prepare(`SELECT * FROM gradebooks WHERE id = ?`).get(req.params.id) as any;
  if (!gb || (req.institution_id && gb.institution_id !== req.institution_id)) {
    res.status(404).json({ error: 'Gradebook not found' });
    return;
  }

  if (req.user?.user_type === 'teacher') {
    const teacherId = getTeacherEmployeeId(req);
    if (teacherId !== gb.teacher_id) {
      res.status(403).json({ error: 'Not your gradebook' });
      return;
    }
  }

  if (!['open', 'draft', 'rejected'].includes(gb.status)) {
    res.status(400).json({ error: 'Gradebook is locked for editing', status: gb.status });
    return;
  }

  const entries = req.body.entries;
  if (!Array.isArray(entries)) {
    res.status(400).json({ error: 'entries[] required' });
    return;
  }

  const upsert = db.prepare(`
    INSERT INTO gradebook_entries (id, gradebook_id, student_id, column_id, score, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(gradebook_id, student_id, column_id) DO UPDATE SET
      score = excluded.score,
      updated_at = datetime('now')
  `);

  const tx = db.transaction(() => {
    for (const e of entries) {
      if (!e.student_id || !e.column_id) continue;
      upsert.run(generateId(), gb.id, e.student_id, e.column_id, e.score == null ? null : Number(e.score));
    }
    if (gb.status === 'rejected') {
      db.prepare(`UPDATE gradebooks SET status = 'open', rejection_reason = NULL, updated_at = datetime('now') WHERE id = ?`).run(gb.id);
    } else {
      db.prepare(`UPDATE gradebooks SET updated_at = datetime('now') WHERE id = ?`).run(gb.id);
    }
    recomputeTotals(db, gb.id);
  });
  tx();

  res.json(loadGradebookDetail(db, gb.id, req.institution_id));
});

gradebookRouter.post('/:id/submit', authorize('teacher', 'platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const gb = db.prepare(`SELECT * FROM gradebooks WHERE id = ?`).get(req.params.id) as any;
  if (!gb) {
    res.status(404).json({ error: 'Gradebook not found' });
    return;
  }
  if (req.user?.user_type === 'teacher') {
    const teacherId = getTeacherEmployeeId(req);
    if (teacherId !== gb.teacher_id) {
      res.status(403).json({ error: 'Not your gradebook' });
      return;
    }
  }
  if (!['open', 'draft', 'rejected'].includes(gb.status)) {
    res.status(400).json({ error: 'Cannot submit in current status', status: gb.status });
    return;
  }

  const entryCount = db.prepare(`SELECT COUNT(*) as c FROM gradebook_entries WHERE gradebook_id = ? AND score IS NOT NULL`).get(gb.id) as any;
  if (!entryCount.c) {
    res.status(400).json({ error: 'Enter at least one score before submitting' });
    return;
  }

  recomputeTotals(db, gb.id);
  db.prepare(`
    UPDATE gradebooks SET status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(gb.id);

  res.json({ message: 'Gradebook submitted for admin approval', id: gb.id });
});

gradebookRouter.post('/:id/approve', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const gb = db.prepare(`SELECT * FROM gradebooks WHERE id = ?`).get(req.params.id) as any;
  if (!gb || gb.status !== 'submitted') {
    res.status(404).json({ error: 'Submitted gradebook not found' });
    return;
  }

  db.prepare(`
    UPDATE gradebooks SET status = 'approved', approved_by = ?, approved_at = datetime('now'),
      updated_at = datetime('now'), rejection_reason = NULL
    WHERE id = ?
  `).run(req.user!.id, gb.id);

  res.json({ message: 'Gradebook approved — visible on student gradesheets' });
});

gradebookRouter.post('/:id/reject', authorize('platform_admin', 'institution_admin'), (req: AuthRequest, res: Response) => {
  const db = getDatabase();
  const gb = db.prepare(`SELECT * FROM gradebooks WHERE id = ?`).get(req.params.id) as any;
  if (!gb || gb.status !== 'submitted') {
    res.status(404).json({ error: 'Submitted gradebook not found' });
    return;
  }

  db.prepare(`
    UPDATE gradebooks SET status = 'rejected', rejection_reason = ?,
      approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(req.body.reason || 'Rejected by admin', req.user!.id, gb.id);

  res.json({ message: 'Gradebook rejected — returned to teacher' });
});
