/**
 * Migration Script: results+sets → scores+score_rounds
 *
 * This script generates SQL to backfill the new scores table from the legacy results+sets tables.
 * Run the output SQL in the Drizzle Studio console for production.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-results-to-scores.ts > migration.sql
 *
 * Then copy/paste the SQL into Drizzle Studio's SQL console.
 *
 * What it does:
 * 1. Reads results + sets from legacy tables
 * 2. Converts legacy encoding to new encoding:
 *    - Time: seconds → milliseconds (*1000)
 *    - Rounds+Reps: rounds*1000+reps → rounds*100000+reps
 *    - Load: lbs → grams (*453.592)
 *    - Distance: meters/feet → millimeters
 * 3. Computes sortKey for efficient leaderboard queries
 * 4. Generates INSERT statements for scores + score_rounds tables
 */

// SQL generation script - outputs SQL to stdout
// Run with: pnpm tsx scripts/migrate-results-to-scores.ts

const sql = `
-- Migration: results+sets → scores+score_rounds
-- Generated for Drizzle Studio console execution
-- Only 101 results in prod, so this is a single batch

-- Step 1: Insert into scores table from results
-- Using INSERT OR REPLACE to handle re-runs safely
INSERT OR REPLACE INTO scores (
  id,
  user_id,
  team_id,
  workout_id,
  competition_event_id,
  scheduled_workout_instance_id,
  scheme,
  score_type,
  score_value,
  tiebreak_scheme,
  tiebreak_value,
  time_cap_ms,
  secondary_value,
  status,
  status_order,
  sort_key,
  scaling_level_id,
  as_rx,
  notes,
  recorded_at,
  createdAt,
  updatedAt
)
SELECT
  'score_' || substr(r.id, 1, 24) as id,
  r.user_id,
  w.team_id,
  r.workout_id,
  r.competition_event_id,
  r.scheduled_workout_instance_id,
  w.scheme,
  COALESCE(w.score_type, 'max') as score_type,
  -- Convert score_value based on scheme
  CASE w.scheme
    -- Time schemes: seconds → milliseconds
    WHEN 'time' THEN (
      SELECT CAST(s.time * 1000 AS INTEGER)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    WHEN 'time-with-cap' THEN (
      SELECT CAST(s.time * 1000 AS INTEGER)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    WHEN 'emom' THEN (
      SELECT CAST(s.time * 1000 AS INTEGER)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    -- Rounds+Reps: If reps column has value, use it directly (total reps)
    -- If only score column has value, treat it as total reps (legacy stored total reps in score)
    WHEN 'rounds-reps' THEN (
      SELECT CASE
        WHEN s.reps IS NOT NULL THEN s.reps
        ELSE COALESCE(s.score, 0)
      END
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    -- Reps/Calories/Points: direct value
    WHEN 'reps' THEN (
      SELECT COALESCE(s.reps, s.score)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    WHEN 'calories' THEN (
      SELECT COALESCE(s.reps, s.score)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    WHEN 'points' THEN (
      SELECT COALESCE(s.reps, s.score)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    -- Load: lbs → grams (multiply by 453.592)
    WHEN 'load' THEN (
      SELECT CAST(COALESCE(s.weight, s.score) * 453.592 AS INTEGER)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    -- Distance: meters → mm (*1000), feet → mm (*304.8)
    WHEN 'meters' THEN (
      SELECT CAST(COALESCE(s.distance, s.score) * 1000 AS INTEGER)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    WHEN 'feet' THEN (
      SELECT CAST(COALESCE(s.distance, s.score) * 304.8 AS INTEGER)
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    -- Pass/Fail: 1 for pass, 0 for fail
    WHEN 'pass-fail' THEN (
      SELECT CASE WHEN s.status = 'pass' THEN 1 ELSE 0 END
      FROM sets s
      WHERE s.result_id = r.id
      ORDER BY s.set_number
      LIMIT 1
    )
    ELSE NULL
  END as score_value,
  -- Tiebreak scheme from workout
  w.tiebreak_scheme,
  -- Tiebreak value: parse from tie_break_score
  CASE
    WHEN r.tie_break_score IS NULL THEN NULL
    WHEN w.tiebreak_scheme = 'time' AND r.tie_break_score LIKE '%:%' THEN
      -- Parse MM:SS format to milliseconds
      CAST(
        (CAST(substr(r.tie_break_score, 1, instr(r.tie_break_score, ':') - 1) AS INTEGER) * 60 +
         CAST(substr(r.tie_break_score, instr(r.tie_break_score, ':') + 1) AS INTEGER)) * 1000
        AS INTEGER
      )
    WHEN w.tiebreak_scheme = 'time' THEN
      -- Numeric seconds to milliseconds
      CAST(CAST(r.tie_break_score AS INTEGER) * 1000 AS INTEGER)
    WHEN w.tiebreak_scheme = 'reps' THEN
      CAST(r.tie_break_score AS INTEGER)
    ELSE NULL
  END as tiebreak_value,
  -- Time cap in milliseconds
  CASE WHEN w.time_cap IS NOT NULL THEN w.time_cap * 1000 ELSE NULL END as time_cap_ms,
  -- Secondary value (reps when capped)
  CASE WHEN r.secondary_score IS NOT NULL THEN CAST(r.secondary_score AS INTEGER) ELSE NULL END as secondary_value,
  -- Status conversion
  CASE LOWER(r.score_status)
    WHEN 'cap' THEN 'cap'
    WHEN 'dq' THEN 'dq'
    WHEN 'dns' THEN 'withdrawn'
    WHEN 'dnf' THEN 'withdrawn'
    ELSE 'scored'
  END as status,
  -- Status order for sorting
  CASE LOWER(r.score_status)
    WHEN 'cap' THEN 1
    WHEN 'dq' THEN 2
    WHEN 'dns' THEN 3
    WHEN 'dnf' THEN 3
    ELSE 0
  END as status_order,
  -- Sort key computation
  -- Format: status_order (1 digit) + normalized_score (15 digits, zero-padded)
  -- For "lower is better" (time): use score directly
  -- For "higher is better" (reps, rounds-reps, load, etc): use MAX_VALUE - score
  CASE
    WHEN w.scheme IN ('time', 'time-with-cap', 'emom') THEN
      -- Lower is better: status_order + score
      printf('%01d%015d',
        CASE LOWER(r.score_status)
          WHEN 'cap' THEN 1
          WHEN 'dq' THEN 2
          WHEN 'dns' THEN 3
          WHEN 'dnf' THEN 3
          ELSE 0
        END,
        COALESCE((
          SELECT CAST(s.time * 1000 AS INTEGER)
          FROM sets s
          WHERE s.result_id = r.id
          ORDER BY s.set_number
          LIMIT 1
        ), 999999999999999)
      )
    WHEN w.scheme IN ('rounds-reps', 'reps', 'calories', 'points', 'load', 'meters', 'feet') THEN
      -- Higher is better: status_order + (MAX - score)
      printf('%01d%015d',
        CASE LOWER(r.score_status)
          WHEN 'cap' THEN 1
          WHEN 'dq' THEN 2
          WHEN 'dns' THEN 3
          WHEN 'dnf' THEN 3
          ELSE 0
        END,
        999999999999999 - COALESCE(
          CASE w.scheme
            WHEN 'rounds-reps' THEN (
              SELECT CASE
                WHEN s.reps IS NOT NULL THEN s.reps
                ELSE COALESCE(s.score, 0)
              END
              FROM sets s
              WHERE s.result_id = r.id
              ORDER BY s.set_number
              LIMIT 1
            )
            WHEN 'load' THEN (
              SELECT CAST(COALESCE(s.weight, s.score) * 453.592 AS INTEGER)
              FROM sets s
              WHERE s.result_id = r.id
              ORDER BY s.set_number
              LIMIT 1
            )
            WHEN 'meters' THEN (
              SELECT CAST(COALESCE(s.distance, s.score) * 1000 AS INTEGER)
              FROM sets s
              WHERE s.result_id = r.id
              ORDER BY s.set_number
              LIMIT 1
            )
            WHEN 'feet' THEN (
              SELECT CAST(COALESCE(s.distance, s.score) * 304.8 AS INTEGER)
              FROM sets s
              WHERE s.result_id = r.id
              ORDER BY s.set_number
              LIMIT 1
            )
            ELSE (
              SELECT COALESCE(s.reps, s.score, 0)
              FROM sets s
              WHERE s.result_id = r.id
              ORDER BY s.set_number
              LIMIT 1
            )
          END,
          0
        )
      )
    ELSE NULL
  END as sort_key,
  -- Only use scaling_level_id if it exists in scaling_levels table
  CASE 
    WHEN r.scaling_level_id IN (SELECT id FROM scaling_levels) THEN r.scaling_level_id
    ELSE NULL
  END as scaling_level_id,
  r.as_rx,
  r.notes,
  r.date as recorded_at,
  r.createdAt,
  COALESCE(r.updatedAt, r.createdAt) as updatedAt
FROM results r
JOIN workouts w ON r.workout_id = w.id
WHERE r.workout_id IS NOT NULL
  AND w.team_id IS NOT NULL;

-- Step 2: Insert score_rounds for results with multiple sets
-- This handles multi-round workouts like "3 rounds for time" or "10x3 Back Squat"
INSERT OR REPLACE INTO score_rounds (
  id,
  score_id,
  round_number,
  value,
  scheme_override,
  status,
  secondary_value,
  notes,
  created_at
)
SELECT
  'scrd_' || substr(s.id, 1, 24) as id,
  'score_' || substr(r.id, 1, 24) as score_id,
  s.set_number as round_number,
  -- Convert value based on scheme
  CASE w.scheme
    WHEN 'time' THEN CAST(s.time * 1000 AS INTEGER)
    WHEN 'time-with-cap' THEN CAST(s.time * 1000 AS INTEGER)
    WHEN 'emom' THEN CAST(s.time * 1000 AS INTEGER)
    WHEN 'rounds-reps' THEN CASE WHEN s.reps IS NOT NULL THEN s.reps ELSE COALESCE(s.score, 0) END
    WHEN 'reps' THEN COALESCE(s.reps, s.score)
    WHEN 'calories' THEN COALESCE(s.reps, s.score)
    WHEN 'points' THEN COALESCE(s.reps, s.score)
    WHEN 'load' THEN CAST(COALESCE(s.weight, s.score) * 453.592 AS INTEGER)
    WHEN 'meters' THEN CAST(COALESCE(s.distance, s.score) * 1000 AS INTEGER)
    WHEN 'feet' THEN CAST(COALESCE(s.distance, s.score) * 304.8 AS INTEGER)
    WHEN 'pass-fail' THEN CASE WHEN s.status = 'pass' THEN 1 ELSE 0 END
    ELSE COALESCE(s.score, s.reps, 0)
  END as value,
  NULL as scheme_override,
  NULL as status,
  NULL as secondary_value,
  s.notes,
  s.createdAt as created_at
FROM sets s
JOIN results r ON s.result_id = r.id
JOIN workouts w ON r.workout_id = w.id
WHERE r.workout_id IS NOT NULL
  AND w.team_id IS NOT NULL
  -- Exclude sets where value would be NULL (NOT NULL constraint on score_rounds.value)
  AND (
    CASE w.scheme
      WHEN 'time' THEN s.time IS NOT NULL
      WHEN 'time-with-cap' THEN s.time IS NOT NULL
      WHEN 'emom' THEN s.time IS NOT NULL
      WHEN 'rounds-reps' THEN 1 -- Always has a value due to COALESCE
      WHEN 'reps' THEN s.reps IS NOT NULL OR s.score IS NOT NULL
      WHEN 'calories' THEN s.reps IS NOT NULL OR s.score IS NOT NULL
      WHEN 'points' THEN s.reps IS NOT NULL OR s.score IS NOT NULL
      WHEN 'load' THEN s.weight IS NOT NULL OR s.score IS NOT NULL
      WHEN 'meters' THEN s.distance IS NOT NULL OR s.score IS NOT NULL
      WHEN 'feet' THEN s.distance IS NOT NULL OR s.score IS NOT NULL
      WHEN 'pass-fail' THEN 1 -- Always has a value (0 or 1)
      ELSE s.score IS NOT NULL OR s.reps IS NOT NULL
    END
  );

-- Verification queries (run these after to check the migration)
-- SELECT COUNT(*) as total_scores FROM scores;
-- SELECT COUNT(*) as total_rounds FROM score_rounds;
-- SELECT scheme, COUNT(*) as count FROM scores GROUP BY scheme;
-- SELECT status, COUNT(*) as count FROM scores GROUP BY status;
`;

console.log(sql);
