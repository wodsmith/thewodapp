# Migrate Competition Date Columns Script

## Purpose

This script migrates competition date columns from INTEGER (Unix timestamps) to TEXT (YYYY-MM-DD format) by:
1. Dropping the existing INTEGER columns from `competitions`
2. Re-adding them as TEXT columns
3. Copying the converted date values from `competitions_new`

## Prerequisites

- `competitions_new` table must exist with TEXT date columns containing YYYY-MM-DD formatted dates
- `competitions` table exists with INTEGER date columns
- Tables must have matching `id` columns
- **IMPORTANT**: `competitions_new` should already contain the converted dates from INTEGER to TEXT format

## Usage

### Production
```bash
npx wrangler d1 execute wodsmith-db-prod --file=scripts/copy-competition-dates.sql --remote
```

### Demo
```bash
npx wrangler d1 execute wodsmith-db-demo --file=scripts/copy-competition-dates.sql --remote
```

### Local Dev
```bash
npx wrangler d1 execute wodsmith-db-dev --file=scripts/copy-competition-dates.sql --local
```

## What It Does

The script performs a column type migration:

1. **Drops INTEGER columns**: Removes `startDate`, `endDate`, `registrationOpensAt`, and `registrationClosesAt` columns from `competitions` table
2. **Adds TEXT columns**: Re-creates the same four columns as TEXT type:
   - `startDate` and `endDate`: TEXT NOT NULL (required fields)
   - `registrationOpensAt` and `registrationClosesAt`: TEXT (nullable/optional fields)
3. **Copies data**: Updates the new TEXT columns with YYYY-MM-DD formatted dates from `competitions_new`
4. **Matches by ID**: Only updates rows where a matching record exists in `competitions_new`

⚠️ **Warning**: This script permanently deletes the INTEGER timestamp data. Ensure `competitions_new` has all the converted dates before running.

## Verification

After running, verify the dates were copied:

```bash
# Check a few records
npx wrangler d1 execute wodsmith-db-prod --command="SELECT id, startDate, endDate, registrationOpensAt, registrationClosesAt FROM competitions LIMIT 5;" --remote
```

## Safety

- ⚠️ **This script modifies the schema** by dropping and recreating columns
- ⚠️ **Original INTEGER timestamp data is permanently deleted** when columns are dropped
- The script does not create or delete any competition records
- Only rows with matching IDs in both tables will have dates populated
- **Test on a backup database first** before running in production

## Post-Migration

After verifying the migration worked successfully:

1. **Drop the temporary table**: Remove `competitions_new` if it's no longer needed
   ```sql
   DROP TABLE competitions_new;
   ```

2. **Verify constraints**: The new schema has:
   - `startDate` TEXT NOT NULL (every competition must have a start date)
   - `endDate` TEXT NOT NULL (every competition must have an end date)
   - `registrationOpensAt` TEXT (optional - can be NULL)
   - `registrationClosesAt` TEXT (optional - can be NULL)
