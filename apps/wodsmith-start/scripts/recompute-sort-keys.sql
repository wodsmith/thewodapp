-- Fix sort_key ordering for rounds-reps scores on a specific track workout.
--
-- The original sort key used 20 bits for the primary value, which overflows
-- for rounds-reps scores above ~10 rounds (encoded as rounds * 100,000 + reps).
--
-- SQLite can't compute the full 103-bit sort keys, so we use a simplified
-- encoding that produces correct relative ordering within this event.
-- After deploying the code fix, re-entering a score or running a TS
-- recomputation script will write the proper format.
--
-- For scored rounds-reps (descending): invert score_value so higher = smaller sort key.
--
-- Usage:
--   wrangler d1 execute <DB_NAME> --file=scripts/recompute-sort-keys.sql [--remote]

UPDATE scores
SET sort_key = printf('%032d', 1099511627775 - score_value)
WHERE sort_key IS NOT NULL
  AND competition_event_id = 'trwk_shfq9i2nrgiamdopv6c0pgon';
