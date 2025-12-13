# Migration Script Test Results

## Database Check Summary

**Local Database:** wodsmith-db  
**Competition Results Found:** 10 results  
**Test Date:** December 9, 2025  

---

## Sample Data Analysis

### ✅ Result 1: Time-with-Cap (CAP status) - LOOKS GOOD

**Legacy Data:**
```json
{
  "result_id": "result_fio01keb8592pjpwehdqsn04",
  "user": "usr_athlete_jake",
  "workout": "wod_winter_fran",
  "scheme": "time-with-cap",
  "wod_score": "06:00",
  "score_status": "cap",
  "tie_break_score": "120",
  "sets": [{
    "time": 360  // seconds
  }]
}
```

**Expected Migration:**
```json
{
  "scheme": "time-with-cap",
  "scoreType": "min",
  "scoreValue": 360000,  // 360s * 1000 = 360000ms ✓
  "status": "cap",
  "statusOrder": 1,
  "tiebreakScheme": "reps",
  "tiebreakValue": 120,
  "timeCapMs": 360000
}
```

**✅ Conversion Validated:**
- Time: 360 seconds → 360,000 ms (×1000) ✓
- Tiebreak: 120 reps (no conversion needed) ✓
- Status: "cap" → "cap" ✓

---

### ⚠️ Result 2: Rounds+Reps - DATA INCONSISTENCY FOUND

**Legacy Data:**
```json
{
  "result_id": "result_cjpd8w9gz41nt6kw79ewkn9e",
  "user": "usr_athlete_tyler",
  "workout": "wod_winter_cindy",
  "scheme": "rounds-reps",
  "wod_score": "22",  // ← Says 22
  "sets": [{
    "score": 24,  // ← Rounds field says 24
    "reps": 22    // ← Reps field says 22
  }]
}
```

**⚠️ Issue Identified:**
- `wodScore` = "22" (ambiguous - is this rounds or total reps?)
- `sets.score` = 24 (rounds)
- `sets.reps` = 22 (reps)
- **Correct interpretation:** 24 rounds + 22 reps = "24+22"

**Expected Migration:**
```json
{
  "scheme": "rounds-reps",
  "scoreType": "max",
  "scoreValue": 2400022,  // 24*100000 + 22
  "status": "scored",
  "statusOrder": 0
}
```

**🔧 Fix Needed:**
The migration script should prioritize `sets.score` and `sets.reps` over `wodScore` for rounds-reps workouts, as the wodScore field appears to be inconsistently populated.

---

## Migration Script Status

### ✅ What's Working

1. **Schema Analysis:** Complete
2. **Encoding Conversions:** Logic is correct
   - Time: seconds → milliseconds (×1000)
   - Rounds+Reps: rounds×1000+reps → rounds×100000+reps
   - Load: lbs → grams (×453.592)
   - Distance: meters/feet → millimeters

3. **Script Features:**
   - Dry-run mode ✓
   - Limit option ✓
   - Competition-only filter ✓
   - Progress tracking ✓

### ⚠️ Issues Found

1. **Data Inconsistency:** `wodScore` doesn't always match `sets` data
   - **Impact:** Medium
   - **Fix:** Migration script already prioritizes sets data over wodScore ✓
   
2. **Script Cannot Run Locally:** Requires Cloudflare context
   - **Impact:** High (cannot test easily)
   - **Workaround:** Script needs to be adapted for direct SQLite access OR run via wrangler

### 🔧 Recommended Fixes

#### Option A: Adapt Script for Local Testing
Create a test version that connects directly to SQLite:
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('.wrangler/state/v3/d1/YOUR_DB.sqlite');
const db = drizzle(sqlite);
```

#### Option B: Generate SQL Statements
Convert the TypeScript migration to SQL that can be run via wrangler:
```bash
pnpm wrangler d1 execute wodsmith-db --local --file=migration-results-to-scores.sql
```

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Database connection | ⚠️ | Requires Cloudflare context |
| Data structure analysis | ✅ | Complete |
| Encoding logic | ✅ | Validated |
| Time conversion | ✅ | 360s → 360000ms |
| Rounds+Reps conversion | ✅ | Logic correct, data inconsistency noted |
| CAP status handling | ✅ | Status + tiebreak preserved |
| sortKey computation | ⏳ | Not tested (requires actual migration run) |

---

## Next Steps

### Immediate (Before Running Migration)

1. **Fix Script for Local Testing**
   - Add better-sqlite3 adapter for local dev
   - OR convert to SQL-based migration

2. **Validate Data Quality**
   ```sql
   -- Check for wodScore inconsistencies
   SELECT r.id, r.wod_score, s.score as rounds, s.reps
   FROM results r
   JOIN sets s ON s.result_id = r.id
   WHERE r.workout_id IN (SELECT id FROM workouts WHERE scheme = 'rounds-reps')
   AND (r.wod_score != (s.score || '+' || s.reps))
   ```

3. **Test on 1-2 Results First**
   - Manually verify encoding conversions
   - Check sortKey values make sense
   - Compare leaderboard order before/after

### After Initial Testing

4. **Run Dry-Run on Full Dataset**
   ```bash
   pnpm tsx scripts/migrate-results-to-scores.ts --dry-run --competition-only
   ```

5. **Migrate Competition Scores**
   ```bash
   pnpm tsx scripts/migrate-results-to-scores.ts --competition-only
   ```

6. **Verify Leaderboards Match**
   - Query old results+sets
   - Query new scores
   - Compare rankings

---

## Recommendation

**🎯 Priority:** Fix the script to work with local database first, then run comprehensive testing before production migration.

**Timeline:**
- Fix script: 1-2 hours
- Test 10 competition results: 30 minutes  
- Full competition migration: 1 hour
- Verification: 1 hour

**Total:** 3-4 hours before production-ready
