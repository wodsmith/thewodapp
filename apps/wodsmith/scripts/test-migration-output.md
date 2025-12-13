# Migration Test Output

## Sample Results from Local Database

### Result 1: Time-with-Cap (CAP status)
**Legacy Data:**
```
result_id: result_fio01keb8592pjpwehdqsn04
user_id: usr_athlete_jake
workout: wod_winter_fran
scheme: time-with-cap
legacy_wod_score: "06:00"
score_status: cap
tie_break_score: "120"
sets: [{ time: 360 }]  // 360 seconds = 6:00
```

**New Encoding (what would be migrated):**
```
scheme: "time-with-cap"
scoreType: "min"
scoreValue: 360000  // 360 seconds * 1000 = 360000 ms
status: "cap"
statusOrder: 1
tiebreakScheme: "reps"
tiebreakValue: 120
timeCapMs: 360000
sortKey: [computed based on status + normalized value]
```

**Conversion:**
- Time: 360 seconds → 360,000 milliseconds (×1000) ✓
- Tiebreak: 120 reps → 120 (no conversion) ✓
- Status: "cap" → "cap" ✓

---

### Result 2: Rounds+Reps (AMRAP)
**Legacy Data:**
```
result_id: result_cjpd8w9gz41nt6kw79ewkn9e
user_id: usr_athlete_tyler
workout: wod_winter_cindy
scheme: rounds-reps
legacy_wod_score: "22"
score_status: scored
sets: [{ score: ? }]  // Need to check actual set data
```

**New Encoding (what would be migrated):**
```
scheme: "rounds-reps"
scoreType: "max"
scoreValue: ???  // Need to determine if 22 is rounds or reps
status: "scored"
statusOrder: 0
sortKey: [computed]
```

**Question:** Is "22" stored as 22 rounds, or 22 total reps?
- If sets.score = 22 and sets.reps = null → 22 rounds
- Legacy: 22 rounds * 1000 = 22000
- New: 22 rounds * 100000 = 2200000

---

## Key Observations

1. **Time Conversion Works:**
   - Legacy: 360 seconds
   - New: 360000 ms
   - Formula: `legacy * 1000` ✓

2. **CAP Status Handled:**
   - Status preserved
   - Tiebreak preserved
   - Time cap should be extracted from workout definition

3. **Sets Data Structure:**
   - Single set for most competition results
   - Time stored in `sets.time` (seconds)
   - Rounds stored in `sets.score`
   - Reps stored in `sets.reps`

4. **Missing Data:**
   - Need to check actual sets data for rounds+reps results
   - Need workout.time_cap for time-capped workouts

---

## Next Steps

1. Query actual sets data for rounds+reps results
2. Verify workout.time_cap values
3. Test encoding conversions match expected values
4. Run dry-run migration on these 5 results
