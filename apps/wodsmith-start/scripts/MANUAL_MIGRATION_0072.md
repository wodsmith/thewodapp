# Manual Migration 0072 - Competition Dates to Text

## Problem

Migration `0072_competition-dates-to-text.sql` fails when run through Alchemy because D1 executes each SQL statement separately, and `PRAGMA foreign_keys=OFF` doesn't persist across statements. This causes a foreign key constraint error when dropping the `competitions` table.

## Solution

Run this migration manually using `wrangler d1 execute` which can handle the transaction properly:

### For Production

```bash
# From apps/wodsmith-start directory
npx wrangler d1 execute wodsmith-prod --file=scripts/manual-migration-0072.sql --remote
```

### For Demo

```bash
npx wrangler d1 execute wodsmith-demo --file=scripts/manual-migration-0072.sql --remote
```

### For Local Dev

```bash
npx wrangler d1 execute wodsmith-dev --file=scripts/manual-migration-0072.sql --local
```

## Verification

After running, verify the migration was applied:

```bash
# Check that dates are now text format
npx wrangler d1 execute wodsmith-prod --command="SELECT id, startDate, endDate, registrationOpensAt FROM competitions LIMIT 1;" --remote

# Check migration was recorded
npx wrangler d1 execute wodsmith-prod --command="SELECT * FROM d1_migrations WHERE name = '0072_competition-dates-to-text';" --remote
```

## Alternative: Temporary Skip

If you need to deploy immediately without running this migration:

1. Temporarily rename `0072_competition-dates-to-text.sql` to `0072_competition-dates-to-text.sql.skip`
2. Deploy with Alchemy (it will skip this migration)
3. Run the manual script above
4. Rename the file back to `0072_competition-dates-to-text.sql`

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
7. Records the migration in `d1_migrations`
8. Re-enables foreign key checks

This must be run as a single transaction to ensure the PRAGMA setting applies to all statements.
