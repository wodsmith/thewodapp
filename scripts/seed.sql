-- Modern seed file for TheWodApp
-- Uses CUID2 format IDs and matches current schema structure

-- Clear existing data in proper order (respecting foreign key constraints)
DELETE FROM purchased_item;
DELETE FROM credit_transaction;
DELETE FROM passkey_credential;
DELETE FROM scheduled_workout_instance;
DELETE FROM team_programming_track;
DELETE FROM track_workout;
DELETE FROM programming_track;
DELETE FROM sets;
DELETE FROM results;
DELETE FROM workout_movements;
DELETE FROM workout_tags;
DELETE FROM workouts;
DELETE FROM spicy_tags;
DELETE FROM movements;
DELETE FROM team_invitation;
DELETE FROM team_membership;
DELETE FROM team_role;
DELETE FROM team;
DELETE FROM user;

-- Seed users table
-- Password for all users: password123
INSERT INTO user (id, firstName, lastName, email, emailVerified, passwordHash, role, currentCredits, createdAt, updatedAt, updateCounter) VALUES
('usr_demo1admin', 'Admin', 'User', 'admin@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'admin', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('usr_demo2coach', 'Coach', 'Smith', 'coach@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('usr_demo3member', 'John', 'Doe', 'john@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('usr_demo4member', 'Jane', 'Smith', 'jane@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed teams table
INSERT INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId) VALUES 
('team_crossfitbox1', 'CrossFit Box One', 'crossfit-box-one', 'Premier CrossFit gym in downtown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, NULL),
('team_homeymgym', 'Home Gym Heroes', 'home-gym-heroes', 'For athletes training at home', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, NULL),
('team_personaladmin', 'Admin Personal', 'admin-personal', 'Personal team for admin user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo1admin'),
('team_personalcoach', 'Coach Personal', 'coach-personal', 'Personal team for coach user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo2coach'),
('team_personaljohn', 'John Personal', 'john-personal', 'Personal team for John Doe', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo3member'),
('team_personaljane', 'Jane Personal', 'jane-personal', 'Personal team for Jane Smith', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo4member');

-- Seed team memberships
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES 
('tmem_admin_box1', 'team_crossfitbox1', 'usr_demo1admin', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_coach_box1', 'team_crossfitbox1', 'usr_demo2coach', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_john_box1', 'team_crossfitbox1', 'usr_demo3member', 'member', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_jane_homegym', 'team_homeymgym', 'usr_demo4member', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_admin_personal', 'team_personaladmin', 'usr_demo1admin', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_coach_personal', 'team_personalcoach', 'usr_demo2coach', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_john_personal', 'team_personaljohn', 'usr_demo3member', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_jane_personal', 'team_personaljane', 'usr_demo4member', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1);

-- Seed movements table with correct enum values
INSERT INTO movements (id, name, type, createdAt, updatedAt, updateCounter) VALUES 
-- Weightlifting movements
('mov_snatch', 'snatch', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_clean', 'clean', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_jerk', 'jerk', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_cleanjerk', 'clean and jerk', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_powersnatch', 'power snatch', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_powerclean', 'power clean', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_pushpress', 'push press', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_press', 'press', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_pushjerk', 'push jerk', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_splitjerk', 'split jerk', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_thruster', 'thruster', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_frontsquat', 'front squat', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_backsquat', 'back squat', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_ohsquat', 'overhead squat', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_deadlift', 'deadlift', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_sdhp', 'sumo deadlift high pull', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_benchpress', 'bench press', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_wallball', 'wall ball', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_kbswing', 'kettlebell swing', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_dbsnatch', 'dumbbell snatch', 'weightlifting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Gymnastic movements
('mov_pushup', 'push up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_hspu', 'handstand push up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_pullup', 'pull up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_ctbpullup', 'chest to bar pull up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_muscleup', 'muscle up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_toestobar', 'toes to bar', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_situp', 'sit up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_burpee', 'burpee', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_boxjump', 'box jump', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_airsquat', 'air squat', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_lunge', 'lunge', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_pistol', 'pistol', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_ropeclimb', 'rope climb', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_handstandwalk', 'handstand walk', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Monostructural movements
('mov_run', 'run', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_row', 'row', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_bike', 'bike', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_doubleunder', 'double under', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_skierg', 'ski erg', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_assaultbike', 'assault bike', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed tags
INSERT INTO spicy_tags (id, name, createdAt, updatedAt, updateCounter) VALUES 
('tag_benchmark', 'benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_hero', 'hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_girl', 'girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_chipper', 'chipper', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_amrap', 'amrap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_emom', 'emom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_partner', 'partner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed workouts table with team ownership
INSERT INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES 
-- Public benchmark workouts (no team ownership)
('wod_fran', 'Fran', '21-15-9 reps for time: Thrusters (95/65 lb) and Pull-ups', 'time', 'public', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wod_helen', 'Helen', '3 rounds for time: 400m Run, 21 Kettlebell Swings (53/35 lb), 12 Pull-ups', 'time', 'public', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wod_cindy', 'Cindy', 'AMRAP 20 minutes: 5 Pull-ups, 10 Push-ups, 15 Air Squats', 'rounds-reps', 'public', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wod_grace', 'Grace', '30 Clean and Jerks for time (135/95 lb)', 'time', 'public', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wod_isabel', 'Isabel', '30 Snatches for time (135/95 lb)', 'time', 'public', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wod_annie', 'Annie', '50-40-30-20-10 reps for time: Double-unders and Sit-ups', 'time', 'public', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Team-specific workouts
('wod_box1custom1', 'Box One Special', 'Team WOD: 5 rounds for time - 10 Thrusters, 15 Box Jumps, 20 Push-ups', 'time', 'private', 'team_crossfitbox1', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wod_homegym1', 'Home Hero', 'Bodyweight AMRAP 15: 8 Burpees, 12 Air Squats, 16 Lunges', 'rounds-reps', 'private', 'team_homeymgym', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed workout movements relationships
INSERT INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES 
-- Fran
('wm_fran_thruster', 'wod_fran', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_fran_pullup', 'wod_fran', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Helen
('wm_helen_run', 'wod_helen', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_helen_kbswing', 'wod_helen', 'mov_kbswing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_helen_pullup', 'wod_helen', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Cindy
('wm_cindy_pullup', 'wod_cindy', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_cindy_pushup', 'wod_cindy', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_cindy_squat', 'wod_cindy', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Grace
('wm_grace_cj', 'wod_grace', 'mov_cleanjerk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Isabel
('wm_isabel_snatch', 'wod_isabel', 'mov_snatch', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Annie
('wm_annie_du', 'wod_annie', 'mov_doubleunder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_annie_situp', 'wod_annie', 'mov_situp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Team workouts
('wm_box1_thruster', 'wod_box1custom1', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_box1_boxjump', 'wod_box1custom1', 'mov_boxjump', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_box1_pushup', 'wod_box1custom1', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

('wm_home_burpee', 'wod_homegym1', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_home_squat', 'wod_homegym1', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_home_lunge', 'wod_homegym1', 'mov_lunge', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed workout tags
INSERT INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES 
('wtag_fran_girl', 'wod_fran', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_fran_benchmark', 'wod_fran', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_helen_girl', 'wod_helen', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_helen_benchmark', 'wod_helen', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_cindy_girl', 'wod_cindy', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_cindy_amrap', 'wod_cindy', 'tag_amrap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_grace_girl', 'wod_grace', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_isabel_girl', 'wod_isabel', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_annie_girl', 'wod_annie', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_homegym_amrap', 'wod_homegym1', 'tag_amrap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed programming tracks
INSERT INTO programming_track (id, name, description, type, ownerTeamId, isPublic, createdAt, updatedAt, updateCounter) VALUES 
('ptrk_crossfit', 'CrossFit Mainsite', 'Official CrossFit programming from CrossFit.com', 'official_3rd_party', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('ptrk_box1strength', 'Box One Strength', 'Our custom strength-focused programming', 'team_owned', 'team_crossfitbox1', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('ptrk_homebodyweight', 'Home Bodyweight', 'Bodyweight workouts for home athletes', 'team_owned', 'team_homeymgym', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed team programming track subscriptions
INSERT INTO team_programming_track (teamId, trackId, isActive, subscribedAt, startDayOffset, createdAt, updatedAt, updateCounter) VALUES 
('team_crossfitbox1', 'ptrk_crossfit', 1, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('team_crossfitbox1', 'ptrk_box1strength', 1, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('team_homeymgym', 'ptrk_homebodyweight', 1, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('team_homeymgym', 'ptrk_crossfit', 1, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed track workouts
INSERT INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES 
-- CrossFit Mainsite track
('trwk_cf_day1', 'ptrk_crossfit', 'wod_fran', 1, 1, 'Classic benchmark workout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_cf_day2', 'ptrk_crossfit', 'wod_helen', 2, 1, 'Mixed modal conditioning', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_cf_day3', 'ptrk_crossfit', 'wod_cindy', 3, 1, 'Bodyweight AMRAP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_cf_day5', 'ptrk_crossfit', 'wod_grace', 5, 1, 'Heavy barbell workout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Box One Strength track
('trwk_b1s_day1', 'ptrk_box1strength', 'wod_box1custom1', 1, 1, 'Focus on form and intensity', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Home Bodyweight track
('trwk_hbw_day1', 'ptrk_homebodyweight', 'wod_homegym1', 1, 1, 'No equipment needed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_hbw_day2', 'ptrk_homebodyweight', 'wod_cindy', 2, 1, 'Classic bodyweight benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed some sample results
INSERT INTO results (id, user_id, date, workout_id, type, wod_score, scale, notes, createdAt, updatedAt, updateCounter) VALUES 
('res_john_fran', 'usr_demo3member', CURRENT_TIMESTAMP, 'wod_fran', 'wod', '4:23', 'rx', 'Great form on thrusters', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('res_jane_cindy', 'usr_demo4member', CURRENT_TIMESTAMP, 'wod_cindy', 'wod', '15 rounds + 3 reps', 'rx', 'Consistent pace throughout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('res_coach_helen', 'usr_demo2coach', CURRENT_TIMESTAMP, 'wod_helen', 'wod', '8:45', 'rx', 'Pushed hard on the runs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed some sample strength results
INSERT INTO results (id, user_id, date, type, set_count, notes, createdAt, updatedAt, updateCounter) VALUES 
('res_john_squat', 'usr_demo3member', CURRENT_TIMESTAMP, 'strength', 5, 'Back squat work - feeling strong', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('res_jane_press', 'usr_demo4member', CURRENT_TIMESTAMP, 'strength', 3, 'Overhead press PR attempt', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed some sets for the strength results
INSERT INTO sets (id, result_id, set_number, reps, weight, notes, createdAt, updatedAt, updateCounter) VALUES 
-- John's back squats
('set_john_squat_1', 'res_john_squat', 1, 5, 185, 'Warmup set', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('set_john_squat_2', 'res_john_squat', 2, 5, 205, 'Working weight', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('set_john_squat_3', 'res_john_squat', 3, 5, 225, 'Getting heavy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('set_john_squat_4', 'res_john_squat', 4, 3, 245, 'Near max effort', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('set_john_squat_5', 'res_john_squat', 5, 1, 255, 'New PR!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Jane's overhead press
('set_jane_press_1', 'res_jane_press', 1, 5, 65, 'Warmup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('set_jane_press_2', 'res_jane_press', 2, 3, 85, 'Working up', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('set_jane_press_3', 'res_jane_press', 3, 1, 95, 'PR attempt - success!', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed some sample credit transactions
INSERT INTO credit_transaction (id, userId, amount, remainingAmount, type, description, createdAt, updatedAt, updateCounter) VALUES 
('ctxn_admin_monthly', 'usr_demo1admin', 100, 90, 'MONTHLY_REFRESH', 'Monthly admin credit refresh', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('ctxn_coach_purchase', 'usr_demo2coach', 50, 35, 'PURCHASE', 'Credit purchase - starter pack', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('ctxn_john_usage', 'usr_demo3member', -5, 0, 'USAGE', 'Used credits for premium workout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);