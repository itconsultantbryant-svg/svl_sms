#!/bin/bash

# SVL-SMS Multi-Tenant Route Update Script
# This script helps manually update remaining routes with tenant isolation

echo "==================================="
echo "SVL-SMS Route Update Helper"
echo "==================================="
echo ""

cd "/Users/user/Desktop/systems/SMS/backend/src/routes"

# Routes that are DONE
DONE_ROUTES="auth.ts students.ts platform-admin.ts parents.ts teachers.ts attendance.ts"

# Routes that NEED updating
PENDING_ROUTES="
fees.ts
examinations.ts
marks.ts
results.ts
academics.ts
timetable.ts
accounts.ts
library.ts
inventory.ts
transport.ts
reception.ts
payroll.ts
certificates.ts
reports.ts
communication.ts
communication-simple.ts
branches.ts
users.ts
settings.ts
dashboard.ts
"

echo "✅ COMPLETED ROUTES:"
for route in $DONE_ROUTES; do
  echo "  - $route"
done

echo ""
echo "⏳ ROUTES NEEDING UPDATES:"
for route in $PENDING_ROUTES; do
  if [ -f "$route" ]; then
    echo "  - $route ✓ (exists)"
  else
    echo "  - $route ✗ (missing)"
  fi
done

echo ""
echo "==================================="
echo "PATTERN TO APPLY TO EACH FILE:"
echo "==================================="
echo ""

cat << 'EOF'
1. ADD IMPORT (after existing imports):
   import { injectTenant, requireTenant } from '../middleware/tenant';

2. ADD MIDDLEWARE (after router creation):
   router.use(injectTenant);
   router.use(requireTenant);

3. UPDATE SELECT QUERIES:
   BEFORE: WHERE table.id = ?
   AFTER:  WHERE table.id = ? AND table.institution_id = ?
   ADD:    req.institution_id to parameter list

4. UPDATE INSERT QUERIES:
   BEFORE: INSERT INTO table (id, name, ...) VALUES (?, ?, ...)
   AFTER:  INSERT INTO table (id, institution_id, name, ...) VALUES (?, ?, ?, ...)
   ADD:    req.institution_id after id

5. UPDATE UPDATE/DELETE:
   BEFORE: WHERE id = ?
   AFTER:  WHERE id = ? AND institution_id = ?
   ADD:    req.institution_id to parameters

EXAMPLE FROM students.ts:
================================================
import { Router, Response } from 'express';
import { getDatabase } from '../database/init';
import { AuthRequest } from '../middleware/auth';
import { injectTenant, requireTenant } from '../middleware/tenant';  // ← ADD
import { generateId, generateAdmissionNumber, paginate, buildSearchQuery } from '../utils/helpers';

export const studentsRouter = Router();

// Apply tenant middleware to ALL student routes  // ← ADD
studentsRouter.use(injectTenant);                 // ← ADD
studentsRouter.use(requireTenant);                // ← ADD

studentsRouter.get('/', (req: AuthRequest, res: Response) => {
  // BEFORE: WHERE 1=1
  // AFTER:  WHERE s.institution_id = ?
  let where = 'WHERE s.institution_id = ? ' + searchClause;  // ← CHANGE
  const params: any[] = [req.institution_id, ...searchParams];  // ← CHANGE
  // ... rest of code
});

studentsRouter.post('/', (req: AuthRequest, res: Response) => {
  const insertStudent = db.prepare(`
    INSERT INTO students (
      id, institution_id, branch_id, admission_number,  // ← ADD institution_id
      first_name, middle_name, last_name, ...
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ...)
  `);

  insertStudent.run(
    id,
    req.institution_id,  // ← ADD
    branch_id || req.user?.branch_id || null,
    admission_number,
    // ... rest
  );
});

studentsRouter.put('/:id', (req: AuthRequest, res: Response) => {
  // BEFORE: WHERE id = ?
  // AFTER:  WHERE id = ? AND institution_id = ?
  const student = db.prepare(
    'SELECT id FROM students WHERE id = ? AND institution_id = ?'  // ← CHANGE
  ).get(id, req.institution_id);  // ← ADD
});
================================================

EOF

echo ""
echo "==================================="
echo "QUICK FIX COMMANDS:"
echo "==================================="
echo ""
echo "# Fix a specific file manually:"
echo "code fees.ts  # or vi/nano/your-editor"
echo ""
echo "# Or use sed to add imports (example):"
echo "# sed -i '' '/from.*helpers/a\\'$'\\n''import { injectTenant, requireTenant } from '\''../middleware/tenant'\'';" fees.ts
echo ""
echo "==================================="
echo ""

# Count how many are done vs pending
DONE_COUNT=$(echo $DONE_ROUTES | wc -w)
PENDING_COUNT=$(echo $PENDING_ROUTES | wc -w)
TOTAL=$((DONE_COUNT + PENDING_COUNT))
PERCENT=$((DONE_COUNT * 100 / TOTAL))

echo "PROGRESS: $DONE_COUNT/$TOTAL routes updated ($PERCENT%)"
echo ""
echo "Next: Update fees.ts, examinations.ts, marks.ts (high priority)"
echo ""
