import { getDatabase } from '../database/init';
import { generateId } from './helpers';

function letterFromPercent(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export type GradesheetMode = 'term' | 'year';

export function buildGradesheet(
  institutionId: string,
  studentId: string,
  options?: { termId?: string | null; mode?: GradesheetMode }
) {
  const db = getDatabase();
  const mode: GradesheetMode = options?.mode || (options?.termId ? 'term' : 'year');
  const termId = options?.termId || null;

  const institution = db.prepare(`
    SELECT institution_name, logo, motto, address, city, county, phone, email
    FROM institutions WHERE id = ?
  `).get(institutionId) as any;

  const signatures = db.prepare(`
    SELECT role_key, signer_name, signer_title, signature_image, sort_order
    FROM institution_signatures
    WHERE institution_id = ? AND is_active = 1
    ORDER BY sort_order, role_key
  `).all(institutionId) as any[];

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

  const terms = sessionId
    ? db.prepare(`
        SELECT id, name, start_date, end_date
        FROM terms
        WHERE institution_id = ? AND session_id = ?
        ORDER BY start_date, name
      `).all(institutionId, sessionId) as Array<{ id: string; name: string }>
    : [];

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

  let scoreSql = `
    SELECT g.subject_id, sub.name as subject_name, sub.code as subject_code,
      g.term_id, t.name as term_name, gt.computed_percent, gt.letter_grade, g.approved_at
    FROM gradebook_totals gt
    JOIN gradebooks g ON g.id = gt.gradebook_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    LEFT JOIN terms t ON t.id = g.term_id
    WHERE gt.student_id = ? AND g.institution_id = ? AND g.status = 'approved'
      AND (? IS NULL OR g.class_id = ?)
      AND (? IS NULL OR g.session_id = ?)
  `;
  const scoreParams: any[] = [studentId, institutionId, student.class_id, student.class_id, sessionId, sessionId];
  if (mode === 'term' && termId) {
    scoreSql += ' AND g.term_id = ?';
    scoreParams.push(termId);
  }
  scoreSql += ' ORDER BY t.start_date, g.approved_at DESC';

  const scores = db.prepare(scoreSql).all(...scoreParams) as any[];

  // subject -> term -> best/latest percent
  const bySubjectTerm = new Map<string, Map<string, { percent: number; letter: string; term_name: string }>>();
  for (const row of scores) {
    if (!row.subject_id) continue;
    const termKey = row.term_id || 'none';
    if (!bySubjectTerm.has(row.subject_id)) bySubjectTerm.set(row.subject_id, new Map());
    const termMap = bySubjectTerm.get(row.subject_id)!;
    if (termMap.has(termKey)) continue;
    const percent = row.computed_percent == null ? null : Number(row.computed_percent);
    if (percent == null) continue;
    termMap.set(termKey, {
      percent,
      letter: row.letter_grade || letterFromPercent(percent),
      term_name: row.term_name || '',
    });
  }

  const termColumns = mode === 'term' && termId
    ? terms.filter((term) => term.id === termId)
    : terms;

  const subjects = assigned.map((subject) => {
    const termMap = bySubjectTerm.get(subject.id) || new Map();
    const termScores = termColumns.map((term) => {
      const hit = termMap.get(term.id);
      return {
        term_id: term.id,
        term_name: term.name,
        percent: hit?.percent ?? null,
        letter: hit?.letter || '',
      };
    });
    const scored = termScores.map((item) => item.percent).filter((value): value is number => value != null);
    const subjectAverage = average(scored);
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      term_scores: termScores,
      percent: subjectAverage,
      letter: subjectAverage == null ? '' : letterFromPercent(subjectAverage),
      term_name: termScores.map((item) => item.term_name).filter(Boolean).join(' / '),
    };
  });

  // Include approved subjects not assigned to the class.
  for (const [subjectId, termMap] of bySubjectTerm.entries()) {
    if (subjects.some((subject) => subject.id === subjectId)) continue;
    const sample = scores.find((row) => row.subject_id === subjectId);
    const termScores = termColumns.map((term) => {
      const hit = termMap.get(term.id);
      return {
        term_id: term.id,
        term_name: term.name,
        percent: hit?.percent ?? null,
        letter: hit?.letter || '',
      };
    });
    const scored = termScores.map((item) => item.percent).filter((value): value is number => value != null);
    const subjectAverage = average(scored);
    subjects.push({
      id: subjectId,
      name: sample?.subject_name || 'Subject',
      code: sample?.subject_code || null,
      term_scores: termScores,
      percent: subjectAverage,
      letter: subjectAverage == null ? '' : letterFromPercent(subjectAverage),
      term_name: termScores.map((item) => item.term_name).filter(Boolean).join(' / '),
    });
  }

  const termAverages = termColumns.map((term) => {
    const values = subjects
      .map((subject) => subject.term_scores.find((item) => item.term_id === term.id)?.percent)
      .filter((value): value is number => value != null);
    const avg = average(values);
    return {
      term_id: term.id,
      term_name: term.name,
      average: avg,
      letter: avg == null ? '' : letterFromPercent(avg),
    };
  });

  const yearlyValues = subjects.map((subject) => subject.percent).filter((value): value is number => value != null);
  const yearlyAverage = average(yearlyValues);
  const promoted = yearlyAverage != null && yearlyAverage >= 70;
  const nextClass = student.class_name
    ? `the next class after ${student.class_name}`
    : 'the next class';

  return {
    institution: institution || { institution_name: 'School' },
    signatures: signatures.map((signature) => ({
      role_key: signature.role_key,
      signer_name: signature.signer_name,
      signer_title: signature.signer_title || signature.role_key.replace('_', ' '),
      signature_image: signature.signature_image,
    })),
    student: {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      admission_number: student.admission_number,
      class_name: student.class_name,
      section_name: student.section_name,
      session_name: student.session_name,
    },
    mode,
    terms: termColumns,
    term_averages: termAverages,
    semester_average: termAverages.length === 1 ? termAverages[0].average : average(termAverages.map((item) => item.average).filter((value): value is number => value != null)),
    yearly_average: yearlyAverage,
    yearly_letter: yearlyAverage == null ? '' : letterFromPercent(yearlyAverage),
    promoted,
    promotion_statement: yearlyAverage == null
      ? 'Promotion status will appear when approved grades are available.'
      : promoted
        ? `This student has achieved a yearly average of ${yearlyAverage}% and is promoted to ${nextClass}.`
        : `This student has achieved a yearly average of ${yearlyAverage}% and is not promoted. A minimum of 70% is required for promotion.`,
    subjects,
  };
}

/** Promote students whose yearly average is at least 70% into the next class for the same school. */
export function promoteEligibleStudents(institutionId: string, sessionId?: string | null) {
  const db = getDatabase();
  const students = db.prepare(`
    SELECT id, class_id, session_id FROM students
    WHERE institution_id = ? AND status = 'active' AND class_id IS NOT NULL
  `).all(institutionId) as Array<{ id: string; class_id: string; session_id: string | null }>;

  const classes = db.prepare(`
    SELECT id, name, sort_order FROM classes WHERE institution_id = ? AND is_active = 1 ORDER BY sort_order, name
  `).all(institutionId) as Array<{ id: string; name: string; sort_order: number }>;

  const sessions = db.prepare(`
    SELECT id, name FROM academic_sessions WHERE institution_id = ?
  `).all(institutionId) as Array<{ id: string; name: string }>;
  const sessionName = (id?: string | null) => sessions.find((row) => row.id === id)?.name || null;

  let promoted = 0;
  for (const student of students) {
    if (sessionId && student.session_id && student.session_id !== sessionId) continue;
    const sheet = buildGradesheet(institutionId, student.id, { mode: 'year' });
    if (!sheet?.promoted || sheet.yearly_average == null) continue;
    const currentIndex = classes.findIndex((item) => item.id === student.class_id);
    if (currentIndex < 0 || currentIndex >= classes.length - 1) continue;
    const current = classes[currentIndex];
    const next = classes[currentIndex + 1];

    db.prepare(`
      INSERT INTO student_prior_records (
        id, institution_id, student_id, record_type, title, class_name, session_name, notes, file_data, file_name, mime_type
      ) VALUES (?, ?, ?, 'prior_class', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      institutionId,
      student.id,
      `Yearly gradesheet — ${current.name}`,
      current.name,
      sessionName(student.session_id),
      sheet.promotion_statement,
      JSON.stringify(sheet),
      `gradesheet-${student.id}-${current.name}.json`,
      'application/json'
    );

    db.prepare(`
      UPDATE students SET class_id = ?, previous_class = ?, updated_at = datetime('now') WHERE id = ? AND institution_id = ?
    `).run(next.id, current.name, student.id, institutionId);
    promoted += 1;
  }
  return { promoted, checked: students.length };
}
