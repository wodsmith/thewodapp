# Scores Migration Guide

## Overview

This directory contains scripts for migrating from the legacy `results` + `sets` tables to the new unified `scores` + `score_rounds` tables.

## Feature Flag

The application supports reading from either table via the `USE_NEW_SCORES_TABLE` environment variable:

- `USE_NEW_SCORES_TABLE=false` (default) - Reads from legacy `results` + `sets` tables
- `USE_NEW_SCORES_TABLE=true` - Reads from new `scores` + `score_rounds` tables with sortKey optimization

**Note:** Dual-write is always enabled regardless of this flag. All score submissions write to BOTH tables for data consistency during migration.

## Files

### `migrate-results-to-scores.ts`
TypeScript migration script for production use. Reads from legacy tables and converts to new format with proper sortKey computation.

**Usage:**
```bash
# Dry run to preview migration
pnpm tsx scripts/migrate-results-to-scores.ts --dry-run

# Migrate competition scores only
pnpm tsx scripts/migrate-results-to-scores.ts --competition-only

# Migrate first 100 records
pnpm tsx scripts/migrate-results-to-scores.ts --limit=100

# Full migration
pnpm tsx scripts/migrate-results-to-scores.ts
```

### `seed-scores-from-results.sql`
SQL seed data for local testing. Contains 84 sample competition scores for Winter Throwdown 2025.

**Features:**
- 21 athletes across 3 divisions (RX, Scaled, Masters 40+)
- 4 competition events (Fran, Grace, Cindy, Linda)
- Proper encoding conversions (time→milliseconds, rounds+reps→integer encoding)
- Simplified sortKey computation for seed data

**To use:**
1. Copy the INSERT statements from this file
2. Add them to `seed.sql` after the results section (~line 1180)
3. Run `pnpm db:seed` or `pnpm db:migrate:dev`

## Conversion Logic

### Time Schemes (time, time-with-cap)
- **Legacy:** seconds (e.g., 360 for 6:00)
- **New:** milliseconds (e.g., 360000)
- **Formula:** `seconds * 1000`

### Rounds+Reps (rounds-reps)
- **Legacy:** fractional (15.3 = 15 rounds + 3 reps) OR separate fields
- **New:** integer encoding `rounds * 100000 + reps`
- **Example:** 15 rounds + 3 reps = 1500003

### Load (load scheme)
- **Legacy:** pounds (e.g., 255 lbs)
- **New:** grams (e.g., 115665)
- **Formula:** `lbs * 453.592` (rounded)

### Distance (meters, feet)
- **Legacy:** meters or feet
- **New:** millimeters
- **Formula:** `meters * 1000` OR `feet * 304.8` (rounded)

### Score Status
- **Legacy:** "cap", "dq", "dns", "dnf"
- **New:** "scored", "cap", "dq", "withdrawn"
- **Mapping:** dns/dnf → "withdrawn"

### Sort Key
Encodes status + normalized score for efficient single-column sorting:
- **Structure:** 64-bit signed integer
  - Bits 62-60: status_order (0-7)
  - Bits 59-0: normalized score value
- **Status order:** 0=scored, 1=cap, 2=dq, 3=withdrawn

## Verification

After running the migration, verify:

```sql
-- Count competition scores
SELECT COUNT(*) FROM scores WHERE competition_event_id IS NOT NULL;
-- Expected: 84 scores (from seed data)

-- Scores per event
SELECT competition_event_id, COUNT(*)
FROM scores
WHERE competition_event_id IS NOT NULL
GROUP BY competition_event_id;
-- Expected: 21 scores per event

-- Check encoding
SELECT scheme, score_value, notes
FROM scores
WHERE competition_event_id = 'tw_winter_event1_fran'
ORDER BY sort_key
LIMIT 5;
-- Should show time values in milliseconds, sorted ascending
```

## Notes

- The TypeScript migration script (`migrate-results-to-scores.ts`) should be used for production data
- The SQL seed file (`seed-scores-from-results.sql`) is for local testing only
- Both scripts use the same conversion logic from `@/lib/scoring`
- D1 has a 100 SQL parameter limit - the TypeScript script handles this with batching
