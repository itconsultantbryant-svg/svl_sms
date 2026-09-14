import { getDatabase } from '../database/init';

function letterFromPercent(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

export function buildGradesheet(institutionId: string, studentId: string) {
  const db = getDatabase();
  const institution = db.prepare(`
    SELECT institution_name, logo, motto, address, city, county, phone, email
    FROM institutions WHERE id = ?
  `).get(institutionId) as any;

  const student = db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.admission_number, s.photo,
      s.class_id, s.session_id, c.name as class_name, sec.name as section_name, sess.name as session_name
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    LEFT JOIN academic_sessions sess ON sess.id = s.session_id
    WHERE s.id = ? AND s.institution_id = ?
  `).get(studentId, institutionId) as any;

  if (!student) return null;

  const sessionId = student.session_id || (db.prepare(`
    SELECT id FROM academic_sessions WHERE institution_id = ? AND is_current = 1 LIMIT 1
  `).get(institutionId) as { id: string } | undefined)?.id || null;

  const assigned = student.class_id
    ? db.prepare(`
        SELECT sub.id, sub.name, sub.code
        FROM class_subjects cs
        JOIN subjects sub ON sub.id = cs.subject_id
        WHERE cs.institution_id = ? AND cs.class_id = ?
          AND (cs.session_id IS NULL OR cs.session_id = ? OR ? IS NULL)
        ORDER BY sub.name
      `).all(institutionId, student.class_id, sessionId, sessionId) as Array<{ id: string; name: string; code: string | null }>
    : [];

  const scores = db.prepare(`
    SELECT g.subject_id, sub.name as subject_name, sub.code as subject_code,
      gt.computed_percent, gt.letter_grade, t.name as term_name, g.approved_at
    FROM gradebook_totals gt
    JOIN gradebooks g ON g.id = gt.gradebook_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN terms t ON t.id = g.term_id
    WHERE gt.student_id = ? AND g.institution_id = ? AND g.status = 'approved'
      AND (? IS NULL OR g.class_id = ?)
    ORDER BY g.approved_at DESC
  `).all(studentId, institutionId, student.class_id, student.class_id) as any[];

  const scoreBySubject = new Map<string, any>();
  for (const row of scores) {
    if (row.subject_id && !scoreBySubject.has(row.subject_id)) scoreBySubject.set(row.subject_id, row);
  }

  const seen = new Set<string>();
  const subjects = assigned.map((subject) => {
    seen.add(subject.id);
    const score = scoreBySubject.get(subject.id);
    const percent = score?.computed_percent == null ? null : Number(score.computed_percent);
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      percent,
      letter: score?.letter_grade || (percent == null ? '' : letterFromPercent(percent)),
      term_name: score?.term_name || '',
    };
  });

  for (const score of scores) {
    if (!score.subject_id || seen.has(score.subject_id)) continue;
    seen.add(score.subject_id);
    const percent = score.computed_percent == null ? null : Number(score.computed_percent);
    subjects.push({
      id: score.subject_id,
      name: score.subject_name || 'Subject',
      code: score.subject_code || null,
      percent,
      letter: score.letter_grade || (percent == null ? '' : letterFromPercent(percent)),
      term_name: score.term_name || '',
    });
  }

  return {
    institution: institution || { institution_name: 'School' },
    student: {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      admission_number: student.admission_number,
      class_name: student.class_name,
      section_name: student.section_name,
      session_name: student.session_name,
    },
    subjects,
  };
}
