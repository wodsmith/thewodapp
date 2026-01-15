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

1. **Drops indexes**: Removes all indexes on the `competitions` table to avoid conflicts during column modifications
2. **Drops INTEGER columns**: Removes `startDate`, `endDate`, `registrationOpensAt`, and `registrationClosesAt` columns from `competitions` table
3. **Adds TEXT columns**: Re-creates the same four columns as TEXT type:
   - `startDate` and `endDate`: TEXT NOT NULL (required fields)
   - `registrationOpensAt` and `registrationClosesAt`: TEXT (nullable/optional fields)
4. **Copies data**: Updates the new TEXT columns with YYYY-MM-DD formatted dates from `competitions_new`
5. **Recreates indexes**: Restores all indexes on the `competitions` table:
   - `competitions_organizing_team_idx` on `organizingTeamId`
   - `competitions_group_idx` on `groupId`
   - `competitions_status_idx` on `status`
   - `competitions_start_date_idx` on `startDate`

⚠️ **Warning**: This script permanently deletes the INTEGER timestamp data. Ensure `competitions_new` has all the converted dates before running.

## Verification

After running, verify the migration was successful:

```bash
# Check that dates are in YYYY-MM-DD format
npx wrangler d1 execute wodsmith-db-prod --command="SELECT id, startDate, endDate, registrationOpensAt, registrationClosesAt FROM competitions LIMIT 5;" --remote

# Verify indexes were recreated
npx wrangler d1 execute wodsmith-db-prod --command="SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='competitions' AND name NOT LIKE 'sqlite_%';" --remote
```

Expected output should show:
- Dates in `YYYY-MM-DD` format (e.g., "2024-01-15")
- Four indexes: `competitions_organizing_team_idx`, `competitions_group_idx`, `competitions_status_idx`, `competitions_start_date_idx`

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
