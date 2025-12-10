-- Preview migration from results+sets to scores
-- This query shows what data would be migrated

SELECT 
  r.id as result_id,
  r.user_id,
  r.workout_id,
  w.scheme,
  w.score_type,
  r.wod_score as legacy_wod_score,
  r.score_status,
  r.tie_break_score,
  r.competition_event_id,
  r.scaling_level_id,
  COUNT(s.id) as set_count
FROM results r
LEFT JOIN workouts w ON r.workout_id = w.id
LEFT JOIN sets s ON s.result_id = r.id
WHERE r.competition_event_id IS NOT NULL
  AND r.workout_id IS NOT NULL
GROUP BY r.id
LIMIT 5;
