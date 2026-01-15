# Manual Migration 0072 - Competition Dates to Text

## Problem

Migration `0072_competition-dates-to-text.sql` fails when run through Alchemy because D1 executes each SQL statement separately, and `PRAGMA foreign_keys=OFF` doesn't persist across statements. This causes a foreign key constraint error when dropping the `competitions` table.

Even using `wrangler d1 execute` with a SQL file doesn't work because D1's SQL import API still executes statements separately.

## Solution

Use D1's JavaScript `batch()` API via a temporary HTTP endpoint that executes all statements in a single transaction.

### Step 1: Set Migration Secret

Add this to your environment variables:

```bash
# Set in your shell before deploying (or add to CI/CD secrets)
export MIGRATION_SECRET=your-secure-random-string-here

# Then deploy with Alchemy
STAGE=prod npx alchemy deploy  # For production
STAGE=demo npx alchemy deploy  # For demo
```

Alternatively, use the default secret `change-me-in-env` (less secure but works for one-time migration).

### Step 2: Run Migration via HTTP

**For Production:**
```bash
curl -X POST "https://wodsmith.com/api/migrate-0072?secret=your-secure-random-string-here"
```

**For Demo:**
```bash
curl -X POST "https://demo.wodsmith.com/api/migrate-0072?secret=your-secure-random-string-here"
```

**For Local Dev:**
```bash
curl -X POST "http://localhost:3000/api/migrate-0072?secret=your-secure-random-string-here"
```

### Step 3: Delete Migration Endpoint

After successful migration, delete the file:
```bash
rm src/routes/api/migrate-0072.ts
```

This ensures the endpoint can't be accidentally called again.

## Verification

After running, verify the migration was applied:

```bash
# Check that dates are now text format (should show YYYY-MM-DD strings)
npx wrangler d1 execute wodsmith-db-prod --command="SELECT id, startDate, endDate, registrationOpensAt FROM competitions LIMIT 1;" --remote

# Check migration was recorded
npx wrangler d1 execute wodsmith-db-prod --command="SELECT * FROM d1_migrations WHERE name = '0072_competition-dates-to-text';" --remote
```

Expected output should show dates like `"2024-04-11"` instead of timestamps like `1712793600`.

## What This Migration Does

- Converts `startDate`, `endDate`, `registrationOpensAt`, and `registrationClosesAt` from INTEGER (Unix timestamps) to TEXT (YYYY-MM-DD format)
- Fixes timezone bugs where dates like "April 11" would display as "April 10" in certain timezones
- Preserves all existing data and other table fields
- Maintains all indexes and constraints

## Technical Details

The migration:
1. Disables foreign key checks with `PRAGMA foreign_keys=OFF`
2. Creates a new `competitions_new` table with TEXT date columns
3. Copies all data, converting timestamps to YYYY-MM-DD using `strftime()`
4. Drops the old `competitions` table
5. Renames `competitions_new` to `competitions`
6. Recreates all indexes
7. Records the migration in `d1_migrations` table (sets id=72)
8. Re-enables foreign key checks

This must be run as a **single transaction** to ensure the PRAGMA setting applies to all statements.

## Deployment Order

1. ✅ Deploy this branch (skips 0072 migration automatically)
2. ⚠️ **Run manual migration script** (this step!)
3. ✅ Verify migration applied successfully
4. ✅ App will now handle dates correctly without timezone bugs

## Troubleshooting

### If migration fails with "table already exists"
The migration may have partially run. Check:
```bash
npx wrangler d1 execute wodsmith-db-prod --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'competitions%';" --remote
```

If you see `competitions_new`, drop it first:
```bash
npx wrangler d1 execute wodsmith-db-prod --command="DROP TABLE competitions_new;" --remote
```

### If dates are still showing as integers
The migration hasn't been applied yet. Run the script above.

### If you get permission errors
Ensure you're authenticated with Wrangler:
```bash
npx wrangler login
```
