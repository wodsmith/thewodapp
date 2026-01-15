# Manual Migration 0072 - Competition Dates to Text

## Problem

Migration `0072_competition-dates-to-text.sql` fails when run through Alchemy because D1 executes each SQL statement separately, and `PRAGMA foreign_keys=OFF` doesn't persist across statements. This causes a foreign key constraint error when dropping the `competitions` table.

## Solution

Run this migration manually using `wrangler d1 execute` which can handle the transaction properly.

### For Production

```bash
# From apps/wodsmith-start directory
npx wrangler d1 execute wodsmith-db-prod --file=scripts/manual-migration-0072.sql --remote
```

### For Demo

```bash
npx wrangler d1 execute wodsmith-db-demo --file=scripts/manual-migration-0072.sql --remote
```

### For Local Dev

```bash
npx wrangler d1 execute wodsmith-db-dev --file=scripts/manual-migration-0072.sql --local
```

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
