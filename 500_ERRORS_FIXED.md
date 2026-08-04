# 500 Internal Server Errors - FIXED

## Issues Reported
```
500 (Internal Server Error) on:
- /api/branches
- /api/academics/classes
```

## Root Causes

### 1. SQL Column Name Mismatch
**Error:** `SqliteError: no such column: b.name`

**Problem:** Queries were using `b.name` but the branches table column is actually `branch_name`.

### 2. Missing Tenant Filtering
When we automatically added tenant middleware to routes, we didn't update the SQL queries inside to:
- Add `institution_id` filters
- Use correct column names from the database schema

## Fixes Applied

### **branches.ts** ✅

**Before:**
```typescript
SELECT b.*, ...
FROM branches b
WHERE b.is_active = 1
ORDER BY b.is_main DESC, b.name  // ❌ Wrong column name
```

**After:**
```typescript
SELECT b.*, ...
FROM branches b
WHERE b.institution_id = ? AND b.is_active = 1  // ✅ Added tenant filter
ORDER BY b.is_main DESC, b.branch_name  // ✅ Correct column name
```

Also updated:
- GET `/branches/:id` - Added `institution_id` filter

### **academics.ts** ✅

**Before:**
```typescript
SELECT c.*, b.name as branch_name, ...  // ❌ Wrong column name
FROM classes c
LEFT JOIN branches b ON c.branch_id = b.id
WHERE c.is_active = 1
```

**After:**
```typescript
SELECT c.*, b.branch_name as branch_name, ...  // ✅ Correct column name
FROM classes c
LEFT JOIN branches b ON c.branch_id = b.id
WHERE c.institution_id = ? AND c.is_active = 1  // ✅ Added tenant filter
```

## Database Schema Reference

### branches table:
```
- id
- institution_id
- branch_code
- branch_name          ← Not "name"!
- email
- phone
- address
- is_main
- is_active
```

### classes table:
```
- id
- institution_id
- branch_id
- name                 ← This has "name"
- numeric_name
- capacity
- is_active
```

## Testing Results

### Branches API ✅
```bash
GET /api/branches
Response: [
  {
    "id": "...",
    "branch_name": "Main Campus",
    "student_count": 1,
    "employee_count": 0
  }
]
```

### Classes API ✅
```bash
GET /api/academics/classes
Response: [
  {
    "id": "...",
    "name": "Grade 7",
    "branch_name": "Main Campus",
    "student_count": 0
  }
]
```

## Status: ✅ ALL FIXED

Both endpoints now:
- ✅ Return 200 OK
- ✅ Filter by institution_id
- ✅ Use correct column names
- ✅ Return expected data

## Lesson Learned

When automatically adding tenant middleware:
1. **Check column names** against actual database schema
2. **Update all queries** in the route file, not just the middleware
3. **Test each endpoint** after changes
4. **Review SQL errors** carefully - they tell you exactly what's wrong

## Next Steps for Other Routes

If you encounter similar 500 errors on other routes, check:
1. Is the middleware added? (should be ✅)
2. Do queries filter by `institution_id`?
3. Are column names correct per the database schema?
4. Test the endpoint after changes

## Quick Fix Pattern

For any route with 500 errors:
1. Check the error log for column name issues
2. Find the query in the route file
3. Add `institution_id = ?` to WHERE clause
4. Fix any column name mismatches
5. Rebuild: `npm run build`
6. Restart backend
7. Test endpoint

---

**Fixed:** August 3, 2026  
**Files Modified:** branches.ts, academics.ts  
**Status:** All 500 errors resolved ✅
