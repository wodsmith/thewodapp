-- ============================================
-- SEED DATA: Competition Scores Migration
-- ============================================
--
-- This script creates sample competition scores for the Winter Throwdown 2025 competition
-- using the new `scores` and `score_rounds` tables. It demonstrates the conversion from
-- legacy results+sets format to the new unified scoring system.
--
-- CONVERSION LOGIC:
-- =================
-- 1. TIME SCHEMES (time, time-with-cap):
--    - Legacy: seconds (e.g., 360 for 6:00)
--    - New: milliseconds (e.g., 360000 for 6:00)
--    - Conversion: seconds * 1000
--
-- 2. ROUNDS+REPS (rounds-reps):
--    - Legacy: fractional format (e.g., 15.3 = 15 rounds + 3 reps) OR
--              stored as score=rounds, reps=reps in sets table
--    - New: integer encoding rounds*100000+reps (e.g., 1500003 = 15+3)
--    - Conversion: rounds * 100000 + reps
--
-- 3. LOAD (load scheme):
--    - Legacy: pounds (e.g., 255 lbs)
--    - New: grams (e.g., 115665 grams)
--    - Conversion: lbs * 453.592 (rounded)
--
-- 4. DISTANCE (meters, feet):
--    - Legacy: meters or feet
--    - New: millimeters
--    - Conversion: meters * 1000 OR feet * 304.8 (rounded)
--
-- 5. SCORE STATUS:
--    - Legacy: "cap", "dq", "dns", "dnf"
--    - New: "scored", "cap", "dq", "withdrawn"
--    - dns/dnf → "withdrawn"
--
-- 6. SORT KEY:
--    - For simplicity in seed data, we use a simplified formula:
--    - Time schemes (ascending): statusOrder * 10^18 + value
--    - Other schemes (descending): statusOrder * 10^18 + (10^15 - value)
--    - statusOrder: 0=scored, 1=cap, 2=dq, 3=withdrawn
--
-- COMPETITION STRUCTURE:
-- =====================
-- Competition: Winter Throwdown 2025 (comp_winter_throwdown_2025)
-- Events:
--   1. Fran (wod_winter_fran) - time scheme ~5 min
--   2. Grace (wod_winter_grace) - time scheme ~8 min
--   3. Cindy (wod_winter_cindy) - rounds-reps scheme (20 min AMRAP)
--   4. Linda (wod_winter_linda) - time scheme ~30 min
--
-- Divisions:
--   - RX (slvl_winter_rx) - 10 athletes
--   - Scaled (slvl_winter_scaled) - 10 athletes
--   - Masters 40+ (slvl_winter_masters_40) - 1 athlete

-- ============================================
-- EVENT 1: FRAN (Time Scheme)
-- For time: 21-15-9 thrusters + pull-ups
-- Target: ~5 minutes (300 seconds)
-- ============================================

-- RX Division - Event 1
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
-- Fast finishers (sub 4 min)
('score_mike_fran', 'usr_athlete_mike', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 223000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '223000', 'slvl_winter_rx', 1, 'Smooth bar cycling, kipping pull-ups', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_alex_fran', 'usr_athlete_alex', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 235000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '235000', 'slvl_winter_rx', 1, 'Strong finish on final round', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ryan_fran', 'usr_athlete_ryan', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 241000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '241000', 'slvl_winter_rx', 1, 'Consistent pace throughout', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Mid-pack (4-5 min)
('score_marcus_fran', 'usr_athlete_marcus', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 267000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '267000', 'slvl_winter_rx', 1, 'Struggled with pull-ups in final round', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_tyler_fran', 'usr_athlete_tyler', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 278000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '278000', 'slvl_winter_rx', 1, 'Solid performance', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_jordan_fran', 'usr_athlete_jordan', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 289000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '289000', 'slvl_winter_rx', 1, 'Good bar cycling', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Back of pack (5+ min)
('score_nathan_fran', 'usr_athlete_nathan', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 312000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '312000', 'slvl_winter_rx', 1, 'Needed breaks on thrusters', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_derek_fran', 'usr_athlete_derek', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 328000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '328000', 'slvl_winter_rx', 1, 'Tough workout!', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brandon_fran', 'usr_athlete_brandon', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 347000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '347000', 'slvl_winter_rx', 1, 'Grinded through it', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_sarah_fran', 'usr_athlete_sarah', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 256000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '256000', 'slvl_winter_rx', 1, 'Great form on thrusters', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Scaled Division - Event 1 (lighter weights, potentially assisted pull-ups)
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_emma_fran', 'usr_athlete_emma', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 298000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '298000', 'slvl_winter_scaled', 0, 'Banded pull-ups', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_john_fran', 'usr_demo3member', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 314000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '314000', 'slvl_winter_scaled', 0, 'Solid effort', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_megan_fran', 'usr_athlete_megan', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 325000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '325000', 'slvl_winter_scaled', 0, 'Steady pace', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ashley_fran', 'usr_athlete_ashley', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 338000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '338000', 'slvl_winter_scaled', 0, 'Good work', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brittany_fran', 'usr_athlete_brittany', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 356000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '356000', 'slvl_winter_scaled', 0, 'Pushed through fatigue', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_stephanie_fran', 'usr_athlete_stephanie', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 367000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '367000', 'slvl_winter_scaled', 0, 'Finished strong', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_lauren_fran', 'usr_athlete_lauren', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 378000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '378000', 'slvl_winter_scaled', 0, 'Consistent effort', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_nicole_fran', 'usr_athlete_nicole', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 391000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '391000', 'slvl_winter_scaled', 0, 'Tough but finished', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_amanda_fran', 'usr_athlete_amanda', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 412000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '412000', 'slvl_winter_scaled', 0, 'Never gave up', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_kaitlyn_fran', 'usr_athlete_kaitlyn', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 425000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '425000', 'slvl_winter_scaled', 0, 'Great heart', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Masters 40+ - Event 1
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_chris_fran', 'usr_athlete_chris', 'team_winter_throwdown_2025', 'wod_winter_fran', 'tw_winter_event1_fran', 'time', 'min', 285000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '285000', 'slvl_winter_masters_40', 1, 'Experience shows', strftime('%s', datetime('now', '+14 days', '+2 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================
-- EVENT 2: GRACE (Time Scheme)
-- For time: 30 clean-and-jerks
-- Target: ~8 minutes (480 seconds)
-- ============================================

-- RX Division - Event 2
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_alex_grace', 'usr_athlete_alex', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 387000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '387000', 'slvl_winter_rx', 1, 'Fast singles', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_mike_grace', 'usr_athlete_mike', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 412000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '412000', 'slvl_winter_rx', 1, 'Strong cleans', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_tyler_grace', 'usr_athlete_tyler', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 428000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '428000', 'slvl_winter_rx', 1, 'Paced well', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_marcus_grace', 'usr_athlete_marcus', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 445000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '445000', 'slvl_winter_rx', 1, 'Consistent', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ryan_grace', 'usr_athlete_ryan', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 461000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '461000', 'slvl_winter_rx', 1, 'Heavy weight', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_jordan_grace', 'usr_athlete_jordan', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 478000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '478000', 'slvl_winter_rx', 1, 'Tough', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_nathan_grace', 'usr_athlete_nathan', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 503000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '503000', 'slvl_winter_rx', 1, 'Grinded through', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_derek_grace', 'usr_athlete_derek', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 534000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '534000', 'slvl_winter_rx', 1, 'Heavy barbell work', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brandon_grace', 'usr_athlete_brandon', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 556000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '556000', 'slvl_winter_rx', 1, 'Challenging', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_sarah_grace', 'usr_athlete_sarah', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 467000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '467000', 'slvl_winter_rx', 1, 'Solid cleans', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Scaled Division - Event 2
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_emma_grace', 'usr_athlete_emma', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 489000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '489000', 'slvl_winter_scaled', 0, 'Lighter bar', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_megan_grace', 'usr_athlete_megan', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 512000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '512000', 'slvl_winter_scaled', 0, 'Good pace', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_john_grace', 'usr_demo3member', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 527000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '527000', 'slvl_winter_scaled', 0, 'Steady work', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ashley_grace', 'usr_athlete_ashley', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 548000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '548000', 'slvl_winter_scaled', 0, 'Finished', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brittany_grace', 'usr_athlete_brittany', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 571000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '571000', 'slvl_winter_scaled', 0, 'Tough', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_stephanie_grace', 'usr_athlete_stephanie', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 589000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '589000', 'slvl_winter_scaled', 0, 'Heavy', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_lauren_grace', 'usr_athlete_lauren', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 612000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '612000', 'slvl_winter_scaled', 0, 'Grinded', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_nicole_grace', 'usr_athlete_nicole', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 638000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '638000', 'slvl_winter_scaled', 0, 'Completed', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_amanda_grace', 'usr_athlete_amanda', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 667000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '667000', 'slvl_winter_scaled', 0, 'Hard work', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_kaitlyn_grace', 'usr_athlete_kaitlyn', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 693000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '693000', 'slvl_winter_scaled', 0, 'Persevered', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Masters 40+ - Event 2
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_chris_grace', 'usr_athlete_chris', 'team_winter_throwdown_2025', 'wod_winter_grace', 'tw_winter_event2_grace', 'time', 'min', 456000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '456000', 'slvl_winter_masters_40', 1, 'Smart pacing', strftime('%s', datetime('now', '+14 days', '+4 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================
-- EVENT 3: CINDY (Rounds+Reps Scheme)
-- AMRAP 20 minutes: 5 pull-ups, 10 push-ups, 15 air squats
-- Target: ~12 rounds
-- Encoding: rounds * 100000 + reps
-- Example: 15 rounds + 23 reps = 1500023
-- ============================================

-- RX Division - Event 3
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
-- Top performers (16+ rounds)
('score_ryan_cindy', 'usr_athlete_ryan', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1800015, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999981999985', 'slvl_winter_rx', 1, 'Unbroken sets', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_mike_cindy', 'usr_athlete_mike', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1700025, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999982299975', 'slvl_winter_rx', 1, 'Fast transitions', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_alex_cindy', 'usr_athlete_alex', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1700010, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999982299990', 'slvl_winter_rx', 1, 'Strong pace', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Mid-pack (14-16 rounds)
('score_tyler_cindy', 'usr_athlete_tyler', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1600028, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999983399972', 'slvl_winter_rx', 1, 'Consistent', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_jordan_cindy', 'usr_athlete_jordan', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1500022, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999984499978', 'slvl_winter_rx', 1, 'Good work', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_marcus_cindy', 'usr_athlete_marcus', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1500005, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999984499995', 'slvl_winter_rx', 1, 'Steady', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Back of pack (12-14 rounds)
('score_nathan_cindy', 'usr_athlete_nathan', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1400018, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999985599982', 'slvl_winter_rx', 1, 'Solid effort', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_derek_cindy', 'usr_athlete_derek', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1300015, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999986699985', 'slvl_winter_rx', 1, 'Grinded', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brandon_cindy', 'usr_athlete_brandon', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1200027, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999987799973', 'slvl_winter_rx', 1, 'Tough', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_sarah_cindy', 'usr_athlete_sarah', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1600015, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999983399985', 'slvl_winter_rx', 1, 'Strong', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Scaled Division - Event 3 (modified movements)
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_emma_cindy', 'usr_athlete_emma', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1400020, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999985599980', 'slvl_winter_scaled', 0, 'Modified', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_megan_cindy', 'usr_athlete_megan', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1300025, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999986699975', 'slvl_winter_scaled', 0, 'Good pace', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_john_cindy', 'usr_demo3member', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1300005, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999986699995', 'slvl_winter_scaled', 0, 'Steady', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ashley_cindy', 'usr_athlete_ashley', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1200018, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999987799982', 'slvl_winter_scaled', 0, 'Consistent', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brittany_cindy', 'usr_athlete_brittany', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1200003, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999987799997', 'slvl_winter_scaled', 0, 'Solid', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_stephanie_cindy', 'usr_athlete_stephanie', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1100028, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999988899972', 'slvl_winter_scaled', 0, 'Hard work', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_lauren_cindy', 'usr_athlete_lauren', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1100010, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999988899990', 'slvl_winter_scaled', 0, 'Good', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_nicole_cindy', 'usr_athlete_nicole', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1000022, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999989999978', 'slvl_winter_scaled', 0, 'Finished', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_amanda_cindy', 'usr_athlete_amanda', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1000005, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999989999995', 'slvl_winter_scaled', 0, 'Completed', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_kaitlyn_cindy', 'usr_athlete_kaitlyn', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 900025, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999991099975', 'slvl_winter_scaled', 0, 'Great effort', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Masters 40+ - Event 3
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_chris_cindy', 'usr_athlete_chris', 'team_winter_throwdown_2025', 'wod_winter_cindy', 'tw_winter_event3_cindy', 'rounds-reps', 'max', 1500018, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '999984499982', 'slvl_winter_masters_40', 1, 'Smart pacing', strftime('%s', datetime('now', '+14 days', '+6 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================
-- EVENT 4: LINDA (Time Scheme)
-- For time: 10-9-8-7-6-5-4-3-2-1 deadlift/bench/clean
-- Target: ~30 minutes (1800 seconds)
-- Finals event with 1.5x points multiplier
-- ============================================

-- RX Division - Event 4
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_mike_linda', 'usr_athlete_mike', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1567000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1567000', 'slvl_winter_rx', 1, 'Beast mode', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_alex_linda', 'usr_athlete_alex', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1612000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1612000', 'slvl_winter_rx', 1, 'Strong lifts', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ryan_linda', 'usr_athlete_ryan', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1678000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1678000', 'slvl_winter_rx', 1, 'Grinded', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_marcus_linda', 'usr_athlete_marcus', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1734000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1734000', 'slvl_winter_rx', 1, 'Heavy', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_tyler_linda', 'usr_athlete_tyler', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1789000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1789000', 'slvl_winter_rx', 1, 'Tough', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_jordan_linda', 'usr_athlete_jordan', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1856000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1856000', 'slvl_winter_rx', 1, 'Challenging', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_nathan_linda', 'usr_athlete_nathan', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1923000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1923000', 'slvl_winter_rx', 1, 'Hard work', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_derek_linda', 'usr_athlete_derek', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2034000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2034000', 'slvl_winter_rx', 1, 'Brutal', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brandon_linda', 'usr_athlete_brandon', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2145000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2145000', 'slvl_winter_rx', 1, 'Survived', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_sarah_linda', 'usr_athlete_sarah', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1823000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1823000', 'slvl_winter_rx', 1, 'Strong finish', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Scaled Division - Event 4
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_emma_linda', 'usr_athlete_emma', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1767000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1767000', 'slvl_winter_scaled', 0, 'Lighter weights', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_megan_linda', 'usr_athlete_megan', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1834000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1834000', 'slvl_winter_scaled', 0, 'Good work', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_john_linda', 'usr_demo3member', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1912000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1912000', 'slvl_winter_scaled', 0, 'Finished strong', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_ashley_linda', 'usr_athlete_ashley', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1978000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1978000', 'slvl_winter_scaled', 0, 'Tough', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_brittany_linda', 'usr_athlete_brittany', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2067000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2067000', 'slvl_winter_scaled', 0, 'Grinded', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_stephanie_linda', 'usr_athlete_stephanie', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2145000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2145000', 'slvl_winter_scaled', 0, 'Hard', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_lauren_linda', 'usr_athlete_lauren', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2234000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2234000', 'slvl_winter_scaled', 0, 'Persevered', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_nicole_linda', 'usr_athlete_nicole', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2356000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2356000', 'slvl_winter_scaled', 0, 'Completed', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_amanda_linda', 'usr_athlete_amanda', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2478000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2478000', 'slvl_winter_scaled', 0, 'Finished', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('score_kaitlyn_linda', 'usr_athlete_kaitlyn', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 2612000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '2612000', 'slvl_winter_scaled', 0, 'Never quit', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Masters 40+ - Event 4
INSERT OR IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, tiebreak_scheme, tiebreak_value, time_cap_ms, secondary_scheme, secondary_value, status, status_order, sort_key, scaling_level_id, as_rx, notes, recorded_at, createdAt, updatedAt, updateCounter) VALUES
('score_chris_linda', 'usr_athlete_chris', 'team_winter_throwdown_2025', 'wod_winter_linda', 'tw_winter_event4_linda', 'time', 'min', 1745000, NULL, NULL, NULL, NULL, NULL, 'scored', 0, '1745000', 'slvl_winter_masters_40', 1, 'Experience pays off', strftime('%s', datetime('now', '+14 days', '+8 hours')), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================
-- INSTRUCTIONS FOR ADDING TO SEED.SQL
-- ============================================
--
-- To add these scores to the main seed.sql file:
--
-- 1. Open apps/wodsmith/scripts/seed.sql
-- 2. Find the section after the results INSERT statements (around line 1180)
-- 3. Add a new section header:
--    -- ============================================
--    -- COMPETITION SCORES (NEW SCORING SYSTEM)
--    -- ============================================
-- 4. Copy all the INSERT statements from this file (starting with "-- EVENT 1: FRAN")
-- 5. Save and run: pnpm db:seed (or pnpm db:migrate:dev for local D1)
--
-- VERIFICATION:
-- After seeding, verify with:
--   SELECT COUNT(*) FROM scores WHERE competition_event_id IS NOT NULL;
--   -- Should return 84 scores (21 athletes × 4 events)
--
--   SELECT competition_event_id, COUNT(*) FROM scores
--   WHERE competition_event_id IS NOT NULL
--   GROUP BY competition_event_id;
--   -- Should show 21 scores per event
--
-- PRODUCTION MIGRATION:
-- For production, use the TypeScript migration script:
--   pnpm tsx scripts/migrate-results-to-scores.ts --competition-only
