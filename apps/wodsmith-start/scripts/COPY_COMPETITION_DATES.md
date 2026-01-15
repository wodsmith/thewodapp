# Copy Competition Dates Script

## Purpose

This script copies the date fields (`startDate`, `endDate`, `registrationOpensAt`, `registrationClosesAt`) from a `competitions_new` table to the existing `competitions` table.

## Prerequisites

- Both `competitions` and `competitions_new` tables must exist
- Tables must have matching `id` columns
- Date fields should be in the same format in both tables

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

The script executes an UPDATE statement that:
1. Matches records by `id` between `competitions` and `competitions_new`
2. Copies the four date fields from `competitions_new` to `competitions`
3. Only updates rows where a matching record exists in `competitions_new`

## Verification

After running, verify the dates were copied:

```bash
# Check a few records
npx wrangler d1 execute wodsmith-db-prod --command="SELECT id, startDate, endDate, registrationOpensAt, registrationClosesAt FROM competitions LIMIT 5;" --remote
```

## Safety

- This script only updates existing records in `competitions`
- It does not create or delete any records
- Only rows with matching IDs in both tables are affected
- Run on a backup or test database first if uncertain
