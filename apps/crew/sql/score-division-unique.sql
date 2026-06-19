-- Widen the scoresTable unique index so one athlete can hold a distinct score
-- per division on a shared workout. Before: unique(competition_event_id, user_id)
-- collapsed an athlete's individual + partner scores into one row via
-- onDuplicateKeyUpdate, and every leaderboard/athlete-detail read keyed by
-- (event, user) pulled that single row onto every registration the user owned.
--
-- Column-name note: `scores.competition_event_id` is misleadingly named — it
-- actually stores a `track_workouts.id`, not a `competition_events.id`. Every
-- insert assigns it from the caller's `trackWorkoutId`. That's exactly the
-- right scope here: when the same workout appears in multiple divisions via
-- event-division mappings, there is one track_workout row referenced by both
-- divisions, so the unique key `(track_workout_id, user_id, scaling_level_id)`
-- is what lets a multi-division athlete hold one score per division.
--
-- Safe to run: the existing 2-column unique guarantees at most one row per
-- (track_workout, user) pair, so widening to 3 columns cannot produce
-- duplicates on existing data.

ALTER TABLE `scores` DROP INDEX `idx_scores_competition_user_unique`;

ALTER TABLE `scores`
  ADD CONSTRAINT `idx_scores_competition_user_unique`
  UNIQUE (`competition_event_id`, `user_id`, `scaling_level_id`);
