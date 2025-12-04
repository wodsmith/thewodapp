-- ============================================
-- Mountain West Fitness Championship (MWFC 2025)
-- SQL Seed Script
-- ============================================
-- NOTE: Replace 'team_cokkpu1klwo0ulfhl1iwzpvnbox1' with your actual organizing team ID
-- NOTE: Workout descriptions are placeholders - actual details at:
-- https://drive.google.com/drive/u/1/folders/1hD0bj7y2VI-RTcOTFFyms3iOBnZNbthC

INSERT INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mwfc2025_event', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'MWFC 2025 Event', 'mwfc-2025-event', 'competition_event', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1');

-- 1. SCALING GROUP (Division Container)
-- ============================================
INSERT INTO scaling_groups (id, createdAt, updatedAt, updateCounter, title, description, teamId, isDefault, isSystem)
VALUES (
  'sgrp_mwfc2025_divisions',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'MWFC 2025 Divisions',
  'Divisions for Mountain West Fitness Championship 2025',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1', -- Replace with your organizing team ID
  0,
  0
);

-- ============================================
-- 2. SCALING LEVELS (Individual Divisions)
-- ============================================
-- All divisions are team of 2

-- Co-Ed Divisions
INSERT INTO scaling_levels (id, createdAt, updatedAt, updateCounter, scalingGroupId, label, position, teamSize)
VALUES
  ('slvl_mwfc_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Co-Ed - RX', 0, 2),
  ('slvl_mwfc_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Co-Ed - Intermediate', 1, 2),
  ('slvl_mwfc_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Co-Ed - Rookie', 2, 2);

-- Men's Divisions
INSERT INTO scaling_levels (id, createdAt, updatedAt, updateCounter, scalingGroupId, label, position, teamSize)
VALUES
  ('slvl_mwfc_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Men''s - RX', 3, 2),
  ('slvl_mwfc_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Men''s - Intermediate', 4, 2),
  ('slvl_mwfc_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Men''s - Rookie', 5, 2);

-- Women's Divisions
INSERT INTO scaling_levels (id, createdAt, updatedAt, updateCounter, scalingGroupId, label, position, teamSize)
VALUES
  ('slvl_mwfc_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Women''s - RX', 6, 2),
  ('slvl_mwfc_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Women''s - Intermediate', 7, 2),
  ('slvl_mwfc_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Women''s - Rookie', 8, 2);

-- Masters Co-Ed Divisions
INSERT INTO scaling_levels (id, createdAt, updatedAt, updateCounter, scalingGroupId, label, position, teamSize)
VALUES
  ('slvl_mwfc_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Masters Co-Ed - RX', 9, 2),
  ('slvl_mwfc_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Masters Co-Ed - Intermediate', 10, 2);

-- Masters Men's Divisions
INSERT INTO scaling_levels (id, createdAt, updatedAt, updateCounter, scalingGroupId, label, position, teamSize)
VALUES
  ('slvl_mwfc_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Masters Men''s - RX', 11, 2),
  ('slvl_mwfc_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Masters Men''s - Intermediate', 12, 2),
  ('slvl_mwfc_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Masters Men''s - Rookie', 13, 2);

-- Masters Women's Divisions
INSERT INTO scaling_levels (id, createdAt, updatedAt, updateCounter, scalingGroupId, label, position, teamSize)
VALUES
  ('slvl_mwfc_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'sgrp_mwfc2025_divisions', 'Masters Women''s - Intermediate', 14, 2);

-- ============================================
-- 3. COMPETITION
-- ============================================
INSERT INTO competitions (
  id, createdAt, updatedAt, updateCounter,
  organizingTeamId, competitionTeamId, groupId,
  slug, name, description,
  startDate, endDate,
  registrationOpensAt, registrationClosesAt,
  settings, defaultRegistrationFeeCents,
  platformFeePercentage, platformFeeFixed,
  passStripeFeesToCustomer, passPlatformFeesToCustomer,
  visibility, profileImageUrl, bannerImageUrl
)
VALUES (
  'comp_mwfc2025',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1', -- Replace: organizing team (gym)
  'team_mwfc2025_event', -- Will need to create this competition_event team
  NULL, -- No group
  'mwfc-2025',
  'Mountain West Fitness Championship (MWFC 2025)',
  'The Mountain West Fitness Competition gives "Everyday" CrossFit Athletes of all experience & fitness levels their chance to challenge themselves, while showing off their hard work and have a great time with their friends and the fitness community.

Canyon County Fair Event Center, Caldwell, ID will host 400+ athletes during the 2025 MWFC.

Friday & Saturday Schedule:
- Thursday early Check-In: 4:00pm-8:00pm
- Friday Check-In: 7:00am-9:00am
- Friday Workouts: 9:00am-8:00pm
- Saturday Workouts: 9:00am-8:00pm
- Podium: 8:00pm

This Competition will be only teams of 2.

Come prepared. Bring whatever food and beverages you need to stay fueled and hydrated during the day, and any supportive equipment you may need (ie belts, hand protection). The competition will be inside.

Spectators: 1-Day: $15, 2-Day: $25
Kids under 12: Free

Contact: mountainwestchampionship@gmail.com',
  strftime('%s', '2025-10-10 08:00:00'),
  strftime('%s', '2025-10-11 20:00:00'),
  strftime('%s', '2025-10-01 00:00:00'), -- registrationOpensAt
  strftime('%s', '2025-10-10 00:00:00'), -- registrationClosesAt
  json_object(
    'location', json_object(
      'venue', 'Canyon County Fair Event Center',
      'address', '110 County Fair Ave',
      'city', 'Caldwell',
      'state', 'ID',
      'zip', '83605',
      'country', 'United States'
    ),
    'divisions', json_object('scalingGroupId', 'sgrp_mwfc2025_divisions'),
    'externalUrl', 'https://competitioncorner.net/events/15905'
  ),
  0, -- Free registration (handled externally)
  250, -- 2.5% platform fee
  200, -- $2.00 fixed fee
  0, -- passStripeFeesToCustomer
  1, -- passPlatformFeesToCustomer
  'public',
  NULL, -- profileImageUrl
  NULL  -- bannerImageUrl
);

-- ============================================
-- 4. COMPETITION VENUE
-- ============================================
INSERT INTO competition_venues (id, createdAt, updatedAt, updateCounter, competitionId, name, laneCount, transitionMinutes, sortOrder)
VALUES (
  'cvenue_mwfc_main',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'comp_mwfc2025',
  'Main Stage',
  10, -- Estimated lane count
  15, -- 15 min transition between heats
  0
);

-- ============================================
-- 5. PROGRAMMING TRACK (Competition Events)
-- ============================================
INSERT INTO programming_track (id, createdAt, updatedAt, updateCounter, name, description, type, ownerTeamId, scalingGroupId, isPublic, competitionId)
VALUES (
  'ptrk_mwfc2025',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'MWFC 2025 Events',
  'Competition events for Mountain West Fitness Championship 2025',
  'team_owned',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1', -- Replace with organizing team
  'sgrp_mwfc2025_divisions',
  1,
  'comp_mwfc2025'
);

-- ============================================
-- 6. WORKOUTS
-- ============================================
-- NOTE: Actual workout descriptions should be added from the Google Drive folder
-- https://drive.google.com/drive/u/1/folders/1hD0bj7y2VI-RTcOTFFyms3iOBnZNbthC

-- Workout 1: Sawtooth
INSERT INTO workouts (id, createdAt, updatedAt, updateCounter, name, description, scope, scheme, score_type, team_id, scaling_group_id)
VALUES (
  'wod_mwfc_sawtooth',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'Sawtooth',
  'Workout #1 - Sponsored by Propath Financial

[Add workout description from MWFC athlete folder]

Scoring: For Repetitions (More is Better)',
  'private',
  'reps', -- For Repetitions scoring
  'max',  -- More is better
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'sgrp_mwfc2025_divisions'
);

-- Workout 2: Steelhead
INSERT INTO workouts (id, createdAt, updatedAt, updateCounter, name, description, scope, scheme, score_type, team_id, scaling_group_id)
VALUES (
  'wod_mwfc_steelhead',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'Steelhead',
  'Workout #2 - Sponsored by Scheels

[Add workout description from MWFC athlete folder]',
  'private',
  'reps',
  'max',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'sgrp_mwfc2025_divisions'
);

-- Workout 3: Spud Nation
INSERT INTO workouts (id, createdAt, updatedAt, updateCounter, name, description, scope, scheme, score_type, team_id, scaling_group_id)
VALUES (
  'wod_mwfc_spud_nation',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'Spud Nation',
  'Workout #3 - Sponsored by RXSG

[Add workout description from MWFC athlete folder]',
  'private',
  'reps',
  'max',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'sgrp_mwfc2025_divisions'
);

-- Workout 4: Bronco
INSERT INTO workouts (id, createdAt, updatedAt, updateCounter, name, description, scope, scheme, score_type, team_id, scaling_group_id)
VALUES (
  'wod_mwfc_bronco',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'Bronco',
  'Workout #4 - Sponsored by GymReapers

[Add workout description from MWFC athlete folder]',
  'private',
  'reps',
  'max',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'sgrp_mwfc2025_divisions'
);

-- Workout 5: Vandal
INSERT INTO workouts (id, createdAt, updatedAt, updateCounter, name, description, scope, scheme, score_type, team_id, scaling_group_id)
VALUES (
  'wod_mwfc_vandal',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'Vandal',
  'Workout #5 - Sponsored by Reign

[Add workout description from MWFC athlete folder]',
  'private',
  'reps',
  'max',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'sgrp_mwfc2025_divisions'
);

-- Workout 6: Mountain West Tommy V
INSERT INTO workouts (id, createdAt, updatedAt, updateCounter, name, description, scope, scheme, score_type, team_id, scaling_group_id)
VALUES (
  'wod_mwfc_tommy_v',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'Mountain West Tommy V',
  'Workout #6 - Sponsored by Restore & Nutrishop

[Add workout description from MWFC athlete folder]',
  'private',
  'reps',
  'max',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'sgrp_mwfc2025_divisions'
);

-- ============================================
-- 7. WORKOUT SCALING DESCRIPTIONS (Per-Division Variations)
-- ============================================
-- Each workout has different weights/reps/movements per division
-- Format: workoutId + scalingLevelId = unique description

-- ----------------------------------------
-- WORKOUT 1: SAWTOOTH - Per Division
-- ----------------------------------------
-- RX Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_saw_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_coed_rx',
   '[SAWTOOTH - Co-Ed RX]
Add workout description here with RX weights/standards'),
  ('wsd_saw_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_mens_rx',
   '[SAWTOOTH - Men''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_saw_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_womens_rx',
   '[SAWTOOTH - Women''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_saw_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_masters_coed_rx',
   '[SAWTOOTH - Masters Co-Ed RX]
Add workout description here with Masters RX weights/standards'),
  ('wsd_saw_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_masters_mens_rx',
   '[SAWTOOTH - Masters Men''s RX]
Add workout description here with Masters RX weights/standards');

-- Intermediate Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_saw_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_coed_int',
   '[SAWTOOTH - Co-Ed Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_saw_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_mens_int',
   '[SAWTOOTH - Men''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_saw_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_womens_int',
   '[SAWTOOTH - Women''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_saw_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_masters_coed_int',
   '[SAWTOOTH - Masters Co-Ed Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_saw_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_masters_mens_int',
   '[SAWTOOTH - Masters Men''s Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_saw_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_masters_womens_int',
   '[SAWTOOTH - Masters Women''s Intermediate]
Add workout description here with Masters Intermediate weights/standards');

-- Rookie Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_saw_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_coed_rookie',
   '[SAWTOOTH - Co-Ed Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_saw_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_mens_rookie',
   '[SAWTOOTH - Men''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_saw_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_womens_rookie',
   '[SAWTOOTH - Women''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_saw_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_sawtooth', 'slvl_mwfc_masters_mens_rookie',
   '[SAWTOOTH - Masters Men''s Rookie]
Add workout description here with Masters Rookie weights/standards');

-- ----------------------------------------
-- WORKOUT 2: STEELHEAD - Per Division
-- ----------------------------------------
-- RX Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_steel_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_coed_rx',
   '[STEELHEAD - Co-Ed RX]
Add workout description here with RX weights/standards'),
  ('wsd_steel_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_mens_rx',
   '[STEELHEAD - Men''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_steel_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_womens_rx',
   '[STEELHEAD - Women''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_steel_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_masters_coed_rx',
   '[STEELHEAD - Masters Co-Ed RX]
Add workout description here with Masters RX weights/standards'),
  ('wsd_steel_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_masters_mens_rx',
   '[STEELHEAD - Masters Men''s RX]
Add workout description here with Masters RX weights/standards');

-- Intermediate Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_steel_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_coed_int',
   '[STEELHEAD - Co-Ed Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_steel_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_mens_int',
   '[STEELHEAD - Men''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_steel_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_womens_int',
   '[STEELHEAD - Women''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_steel_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_masters_coed_int',
   '[STEELHEAD - Masters Co-Ed Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_steel_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_masters_mens_int',
   '[STEELHEAD - Masters Men''s Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_steel_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_masters_womens_int',
   '[STEELHEAD - Masters Women''s Intermediate]
Add workout description here with Masters Intermediate weights/standards');

-- Rookie Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_steel_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_coed_rookie',
   '[STEELHEAD - Co-Ed Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_steel_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_mens_rookie',
   '[STEELHEAD - Men''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_steel_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_womens_rookie',
   '[STEELHEAD - Women''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_steel_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_steelhead', 'slvl_mwfc_masters_mens_rookie',
   '[STEELHEAD - Masters Men''s Rookie]
Add workout description here with Masters Rookie weights/standards');

-- ----------------------------------------
-- WORKOUT 3: SPUD NATION - Per Division
-- ----------------------------------------
-- RX Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_spud_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_coed_rx',
   '[SPUD NATION - Co-Ed RX]
Add workout description here with RX weights/standards'),
  ('wsd_spud_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_mens_rx',
   '[SPUD NATION - Men''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_spud_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_womens_rx',
   '[SPUD NATION - Women''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_spud_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_masters_coed_rx',
   '[SPUD NATION - Masters Co-Ed RX]
Add workout description here with Masters RX weights/standards'),
  ('wsd_spud_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_masters_mens_rx',
   '[SPUD NATION - Masters Men''s RX]
Add workout description here with Masters RX weights/standards');

-- Intermediate Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_spud_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_coed_int',
   '[SPUD NATION - Co-Ed Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_spud_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_mens_int',
   '[SPUD NATION - Men''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_spud_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_womens_int',
   '[SPUD NATION - Women''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_spud_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_masters_coed_int',
   '[SPUD NATION - Masters Co-Ed Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_spud_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_masters_mens_int',
   '[SPUD NATION - Masters Men''s Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_spud_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_masters_womens_int',
   '[SPUD NATION - Masters Women''s Intermediate]
Add workout description here with Masters Intermediate weights/standards');

-- Rookie Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_spud_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_coed_rookie',
   '[SPUD NATION - Co-Ed Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_spud_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_mens_rookie',
   '[SPUD NATION - Men''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_spud_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_womens_rookie',
   '[SPUD NATION - Women''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_spud_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_spud_nation', 'slvl_mwfc_masters_mens_rookie',
   '[SPUD NATION - Masters Men''s Rookie]
Add workout description here with Masters Rookie weights/standards');

-- ----------------------------------------
-- WORKOUT 4: BRONCO - Per Division
-- ----------------------------------------
-- RX Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_bronco_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_coed_rx',
   '[BRONCO - Co-Ed RX]
Add workout description here with RX weights/standards'),
  ('wsd_bronco_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_mens_rx',
   '[BRONCO - Men''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_bronco_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_womens_rx',
   '[BRONCO - Women''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_bronco_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_masters_coed_rx',
   '[BRONCO - Masters Co-Ed RX]
Add workout description here with Masters RX weights/standards'),
  ('wsd_bronco_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_masters_mens_rx',
   '[BRONCO - Masters Men''s RX]
Add workout description here with Masters RX weights/standards');

-- Intermediate Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_bronco_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_coed_int',
   '[BRONCO - Co-Ed Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_bronco_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_mens_int',
   '[BRONCO - Men''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_bronco_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_womens_int',
   '[BRONCO - Women''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_bronco_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_masters_coed_int',
   '[BRONCO - Masters Co-Ed Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_bronco_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_masters_mens_int',
   '[BRONCO - Masters Men''s Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_bronco_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_masters_womens_int',
   '[BRONCO - Masters Women''s Intermediate]
Add workout description here with Masters Intermediate weights/standards');

-- Rookie Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_bronco_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_coed_rookie',
   '[BRONCO - Co-Ed Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_bronco_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_mens_rookie',
   '[BRONCO - Men''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_bronco_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_womens_rookie',
   '[BRONCO - Women''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_bronco_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_bronco', 'slvl_mwfc_masters_mens_rookie',
   '[BRONCO - Masters Men''s Rookie]
Add workout description here with Masters Rookie weights/standards');

-- ----------------------------------------
-- WORKOUT 5: VANDAL - Per Division
-- ----------------------------------------
-- RX Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_vandal_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_coed_rx',
   '[VANDAL - Co-Ed RX]
Add workout description here with RX weights/standards'),
  ('wsd_vandal_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_mens_rx',
   '[VANDAL - Men''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_vandal_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_womens_rx',
   '[VANDAL - Women''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_vandal_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_masters_coed_rx',
   '[VANDAL - Masters Co-Ed RX]
Add workout description here with Masters RX weights/standards'),
  ('wsd_vandal_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_masters_mens_rx',
   '[VANDAL - Masters Men''s RX]
Add workout description here with Masters RX weights/standards');

-- Intermediate Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_vandal_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_coed_int',
   '[VANDAL - Co-Ed Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_vandal_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_mens_int',
   '[VANDAL - Men''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_vandal_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_womens_int',
   '[VANDAL - Women''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_vandal_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_masters_coed_int',
   '[VANDAL - Masters Co-Ed Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_vandal_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_masters_mens_int',
   '[VANDAL - Masters Men''s Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_vandal_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_masters_womens_int',
   '[VANDAL - Masters Women''s Intermediate]
Add workout description here with Masters Intermediate weights/standards');

-- Rookie Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_vandal_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_coed_rookie',
   '[VANDAL - Co-Ed Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_vandal_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_mens_rookie',
   '[VANDAL - Men''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_vandal_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_womens_rookie',
   '[VANDAL - Women''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_vandal_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_vandal', 'slvl_mwfc_masters_mens_rookie',
   '[VANDAL - Masters Men''s Rookie]
Add workout description here with Masters Rookie weights/standards');

-- ----------------------------------------
-- WORKOUT 6: MOUNTAIN WEST TOMMY V - Per Division
-- ----------------------------------------
-- RX Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_tommy_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_coed_rx',
   '[MOUNTAIN WEST TOMMY V - Co-Ed RX]
Add workout description here with RX weights/standards'),
  ('wsd_tommy_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_mens_rx',
   '[MOUNTAIN WEST TOMMY V - Men''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_tommy_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_womens_rx',
   '[MOUNTAIN WEST TOMMY V - Women''s RX]
Add workout description here with RX weights/standards'),
  ('wsd_tommy_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_masters_coed_rx',
   '[MOUNTAIN WEST TOMMY V - Masters Co-Ed RX]
Add workout description here with Masters RX weights/standards'),
  ('wsd_tommy_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_masters_mens_rx',
   '[MOUNTAIN WEST TOMMY V - Masters Men''s RX]
Add workout description here with Masters RX weights/standards');

-- Intermediate Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_tommy_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_coed_int',
   '[MOUNTAIN WEST TOMMY V - Co-Ed Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_tommy_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_mens_int',
   '[MOUNTAIN WEST TOMMY V - Men''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_tommy_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_womens_int',
   '[MOUNTAIN WEST TOMMY V - Women''s Intermediate]
Add workout description here with Intermediate weights/standards'),
  ('wsd_tommy_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_masters_coed_int',
   '[MOUNTAIN WEST TOMMY V - Masters Co-Ed Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_tommy_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_masters_mens_int',
   '[MOUNTAIN WEST TOMMY V - Masters Men''s Intermediate]
Add workout description here with Masters Intermediate weights/standards'),
  ('wsd_tommy_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_masters_womens_int',
   '[MOUNTAIN WEST TOMMY V - Masters Women''s Intermediate]
Add workout description here with Masters Intermediate weights/standards');

-- Rookie Divisions
INSERT INTO workout_scaling_descriptions (id, createdAt, updatedAt, updateCounter, workoutId, scalingLevelId, description)
VALUES
  ('wsd_tommy_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_coed_rookie',
   '[MOUNTAIN WEST TOMMY V - Co-Ed Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_tommy_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_mens_rookie',
   '[MOUNTAIN WEST TOMMY V - Men''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_tommy_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_womens_rookie',
   '[MOUNTAIN WEST TOMMY V - Women''s Rookie]
Add workout description here with Rookie weights/standards'),
  ('wsd_tommy_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'wod_mwfc_tommy_v', 'slvl_mwfc_masters_mens_rookie',
   '[MOUNTAIN WEST TOMMY V - Masters Men''s Rookie]
Add workout description here with Masters Rookie weights/standards');

-- ============================================
-- 8. TRACK WORKOUTS (Link workouts to track)
-- ============================================
INSERT INTO track_workout (id, createdAt, updatedAt, updateCounter, trackId, workoutId, trackOrder, notes, pointsMultiplier, heatStatus, eventStatus)
VALUES
  ('trwk_mwfc_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ptrk_mwfc2025', 'wod_mwfc_sawtooth', 1, 'Friday Event 1', 100, 'published', 'published'),
  ('trwk_mwfc_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ptrk_mwfc2025', 'wod_mwfc_steelhead', 2, 'Friday Event 2', 100, 'published', 'published'),
  ('trwk_mwfc_3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ptrk_mwfc2025', 'wod_mwfc_spud_nation', 3, 'Friday Event 3', 100, 'published', 'published'),
  ('trwk_mwfc_4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ptrk_mwfc2025', 'wod_mwfc_bronco', 4, 'Saturday Event 1', 100, 'published', 'published'),
  ('trwk_mwfc_5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ptrk_mwfc2025', 'wod_mwfc_vandal', 5, 'Saturday Event 2', 100, 'published', 'published'),
  ('trwk_mwfc_6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'ptrk_mwfc2025', 'wod_mwfc_tommy_v', 6, 'Saturday Event 3 - Finals', 100, 'published', 'published');

-- ============================================
-- 8. COMPETITION HEATS (Schedule)
-- ============================================
-- Friday October 10, 2025

-- Workout 1: Sawtooth - 09:00 AM - 12:33 PM (213 min total)
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mwfc_w1_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-10 09:00:00'), 20, NULL, 'Heat 1 - Multiple Divisions'),
  ('cheat_mwfc_w1_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-10 09:30:00'), 20, NULL, 'Heat 2'),
  ('cheat_mwfc_w1_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-10 10:00:00'), 20, NULL, 'Heat 3'),
  ('cheat_mwfc_w1_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-10 10:30:00'), 20, NULL, 'Heat 4'),
  ('cheat_mwfc_w1_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-10 11:00:00'), 20, NULL, 'Heat 5'),
  ('cheat_mwfc_w1_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-10 11:30:00'), 20, NULL, 'Heat 6'),
  ('cheat_mwfc_w1_h7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 7, strftime('%s', '2025-10-10 12:00:00'), 20, NULL, 'Heat 7');

-- Workout 2: Steelhead - 01:06 PM - 04:03 PM
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mwfc_w2_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-10 13:06:00'), 20, NULL, 'Heat 1'),
  ('cheat_mwfc_w2_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-10 13:36:00'), 20, NULL, 'Heat 2'),
  ('cheat_mwfc_w2_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-10 14:06:00'), 20, NULL, 'Heat 3'),
  ('cheat_mwfc_w2_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-10 14:36:00'), 20, NULL, 'Heat 4'),
  ('cheat_mwfc_w2_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-10 15:06:00'), 20, NULL, 'Heat 5'),
  ('cheat_mwfc_w2_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-10 15:36:00'), 20, NULL, 'Heat 6');

-- Workout 3: Spud Nation - 04:36 PM - 07:09 PM
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mwfc_w3_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-10 16:36:00'), 20, NULL, 'Heat 1'),
  ('cheat_mwfc_w3_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-10 17:06:00'), 20, NULL, 'Heat 2'),
  ('cheat_mwfc_w3_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-10 17:36:00'), 20, NULL, 'Heat 3'),
  ('cheat_mwfc_w3_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-10 18:06:00'), 20, NULL, 'Heat 4'),
  ('cheat_mwfc_w3_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-10 18:36:00'), 20, NULL, 'Heat 5');

-- Saturday October 11, 2025

-- Workout 4: Bronco - 08:30 AM - 11:03 AM
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mwfc_w4_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-11 08:30:00'), 20, NULL, 'Heat 1'),
  ('cheat_mwfc_w4_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-11 09:00:00'), 20, NULL, 'Heat 2'),
  ('cheat_mwfc_w4_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-11 09:30:00'), 20, NULL, 'Heat 3'),
  ('cheat_mwfc_w4_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-11 10:00:00'), 20, NULL, 'Heat 4'),
  ('cheat_mwfc_w4_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-11 10:30:00'), 20, NULL, 'Heat 5');

-- Workout 5: Vandal - 11:36 AM - 03:33 PM
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mwfc_w5_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-11 11:36:00'), 20, NULL, 'Heat 1'),
  ('cheat_mwfc_w5_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-11 12:06:00'), 20, NULL, 'Heat 2'),
  ('cheat_mwfc_w5_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-11 12:36:00'), 20, NULL, 'Heat 3'),
  ('cheat_mwfc_w5_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-11 13:06:00'), 20, NULL, 'Heat 4'),
  ('cheat_mwfc_w5_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-11 13:36:00'), 20, NULL, 'Heat 5'),
  ('cheat_mwfc_w5_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-11 14:06:00'), 20, NULL, 'Heat 6'),
  ('cheat_mwfc_w5_h7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 7, strftime('%s', '2025-10-11 14:36:00'), 20, NULL, 'Heat 7'),
  ('cheat_mwfc_w5_h8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 8, strftime('%s', '2025-10-11 15:06:00'), 20, NULL, 'Heat 8');

-- Workout 6: Mountain West Tommy V - 04:06 PM - 07:03 PM (Finals)
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mwfc_w6_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 1, strftime('%s', '2025-10-11 16:06:00'), 20, NULL, 'Heat 1'),
  ('cheat_mwfc_w6_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 2, strftime('%s', '2025-10-11 16:36:00'), 20, NULL, 'Heat 2'),
  ('cheat_mwfc_w6_h3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 3, strftime('%s', '2025-10-11 17:06:00'), 20, NULL, 'Heat 3'),
  ('cheat_mwfc_w6_h4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 4, strftime('%s', '2025-10-11 17:36:00'), 20, NULL, 'Heat 4'),
  ('cheat_mwfc_w6_h5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 5, strftime('%s', '2025-10-11 18:06:00'), 20, NULL, 'Heat 5'),
  ('cheat_mwfc_w6_h6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 6, strftime('%s', '2025-10-11 18:36:00'), 20, NULL, 'Heat 6');

-- ============================================
-- SUMMARY
-- ============================================
-- Competition: Mountain West Fitness Championship (MWFC 2025)
-- Dates: October 10-11, 2025
-- Location: Canyon County Fair Event Center, Caldwell, ID
--
-- 15 Divisions (all team of 2):
--   - Co-Ed: RX, Intermediate, Rookie
--   - Men's: RX, Intermediate, Rookie
--   - Women's: RX, Intermediate, Rookie
--   - Masters Co-Ed: RX, Intermediate
--   - Masters Men's: RX, Intermediate, Rookie
--   - Masters Women's: Intermediate
--
-- 6 Workouts:
--   Friday: Sawtooth, Steelhead, Spud Nation
--   Saturday: Bronco, Vandal, Mountain West Tommy V
--
-- 90 Workout Scaling Descriptions (6 workouts × 15 divisions)
--   Each workout has per-division variations with different weights/reps/movements
--
-- 1 Venue: Main Stage
-- 38 Heats total across all workouts
--
-- BEFORE RUNNING:
-- 1. Replace 'team_cokkpu1klwo0ulfhl1iwzpvnbox1' with actual organizing team ID
-- 2. Create competition_event team with id 'team_mwfc2025_event'
-- 3. Fill in actual workout descriptions from Google Drive folder:
--    https://drive.google.com/drive/u/1/folders/1hD0bj7y2VI-RTcOTFFyms3iOBnZNbthC
--
-- WORKOUT SCALING DESCRIPTION IDS:
--   Pattern: wsd_{workout}_{division}
--   Examples:
--     wsd_saw_coed_rx      → Sawtooth, Co-Ed RX
--     wsd_steel_mens_int   → Steelhead, Men's Intermediate
--     wsd_bronco_womens_rookie → Bronco, Women's Rookie

-- ============================================
-- 10. MEN'S RX DIVISION - TEAMS & REGISTRATIONS
-- ============================================
-- 20 teams total (17 competed, 3 withdrew)

-- ----------------------------------------
-- ATHLETE SQUAD TEAMS (competition_team type)
-- ----------------------------------------
-- These are the 2-person teams competing in Men's RX

INSERT INTO team (id, createdAt, updatedAt, updateCounter, name, slug, type, parentOrganizationId)
VALUES
  ('team_mrx_gymreapers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'GYMREAPERS', 'mrx-gymreapers', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_uxo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'UXO', 'mrx-uxo', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_stud_puffins', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Stud Puffins', 'mrx-stud-puffins', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_white_lotus', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'White Lotus', 'mrx-white-lotus', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_quick_thick', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Quick & Thick', 'mrx-quick-thick', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_rad_boys', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'R.A.D Boys', 'mrx-rad-boys', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_rad_dads', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'R.A.D Dads', 'mrx-rad-dads', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_boonie_bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Boonie Bros', 'mrx-boonie-bros', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_power_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'The Power Snatch Kids', 'mrx-power-snatch-kids', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_90_problems', strftime('%s', 'now'), strftime('%s', 'now'), 1, '''90 problems, ''04 ain''t one', 'mrx-90-problems', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_titanic', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Titanic Swim Team', 'mrx-titanic-swim', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_blind_date', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Blind Date', 'mrx-blind-date', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_biggie_smalls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Biggie Smalls', 'mrx-biggie-smalls', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_team_rx_minus', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Team RX minus', 'mrx-team-rx-minus', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_rxish', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'RX-ish', 'mrx-rxish', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_fyb', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'FYB', 'mrx-fyb', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_chaos_boys', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'CHAOS BOYS', 'mrx-chaos-boys', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_lift_me_baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Lift me baby one more time', 'mrx-lift-me-baby', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_golden_big_backs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'Golden Big Backs', 'mrx-golden-big-backs', 'competition_team', 'team_mwfc2025_event'),
  ('team_mrx_standin_bidness', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'STANDIN ON BIDNESS (AT THE BEACH)', 'mrx-standin-bidness', 'competition_team', 'team_mwfc2025_event');

-- ----------------------------------------
-- PLACEHOLDER USERS (Athletes)
-- ----------------------------------------
-- Creating placeholder users for team members
-- In production, these would be real user accounts

INSERT INTO user (id, createdAt, updatedAt, email, firstName, lastName)
VALUES
  -- GYMREAPERS (Kulak CrossFit)
  ('user_mrx_gymreapers_1', strftime('%s', 'now'), strftime('%s', 'now'), 'gymreapers1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_gymreapers_2', strftime('%s', 'now'), strftime('%s', 'now'), 'gymreapers2@placeholder.local', 'Athlete', 'Two'),
  -- UXO (Verdant CrossFit)
  ('user_mrx_uxo_1', strftime('%s', 'now'), strftime('%s', 'now'), 'uxo1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_uxo_2', strftime('%s', 'now'), strftime('%s', 'now'), 'uxo2@placeholder.local', 'Athlete', 'Two'),
  -- Stud Puffins (CrossFit Casual)
  ('user_mrx_studpuffins_1', strftime('%s', 'now'), strftime('%s', 'now'), 'studpuffins1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_studpuffins_2', strftime('%s', 'now'), strftime('%s', 'now'), 'studpuffins2@placeholder.local', 'Athlete', 'Two'),
  -- White Lotus (CrossFit Hyperion)
  ('user_mrx_whitelotus_1', strftime('%s', 'now'), strftime('%s', 'now'), 'whitelotus1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_whitelotus_2', strftime('%s', 'now'), strftime('%s', 'now'), 'whitelotus2@placeholder.local', 'Athlete', 'Two'),
  -- Quick & Thick (CrossFit Fullerton)
  ('user_mrx_quickthick_1', strftime('%s', 'now'), strftime('%s', 'now'), 'quickthick1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_quickthick_2', strftime('%s', 'now'), strftime('%s', 'now'), 'quickthick2@placeholder.local', 'Athlete', 'Two'),
  -- R.A.D Boys (Snake River CrossFit)
  ('user_mrx_radboys_1', strftime('%s', 'now'), strftime('%s', 'now'), 'radboys1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_radboys_2', strftime('%s', 'now'), strftime('%s', 'now'), 'radboys2@placeholder.local', 'Athlete', 'Two'),
  -- R.A.D Dads (CrossFit Fireside)
  ('user_mrx_raddads_1', strftime('%s', 'now'), strftime('%s', 'now'), 'raddads1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_raddads_2', strftime('%s', 'now'), strftime('%s', 'now'), 'raddads2@placeholder.local', 'Athlete', 'Two'),
  -- Boonie Bros (Independent)
  ('user_mrx_booniebros_1', strftime('%s', 'now'), strftime('%s', 'now'), 'booniebros1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_booniebros_2', strftime('%s', 'now'), strftime('%s', 'now'), 'booniebros2@placeholder.local', 'Athlete', 'Two'),
  -- The Power Snatch Kids (The Pack 208)
  ('user_mrx_powersnatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 'powersnatch1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_powersnatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 'powersnatch2@placeholder.local', 'Athlete', 'Two'),
  -- '90 problems (Verdant CrossFit)
  ('user_mrx_90problems_1', strftime('%s', 'now'), strftime('%s', 'now'), '90problems1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_90problems_2', strftime('%s', 'now'), strftime('%s', 'now'), '90problems2@placeholder.local', 'Athlete', 'Two'),
  -- Titanic Swim Team (CrossFit Canvas)
  ('user_mrx_titanic_1', strftime('%s', 'now'), strftime('%s', 'now'), 'titanic1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_titanic_2', strftime('%s', 'now'), strftime('%s', 'now'), 'titanic2@placeholder.local', 'Athlete', 'Two'),
  -- Blind Date (Slate S&C)
  ('user_mrx_blinddate_1', strftime('%s', 'now'), strftime('%s', 'now'), 'blinddate1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_blinddate_2', strftime('%s', 'now'), strftime('%s', 'now'), 'blinddate2@placeholder.local', 'Athlete', 'Two'),
  -- Biggie Smalls (Last Rep CrossFit)
  ('user_mrx_biggiesmalls_1', strftime('%s', 'now'), strftime('%s', 'now'), 'biggiesmalls1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_biggiesmalls_2', strftime('%s', 'now'), strftime('%s', 'now'), 'biggiesmalls2@placeholder.local', 'Athlete', 'Two'),
  -- Team RX minus (Rock Canyon CrossFit)
  ('user_mrx_rxminus_1', strftime('%s', 'now'), strftime('%s', 'now'), 'rxminus1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_rxminus_2', strftime('%s', 'now'), strftime('%s', 'now'), 'rxminus2@placeholder.local', 'Athlete', 'Two'),
  -- RX-ish (CrossFit Twin Falls)
  ('user_mrx_rxish_1', strftime('%s', 'now'), strftime('%s', 'now'), 'rxish1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_rxish_2', strftime('%s', 'now'), strftime('%s', 'now'), 'rxish2@placeholder.local', 'Athlete', 'Two'),
  -- FYB (Four Rivers CrossFit)
  ('user_mrx_fyb_1', strftime('%s', 'now'), strftime('%s', 'now'), 'fyb1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_fyb_2', strftime('%s', 'now'), strftime('%s', 'now'), 'fyb2@placeholder.local', 'Athlete', 'Two'),
  -- CHAOS BOYS (Chaos S&C) - Withdrew
  ('user_mrx_chaos_1', strftime('%s', 'now'), strftime('%s', 'now'), 'chaos1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_chaos_2', strftime('%s', 'now'), strftime('%s', 'now'), 'chaos2@placeholder.local', 'Athlete', 'Two'),
  -- Lift me baby one more time (Verdant CrossFit) - Withdrew
  ('user_mrx_liftme_1', strftime('%s', 'now'), strftime('%s', 'now'), 'liftme1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_liftme_2', strftime('%s', 'now'), strftime('%s', 'now'), 'liftme2@placeholder.local', 'Athlete', 'Two'),
  -- Golden Big Backs (OSO CrossFit) - Withdrew
  ('user_mrx_goldenbig_1', strftime('%s', 'now'), strftime('%s', 'now'), 'goldenbig1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_goldenbig_2', strftime('%s', 'now'), strftime('%s', 'now'), 'goldenbig2@placeholder.local', 'Athlete', 'Two'),
  -- STANDIN ON BIDNESS (CrossFit Fort Vancouver) - Withdrew
  ('user_mrx_standin_1', strftime('%s', 'now'), strftime('%s', 'now'), 'standin1@placeholder.local', 'Athlete', 'One'),
  ('user_mrx_standin_2', strftime('%s', 'now'), strftime('%s', 'now'), 'standin2@placeholder.local', 'Athlete', 'Two');

-- ----------------------------------------
-- TEAM MEMBERSHIPS (Link users to athlete squads)
-- ----------------------------------------
INSERT INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole)
VALUES
  -- GYMREAPERS
  ('tm_mrx_gymreapers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_gymreapers', 'user_mrx_gymreapers_1', 'admin', 1),
  ('tm_mrx_gymreapers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_gymreapers', 'user_mrx_gymreapers_2', 'member', 1),
  -- UXO
  ('tm_mrx_uxo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_uxo', 'user_mrx_uxo_1', 'admin', 1),
  ('tm_mrx_uxo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_uxo', 'user_mrx_uxo_2', 'member', 1),
  -- Stud Puffins
  ('tm_mrx_studpuffins_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_stud_puffins', 'user_mrx_studpuffins_1', 'admin', 1),
  ('tm_mrx_studpuffins_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_stud_puffins', 'user_mrx_studpuffins_2', 'member', 1),
  -- White Lotus
  ('tm_mrx_whitelotus_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_white_lotus', 'user_mrx_whitelotus_1', 'admin', 1),
  ('tm_mrx_whitelotus_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_white_lotus', 'user_mrx_whitelotus_2', 'member', 1),
  -- Quick & Thick
  ('tm_mrx_quickthick_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_quick_thick', 'user_mrx_quickthick_1', 'admin', 1),
  ('tm_mrx_quickthick_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_quick_thick', 'user_mrx_quickthick_2', 'member', 1),
  -- R.A.D Boys
  ('tm_mrx_radboys_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_rad_boys', 'user_mrx_radboys_1', 'admin', 1),
  ('tm_mrx_radboys_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_rad_boys', 'user_mrx_radboys_2', 'member', 1),
  -- R.A.D Dads
  ('tm_mrx_raddads_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_rad_dads', 'user_mrx_raddads_1', 'admin', 1),
  ('tm_mrx_raddads_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_rad_dads', 'user_mrx_raddads_2', 'member', 1),
  -- Boonie Bros
  ('tm_mrx_booniebros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_boonie_bros', 'user_mrx_booniebros_1', 'admin', 1),
  ('tm_mrx_booniebros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_boonie_bros', 'user_mrx_booniebros_2', 'member', 1),
  -- The Power Snatch Kids
  ('tm_mrx_powersnatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_power_snatch', 'user_mrx_powersnatch_1', 'admin', 1),
  ('tm_mrx_powersnatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_power_snatch', 'user_mrx_powersnatch_2', 'member', 1),
  -- '90 problems
  ('tm_mrx_90problems_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_90_problems', 'user_mrx_90problems_1', 'admin', 1),
  ('tm_mrx_90problems_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_90_problems', 'user_mrx_90problems_2', 'member', 1),
  -- Titanic Swim Team
  ('tm_mrx_titanic_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_titanic', 'user_mrx_titanic_1', 'admin', 1),
  ('tm_mrx_titanic_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_titanic', 'user_mrx_titanic_2', 'member', 1),
  -- Blind Date
  ('tm_mrx_blinddate_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_blind_date', 'user_mrx_blinddate_1', 'admin', 1),
  ('tm_mrx_blinddate_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_blind_date', 'user_mrx_blinddate_2', 'member', 1),
  -- Biggie Smalls
  ('tm_mrx_biggiesmalls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_biggie_smalls', 'user_mrx_biggiesmalls_1', 'admin', 1),
  ('tm_mrx_biggiesmalls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_biggie_smalls', 'user_mrx_biggiesmalls_2', 'member', 1),
  -- Team RX minus
  ('tm_mrx_rxminus_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_team_rx_minus', 'user_mrx_rxminus_1', 'admin', 1),
  ('tm_mrx_rxminus_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_team_rx_minus', 'user_mrx_rxminus_2', 'member', 1),
  -- RX-ish
  ('tm_mrx_rxish_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_rxish', 'user_mrx_rxish_1', 'admin', 1),
  ('tm_mrx_rxish_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_rxish', 'user_mrx_rxish_2', 'member', 1),
  -- FYB
  ('tm_mrx_fyb_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_fyb', 'user_mrx_fyb_1', 'admin', 1),
  ('tm_mrx_fyb_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_fyb', 'user_mrx_fyb_2', 'member', 1),
  -- CHAOS BOYS (Withdrew)
  ('tm_mrx_chaos_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_chaos_boys', 'user_mrx_chaos_1', 'admin', 1),
  ('tm_mrx_chaos_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_chaos_boys', 'user_mrx_chaos_2', 'member', 1),
  -- Lift me baby one more time (Withdrew)
  ('tm_mrx_liftme_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_lift_me_baby', 'user_mrx_liftme_1', 'admin', 1),
  ('tm_mrx_liftme_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_lift_me_baby', 'user_mrx_liftme_2', 'member', 1),
  -- Golden Big Backs (Withdrew)
  ('tm_mrx_goldenbig_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_golden_big_backs', 'user_mrx_goldenbig_1', 'admin', 1),
  ('tm_mrx_goldenbig_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_golden_big_backs', 'user_mrx_goldenbig_2', 'member', 1),
  -- STANDIN ON BIDNESS (Withdrew)
  ('tm_mrx_standin_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_standin_bidness', 'user_mrx_standin_1', 'admin', 1),
  ('tm_mrx_standin_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mrx_standin_bidness', 'user_mrx_standin_2', 'member', 1);

-- ----------------------------------------
-- COMPETITION EVENT TEAM MEMBERSHIPS (Men's RX)
-- ----------------------------------------
-- Users must be members of the competition_event team to have valid registrations
-- This must come BEFORE competition_registrations

INSERT INTO team_membership (id, createdAt, updatedAt, updateCounter, teamId, userId, roleId, isSystemRole, joinedAt)
VALUES
  ('tmem_event_gymreapers_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_gymreapers_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_gymreapers_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_gymreapers_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_uxo_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_uxo_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_uxo_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_uxo_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_studpuffins_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_studpuffins_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_studpuffins_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_studpuffins_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_whitelotus_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_whitelotus_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_whitelotus_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_whitelotus_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_quickthick_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_quickthick_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_quickthick_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_quickthick_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_radboys_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_radboys_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_radboys_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_radboys_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_raddads_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_raddads_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_raddads_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_raddads_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_booniebros_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_booniebros_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_booniebros_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_booniebros_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_powersnatch_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_powersnatch_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_powersnatch_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_powersnatch_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_90problems_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_90problems_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_90problems_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_90problems_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_titanic_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_titanic_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_titanic_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_titanic_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_blinddate_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_blinddate_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_blinddate_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_blinddate_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_biggiesmalls_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_biggiesmalls_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_biggiesmalls_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_biggiesmalls_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_rxminus_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_rxminus_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_rxminus_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_rxminus_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_rxish_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_rxish_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_rxish_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_rxish_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_fyb_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_fyb_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_fyb_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_fyb_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_chaos_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_chaos_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_chaos_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_chaos_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_liftme_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_liftme_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_liftme_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_liftme_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_goldenbig_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_goldenbig_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_goldenbig_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_goldenbig_2', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_standin_1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_standin_1', 'member', 1, strftime('%s', '2025-08-01')),
  ('tmem_event_standin_2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'team_mwfc2025_event', 'user_mrx_standin_2', 'member', 1, strftime('%s', '2025-08-01'));

-- ----------------------------------------
-- COMMERCE - PRODUCT & PURCHASES (Men's RX)
-- ----------------------------------------
-- $350 per team registration = 35000 cents
-- Must come BEFORE competition_registrations

-- Commerce Product for MWFC 2025 Registration
INSERT INTO commerce_product (id, createdAt, updatedAt, updateCounter, name, type, resourceId, priceCents)
VALUES (
  'cprod_mwfc2025_reg',
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  1,
  'MWFC 2025 Team Registration',
  'COMPETITION_REGISTRATION',
  'comp_mwfc2025',
  35000
);

-- Commerce Purchases for Men's RX Teams ($350 each)
-- Fee breakdown: $350 total, ~$8.75 platform fee (2.5%), ~$10.45 Stripe fee (2.9% + $0.30), $330.80 organizer net
INSERT INTO commerce_purchase (id, createdAt, updatedAt, updateCounter, userId, productId, status, competitionId, divisionId, totalCents, platformFeeCents, stripeFeeCents, organizerNetCents, completedAt)
VALUES
  ('cpur_mrx_gymreapers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_gymreapers_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_uxo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_uxo_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_stud_puffins', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_studpuffins_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_white_lotus', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_whitelotus_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_quick_thick', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_quickthick_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_rad_boys', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_radboys_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_rad_dads', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_raddads_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_boonie_bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_booniebros_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_power_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_powersnatch_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_90_problems', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_90problems_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_titanic', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_titanic_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_blind_date', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_blinddate_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_biggie_smalls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_biggiesmalls_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_team_rx_minus', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_rxminus_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_rxish', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_rxish_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_fyb', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_fyb_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_chaos_boys', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_chaos_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_lift_me_baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_liftme_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_golden_big_backs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_goldenbig_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01')),
  ('cpur_mrx_standin_bidness', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'user_mrx_standin_1', 'cprod_mwfc2025_reg', 'COMPLETED', 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 875, 1045, 33080, strftime('%s', '2025-08-01'));

-- ----------------------------------------
-- COMPETITION REGISTRATIONS (Men's RX)
-- ----------------------------------------
-- Links athlete teams to the competition with their division
-- teamMemberId links to the user's membership in the competition_event team
-- commercePurchaseId links to the payment record

INSERT INTO competition_registrations (id, createdAt, updatedAt, updateCounter, eventId, userId, teamMemberId, divisionId, registeredAt, teamName, captainUserId, athleteTeamId, commercePurchaseId, paymentStatus, paidAt)
VALUES
  ('creg_mrx_gymreapers', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_gymreapers_1', 'tmem_event_gymreapers_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'GYMREAPERS', 'user_mrx_gymreapers_1', 'team_mrx_gymreapers', 'cpur_mrx_gymreapers', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_uxo', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_uxo_1', 'tmem_event_uxo_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'UXO', 'user_mrx_uxo_1', 'team_mrx_uxo', 'cpur_mrx_uxo', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_stud_puffins', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_studpuffins_1', 'tmem_event_studpuffins_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Stud Puffins', 'user_mrx_studpuffins_1', 'team_mrx_stud_puffins', 'cpur_mrx_stud_puffins', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_white_lotus', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_whitelotus_1', 'tmem_event_whitelotus_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'White Lotus', 'user_mrx_whitelotus_1', 'team_mrx_white_lotus', 'cpur_mrx_white_lotus', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_quick_thick', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_quickthick_1', 'tmem_event_quickthick_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Quick & Thick', 'user_mrx_quickthick_1', 'team_mrx_quick_thick', 'cpur_mrx_quick_thick', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_rad_boys', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_radboys_1', 'tmem_event_radboys_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'R.A.D Boys', 'user_mrx_radboys_1', 'team_mrx_rad_boys', 'cpur_mrx_rad_boys', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_rad_dads', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_raddads_1', 'tmem_event_raddads_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'R.A.D Dads', 'user_mrx_raddads_1', 'team_mrx_rad_dads', 'cpur_mrx_rad_dads', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_boonie_bros', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_booniebros_1', 'tmem_event_booniebros_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Boonie Bros', 'user_mrx_booniebros_1', 'team_mrx_boonie_bros', 'cpur_mrx_boonie_bros', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_power_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_powersnatch_1', 'tmem_event_powersnatch_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'The Power Snatch Kids', 'user_mrx_powersnatch_1', 'team_mrx_power_snatch', 'cpur_mrx_power_snatch', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_90_problems', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_90problems_1', 'tmem_event_90problems_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), '''90 problems, ''04 ain''t one', 'user_mrx_90problems_1', 'team_mrx_90_problems', 'cpur_mrx_90_problems', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_titanic', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_titanic_1', 'tmem_event_titanic_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Titanic Swim Team', 'user_mrx_titanic_1', 'team_mrx_titanic', 'cpur_mrx_titanic', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_blind_date', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_blinddate_1', 'tmem_event_blinddate_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Blind Date', 'user_mrx_blinddate_1', 'team_mrx_blind_date', 'cpur_mrx_blind_date', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_biggie_smalls', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_biggiesmalls_1', 'tmem_event_biggiesmalls_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Biggie Smalls', 'user_mrx_biggiesmalls_1', 'team_mrx_biggie_smalls', 'cpur_mrx_biggie_smalls', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_team_rx_minus', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_rxminus_1', 'tmem_event_rxminus_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Team RX minus', 'user_mrx_rxminus_1', 'team_mrx_team_rx_minus', 'cpur_mrx_team_rx_minus', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_rxish', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_rxish_1', 'tmem_event_rxish_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'RX-ish', 'user_mrx_rxish_1', 'team_mrx_rxish', 'cpur_mrx_rxish', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_fyb', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_fyb_1', 'tmem_event_fyb_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'FYB', 'user_mrx_fyb_1', 'team_mrx_fyb', 'cpur_mrx_fyb', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_chaos_boys', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_chaos_1', 'tmem_event_chaos_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'CHAOS BOYS', 'user_mrx_chaos_1', 'team_mrx_chaos_boys', 'cpur_mrx_chaos_boys', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_lift_me_baby', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_liftme_1', 'tmem_event_liftme_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Lift me baby one more time', 'user_mrx_liftme_1', 'team_mrx_lift_me_baby', 'cpur_mrx_lift_me_baby', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_golden_big_backs', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_goldenbig_1', 'tmem_event_goldenbig_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'Golden Big Backs', 'user_mrx_goldenbig_1', 'team_mrx_golden_big_backs', 'cpur_mrx_golden_big_backs', 'PAID', strftime('%s', '2025-08-01')),
  ('creg_mrx_standin_bidness', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'user_mrx_standin_1', 'tmem_event_standin_1', 'slvl_mwfc_mens_rx', strftime('%s', '2025-08-01'), 'STANDIN ON BIDNESS (AT THE BEACH)', 'user_mrx_standin_1', 'team_mrx_standin_bidness', 'cpur_mrx_standin_bidness', 'PAID', strftime('%s', '2025-08-01'));

-- ----------------------------------------
-- MEN'S RX HEATS (Division-Specific)
-- ----------------------------------------
-- Creating heats specifically for Men's RX division
-- With 17 active teams (3 withdrew), we can fit in 2 heats of ~8-9 teams

-- Workout 1: Sawtooth - Men's RX Heat
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mrx_w1_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 101, strftime('%s', '2025-10-10 10:00:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 1'),
  ('cheat_mrx_w1_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_1', 'cvenue_mwfc_main', 102, strftime('%s', '2025-10-10 10:30:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 2');

-- Workout 2: Steelhead - Men's RX Heat
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mrx_w2_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 101, strftime('%s', '2025-10-10 14:00:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 1'),
  ('cheat_mrx_w2_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_2', 'cvenue_mwfc_main', 102, strftime('%s', '2025-10-10 14:30:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 2');

-- Workout 3: Spud Nation - Men's RX Heat
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mrx_w3_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 101, strftime('%s', '2025-10-10 17:30:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 1'),
  ('cheat_mrx_w3_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_3', 'cvenue_mwfc_main', 102, strftime('%s', '2025-10-10 18:00:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 2');

-- Workout 4: Bronco - Men's RX Heat
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mrx_w4_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 101, strftime('%s', '2025-10-11 09:00:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 1'),
  ('cheat_mrx_w4_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_4', 'cvenue_mwfc_main', 102, strftime('%s', '2025-10-11 09:30:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 2');

-- Workout 5: Vandal - Men's RX Heat
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mrx_w5_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 101, strftime('%s', '2025-10-11 12:30:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 1'),
  ('cheat_mrx_w5_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_5', 'cvenue_mwfc_main', 102, strftime('%s', '2025-10-11 13:00:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 2');

-- Workout 6: Mountain West Tommy V - Men's RX Heat (Finals)
INSERT INTO competition_heats (id, createdAt, updatedAt, updateCounter, competitionId, trackWorkoutId, venueId, heatNumber, scheduledTime, durationMinutes, divisionId, notes)
VALUES
  ('cheat_mrx_w6_h1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 101, strftime('%s', '2025-10-11 17:00:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 1 - Finals'),
  ('cheat_mrx_w6_h2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'trwk_mwfc_6', 'cvenue_mwfc_main', 102, strftime('%s', '2025-10-11 17:30:00'), 20, 'slvl_mwfc_mens_rx', 'Men''s RX Heat 2 - Finals');

-- ----------------------------------------
-- HEAT ASSIGNMENTS (Men's RX)
-- ----------------------------------------
-- Assigning teams to lanes in each heat
-- 17 active teams split across 2 heats: Heat 1 = 9 teams, Heat 2 = 8 teams

-- WORKOUT 1: SAWTOOTH - Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  -- Heat 1 (9 teams - Top performers)
  ('cha_mrx_w1h1_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_gymreapers', 1),
  ('cha_mrx_w1h1_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_uxo', 2),
  ('cha_mrx_w1h1_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_stud_puffins', 3),
  ('cha_mrx_w1h1_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_white_lotus', 4),
  ('cha_mrx_w1h1_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_quick_thick', 5),
  ('cha_mrx_w1h1_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_rad_boys', 6),
  ('cha_mrx_w1h1_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_rad_dads', 7),
  ('cha_mrx_w1h1_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_boonie_bros', 8),
  ('cha_mrx_w1h1_l9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h1', 'creg_mrx_power_snatch', 9),
  -- Heat 2 (8 teams)
  ('cha_mrx_w1h2_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_90_problems', 1),
  ('cha_mrx_w1h2_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_titanic', 2),
  ('cha_mrx_w1h2_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_blind_date', 3),
  ('cha_mrx_w1h2_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_biggie_smalls', 4),
  ('cha_mrx_w1h2_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_team_rx_minus', 5),
  ('cha_mrx_w1h2_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_rxish', 6),
  ('cha_mrx_w1h2_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_fyb', 7),
  ('cha_mrx_w1h2_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w1_h2', 'creg_mrx_power_snatch', 8);

-- WORKOUT 2: STEELHEAD - Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  -- Heat 1
  ('cha_mrx_w2h1_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_gymreapers', 1),
  ('cha_mrx_w2h1_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_uxo', 2),
  ('cha_mrx_w2h1_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_stud_puffins', 3),
  ('cha_mrx_w2h1_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_white_lotus', 4),
  ('cha_mrx_w2h1_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_quick_thick', 5),
  ('cha_mrx_w2h1_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_rad_boys', 6),
  ('cha_mrx_w2h1_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_rad_dads', 7),
  ('cha_mrx_w2h1_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_boonie_bros', 8),
  ('cha_mrx_w2h1_l9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h1', 'creg_mrx_power_snatch', 9),
  -- Heat 2
  ('cha_mrx_w2h2_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_90_problems', 1),
  ('cha_mrx_w2h2_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_titanic', 2),
  ('cha_mrx_w2h2_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_blind_date', 3),
  ('cha_mrx_w2h2_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_biggie_smalls', 4),
  ('cha_mrx_w2h2_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_team_rx_minus', 5),
  ('cha_mrx_w2h2_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_rxish', 6),
  ('cha_mrx_w2h2_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_fyb', 7),
  ('cha_mrx_w2h2_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w2_h2', 'creg_mrx_power_snatch', 8);

-- WORKOUT 3: SPUD NATION - Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  -- Heat 1
  ('cha_mrx_w3h1_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_gymreapers', 1),
  ('cha_mrx_w3h1_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_uxo', 2),
  ('cha_mrx_w3h1_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_stud_puffins', 3),
  ('cha_mrx_w3h1_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_white_lotus', 4),
  ('cha_mrx_w3h1_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_quick_thick', 5),
  ('cha_mrx_w3h1_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_rad_boys', 6),
  ('cha_mrx_w3h1_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_rad_dads', 7),
  ('cha_mrx_w3h1_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_boonie_bros', 8),
  ('cha_mrx_w3h1_l9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h1', 'creg_mrx_power_snatch', 9),
  -- Heat 2
  ('cha_mrx_w3h2_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_90_problems', 1),
  ('cha_mrx_w3h2_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_titanic', 2),
  ('cha_mrx_w3h2_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_blind_date', 3),
  ('cha_mrx_w3h2_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_biggie_smalls', 4),
  ('cha_mrx_w3h2_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_team_rx_minus', 5),
  ('cha_mrx_w3h2_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_rxish', 6),
  ('cha_mrx_w3h2_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_fyb', 7),
  ('cha_mrx_w3h2_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w3_h2', 'creg_mrx_power_snatch', 8);

-- WORKOUT 4: BRONCO - Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  -- Heat 1
  ('cha_mrx_w4h1_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_gymreapers', 1),
  ('cha_mrx_w4h1_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_uxo', 2),
  ('cha_mrx_w4h1_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_stud_puffins', 3),
  ('cha_mrx_w4h1_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_white_lotus', 4),
  ('cha_mrx_w4h1_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_quick_thick', 5),
  ('cha_mrx_w4h1_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_rad_boys', 6),
  ('cha_mrx_w4h1_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_rad_dads', 7),
  ('cha_mrx_w4h1_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_boonie_bros', 8),
  ('cha_mrx_w4h1_l9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h1', 'creg_mrx_power_snatch', 9),
  -- Heat 2
  ('cha_mrx_w4h2_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_90_problems', 1),
  ('cha_mrx_w4h2_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_titanic', 2),
  ('cha_mrx_w4h2_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_blind_date', 3),
  ('cha_mrx_w4h2_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_biggie_smalls', 4),
  ('cha_mrx_w4h2_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_team_rx_minus', 5),
  ('cha_mrx_w4h2_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_rxish', 6),
  ('cha_mrx_w4h2_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_fyb', 7),
  ('cha_mrx_w4h2_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w4_h2', 'creg_mrx_power_snatch', 8);

-- WORKOUT 5: VANDAL - Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  -- Heat 1
  ('cha_mrx_w5h1_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_gymreapers', 1),
  ('cha_mrx_w5h1_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_uxo', 2),
  ('cha_mrx_w5h1_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_stud_puffins', 3),
  ('cha_mrx_w5h1_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_white_lotus', 4),
  ('cha_mrx_w5h1_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_quick_thick', 5),
  ('cha_mrx_w5h1_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_rad_boys', 6),
  ('cha_mrx_w5h1_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_rad_dads', 7),
  ('cha_mrx_w5h1_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_boonie_bros', 8),
  ('cha_mrx_w5h1_l9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h1', 'creg_mrx_power_snatch', 9),
  -- Heat 2
  ('cha_mrx_w5h2_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_90_problems', 1),
  ('cha_mrx_w5h2_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_titanic', 2),
  ('cha_mrx_w5h2_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_blind_date', 3),
  ('cha_mrx_w5h2_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_biggie_smalls', 4),
  ('cha_mrx_w5h2_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_team_rx_minus', 5),
  ('cha_mrx_w5h2_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_rxish', 6),
  ('cha_mrx_w5h2_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_fyb', 7),
  ('cha_mrx_w5h2_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w5_h2', 'creg_mrx_power_snatch', 8);

-- WORKOUT 6: MOUNTAIN WEST TOMMY V (Finals) - Heat Assignments
INSERT INTO competition_heat_assignments (id, createdAt, updatedAt, updateCounter, heatId, registrationId, laneNumber)
VALUES
  -- Heat 1
  ('cha_mrx_w6h1_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_gymreapers', 1),
  ('cha_mrx_w6h1_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_uxo', 2),
  ('cha_mrx_w6h1_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_stud_puffins', 3),
  ('cha_mrx_w6h1_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_white_lotus', 4),
  ('cha_mrx_w6h1_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_quick_thick', 5),
  ('cha_mrx_w6h1_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_rad_boys', 6),
  ('cha_mrx_w6h1_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_rad_dads', 7),
  ('cha_mrx_w6h1_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_boonie_bros', 8),
  ('cha_mrx_w6h1_l9', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h1', 'creg_mrx_power_snatch', 9),
  -- Heat 2
  ('cha_mrx_w6h2_l1', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_90_problems', 1),
  ('cha_mrx_w6h2_l2', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_titanic', 2),
  ('cha_mrx_w6h2_l3', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_blind_date', 3),
  ('cha_mrx_w6h2_l4', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_biggie_smalls', 4),
  ('cha_mrx_w6h2_l5', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_team_rx_minus', 5),
  ('cha_mrx_w6h2_l6', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_rxish', 6),
  ('cha_mrx_w6h2_l7', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_fyb', 7),
  ('cha_mrx_w6h2_l8', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'cheat_mrx_w6_h2', 'creg_mrx_power_snatch', 8);

-- ============================================
-- MEN'S RX SUMMARY
-- ============================================
-- 20 Teams (17 competed, 3 withdrew: CHAOS BOYS, Lift me baby, Golden Big Backs, STANDIN ON BIDNESS)
-- 40 Athletes (2 per team)
-- 40 Team Memberships
-- 20 Competition Registrations
-- 12 Division-Specific Heats (2 heats × 6 workouts)
-- 102 Heat Assignments (17 teams × 6 workouts)
--
-- Affiliates represented:
--   - Kulak CrossFit (GYMREAPERS - 1st place)
--   - Verdant CrossFit (UXO, '90 problems, Lift me baby)
--   - CrossFit Casual (Stud Puffins)
--   - CrossFit Hyperion (White Lotus)
--   - CrossFit Fullerton (Quick & Thick)
--   - Snake River CrossFit (R.A.D Boys)
--   - CrossFit Fireside (R.A.D Dads)
--   - Independent (Boonie Bros)
--   - The Pack 208 (The Power Snatch Kids)
--   - CrossFit Canvas (Titanic Swim Team)
--   - Slate S&C (Blind Date)
--   - Last Rep CrossFit (Biggie Smalls)
--   - Rock Canyon CrossFit (Team RX minus)
--   - CrossFit Twin Falls (RX-ish)
--   - Four Rivers CrossFit (FYB)
--   - Chaos S&C (CHAOS BOYS - WD)
--   - OSO CrossFit (Golden Big Backs - WD)
--   - CrossFit Fort Vancouver (STANDIN ON BIDNESS - WD)

-- ============================================
-- 11. COMPETITION DIVISION FEES (All Divisions)
-- ============================================
-- $350 per division for all 15 divisions

INSERT INTO competition_divisions (id, createdAt, updatedAt, updateCounter, competitionId, divisionId, feeCents, description)
VALUES
  ('cdfee_mwfc_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_coed_rx', 35000, 'Co-Ed RX Division - Team of 2 (1M + 1F). For athletes who can perform movements as prescribed.'),
  ('cdfee_mwfc_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_coed_int', 35000, 'Co-Ed Intermediate Division - Team of 2 (1M + 1F). Modified weights and movements.'),
  ('cdfee_mwfc_coed_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_coed_rookie', 35000, 'Co-Ed Rookie Division - Team of 2 (1M + 1F). Entry-level competition for newer athletes.'),
  ('cdfee_mwfc_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_mens_rx', 35000, 'Men''s RX Division - Team of 2. For athletes who can perform movements as prescribed.'),
  ('cdfee_mwfc_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_mens_int', 35000, 'Men''s Intermediate Division - Team of 2. Modified weights and movements.'),
  ('cdfee_mwfc_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_mens_rookie', 35000, 'Men''s Rookie Division - Team of 2. Entry-level competition for newer athletes.'),
  ('cdfee_mwfc_womens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_womens_rx', 35000, 'Women''s RX Division - Team of 2. For athletes who can perform movements as prescribed.'),
  ('cdfee_mwfc_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_womens_int', 35000, 'Women''s Intermediate Division - Team of 2. Modified weights and movements.'),
  ('cdfee_mwfc_womens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_womens_rookie', 35000, 'Women''s Rookie Division - Team of 2. Entry-level competition for newer athletes.'),
  ('cdfee_mwfc_masters_coed_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_masters_coed_rx', 35000, 'Masters Co-Ed RX Division - Team of 2 (1M + 1F, 40+). RX standards for masters athletes.'),
  ('cdfee_mwfc_masters_coed_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_masters_coed_int', 35000, 'Masters Co-Ed Intermediate Division - Team of 2 (1M + 1F, 40+). Modified standards.'),
  ('cdfee_mwfc_masters_mens_rx', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rx', 35000, 'Masters Men''s RX Division - Team of 2 (40+). RX standards for masters athletes.'),
  ('cdfee_mwfc_masters_mens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_masters_mens_int', 35000, 'Masters Men''s Intermediate Division - Team of 2 (40+). Modified standards.'),
  ('cdfee_mwfc_masters_mens_rookie', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_masters_mens_rookie', 35000, 'Masters Men''s Rookie Division - Team of 2 (40+). Entry-level for masters.'),
  ('cdfee_mwfc_masters_womens_int', strftime('%s', 'now'), strftime('%s', 'now'), 1, 'comp_mwfc2025', 'slvl_mwfc_masters_womens_int', 35000, 'Masters Women''s Intermediate Division - Team of 2 (40+). Modified standards.');

-- ============================================
-- FINAL SUMMARY
-- ============================================
-- MWFC 2025 Competition Seed Data
--
-- Competition: Mountain West Fitness Championship 2025
-- Dates: October 10-11, 2025
-- Location: Canyon County Fair Event Center, Caldwell, ID
--
-- DATA CREATED:
-- - 1 Competition Event Team (team_mwfc2025_event)
-- - 1 Scaling Group with 15 Divisions (all team of 2)
-- - 1 Competition with full settings
-- - 1 Venue (Main Stage)
-- - 1 Programming Track
-- - 6 Workouts with 90 workout scaling descriptions
-- - 6 Track Workouts
-- - 38 General Heats + 12 Men's RX Specific Heats
-- - 15 Competition Division Fees ($360 each)
--
-- MEN'S RX REGISTRATION DATA:
-- - 20 Athlete Teams (competition_team type)
-- - 40 Placeholder Users (2 per team)
-- - 80 Team Memberships (40 for athlete squads + 40 for competition_event team)
-- - 1 Commerce Product
-- - 20 Commerce Purchases ($360 each = $7,200 total)
-- - 20 Competition Registrations (with teamMemberId and commercePurchaseId)
-- - 102 Heat Assignments (17 active teams × 6 workouts)
--
-- REVENUE (Men's RX only):
-- - Total: 20 × $360 = $7,200
-- - Platform Fees: $180 (2.5%)
-- - Stripe Fees: $214.80
-- - Organizer Net: $6,805.20
