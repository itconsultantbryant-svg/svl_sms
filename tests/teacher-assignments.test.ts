import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { getDatabase } from '../src/database/init';
import { translateSqlite } from '../src/database/neon-db';
import { teachersRouter } from '../src/routes/teachers';

// Use an isolated database; never connect to the workspace or deployed database.
delete process.env.DATABASE_URL;
process.env.DB_PATH = ':memory:';
const db = getDatabase();
db.exec(`
  CREATE TABLE academic_sessions (id TEXT PRIMARY KEY, institution_id TEXT, is_current INTEGER);
  CREATE TABLE teacher_assignments (
    id TEXT PRIMARY KEY, institution_id TEXT, employee_id TEXT, class_id TEXT,
    section_id TEXT, subject_id TEXT, session_id TEXT, is_class_teacher INTEGER
  );
`);

const queries: string[] = [];
const prepare = db.prepare.bind(db);
db.prepare = (sql: string) => {
  queries.push(sql);
  return prepare(sql);
};
const route = teachersRouter.stack.find((layer: any) =>
  layer.route?.path === '/:id/assignments' && layer.route.methods.post
)!.route;
const handler = route.stack[route.stack.length - 1].handle;

function assign(body: Record<string, unknown>) {
  let status = 200;
  let data: any;
  handler({ params: { id: 'teacher' }, institution_id: 'school', body }, {
    status(code: number) { status = code; return this; },
    json(value: unknown) { data = value; return this; },
  }, () => {});
  return { status, data };
}

beforeEach(() => {
  db.exec('DELETE FROM teacher_assignments; DELETE FROM academic_sessions;');
  queries.length = 0;
});
after(() => db.close());

test('creates the class/subject combinations and skips duplicates with null section/session', () => {
  const body = { class_ids: ['class-a', 'class-b'], subject_ids: ['math', 'english'] };
  const first = assign(body);
  assert.equal(first.status, 201);
  assert.equal(first.data.count, 4);
  assert.equal(assign(body).data.count, 0);
  assert.equal(prepare('SELECT COUNT(*) AS count FROM teacher_assignments').get().count, 4);

  const lookup = queries.find(sql => /SELECT id FROM teacher_assignments/.test(sql))!;
  const postgresSql = translateSqlite(lookup);
  // The adapter must not send SQLite-only IFNULL calls to PostgreSQL.
  assert.doesNotMatch(postgresSql, /\bIFNULL\s*\(/i);
  assert.match(postgresSql, /COALESCE\(\$5, ''\)/);
  assert.match(postgresSql, /COALESCE\(\$6, ''\)/);
});

test('uses the current session and distinguishes explicit sections and sessions', () => {
  prepare('INSERT INTO academic_sessions VALUES (?, ?, 1)').run('current', 'school');
  const body = { class_id: 'class', subject_id: 'math', is_class_teacher: true };
  assert.equal(assign(body).data.count, 1);
  const row = prepare('SELECT * FROM teacher_assignments').get();
  assert.equal(row.session_id, 'current');
  assert.equal(row.is_class_teacher, 1);
  assert.equal(assign({ ...body, session_id: 'current' }).data.count, 0);
  assert.equal(assign({ ...body, section_id: 'section' }).data.count, 1);
  assert.equal(assign({ ...body, session_id: 'next' }).data.count, 1);
});
