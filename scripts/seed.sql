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
INSERT OR IGNORE INTO user (id, firstName, lastName, email, emailVerified, passwordHash, role, currentCredits, createdAt, updatedAt, updateCounter) VALUES
('usr_demo1admin', 'Admin', 'User', 'admin@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'admin', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('usr_demo2coach', 'Coach', 'Smith', 'coach@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('usr_demo3member', 'John', 'Doe', 'john@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('usr_demo4member', 'Jane', 'Smith', 'jane@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed teams table
INSERT OR IGNORE INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId) VALUES 
('team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit Box One', 'crossfit-box-one', 'Premier CrossFit gym in downtown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, NULL),
('team_homeymgym', 'Home Gym Heroes', 'home-gym-heroes', 'For athletes training at home', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, NULL),
('team_personaladmin', 'Admin Personal', 'admin-personal', 'Personal team for admin user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo1admin'),
('team_personalcoach', 'Coach Personal', 'coach-personal', 'Personal team for coach user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo2coach'),
('team_personaljohn', 'John Personal', 'john-personal', 'Personal team for John Doe', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo3member'),
('team_personaljane', 'Jane Personal', 'jane-personal', 'Personal team for Jane Smith', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, 'usr_demo4member');

-- Seed team memberships
INSERT OR IGNORE INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES 
('tmem_admin_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo1admin', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_coach_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo2coach', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_john_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo3member', 'member', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_jane_homegym', 'team_homeymgym', 'usr_demo4member', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_admin_personal', 'team_personaladmin', 'usr_demo1admin', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_coach_personal', 'team_personalcoach', 'usr_demo2coach', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_john_personal', 'team_personaljohn', 'usr_demo3member', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1),
('tmem_jane_personal', 'team_personaljane', 'usr_demo4member', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1);


-- Creates CrossFit user, team, and all Girls benchmark workouts in a programming track
-- Create CrossFit user
-- Password for crossfit@gmail.com is "crossfit"
INSERT INTO user (id, firstName, lastName, email, emailVerified, passwordHash, role, currentCredits, createdAt, updatedAt, updateCounter) VALUES
('usr_crossfit001', 'CrossFit', 'Admin', 'crossfit@gmail.com', 1750194531, 'eb1405f82c02e3e74723c82b24e16948:2c25e5090d2496f0a06fcd77f4a41e733abec33e0b0913637060e6619f3963f6', 'admin', 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Create CrossFit team
INSERT INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId, creditBalance) VALUES 
('team_cokkpu1klwo0ulfhl1iwzpvn', 'CrossFit', 'crossfit', 'Official CrossFit benchmark workouts and programming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, NULL, 500);

-- Create team membership for CrossFit user
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES 
('tmem_crossfit_owner', 'team_cokkpu1klwo0ulfhl1iwzpvn', 'usr_crossfit001', 'owner', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1);

-- Create Girls programming track
INSERT INTO programming_track (id, name, description, type, ownerTeamId, isPublic, createdAt, updatedAt, updateCounter) VALUES 
('ptrk_girls', 'Girls', 'Classic CrossFit Girls benchmark workouts - foundational CrossFit WODs named after women', 'team_owned', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Subscribe CrossFit team to Girls programming track
INSERT INTO team_programming_track (teamId, trackId, isActive, subscribedAt, startDayOffset, createdAt, updatedAt, updateCounter) VALUES 
('team_cokkpu1klwo0ulfhl1iwzpvn', 'ptrk_girls', 1, CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- First create all required tags and movements before creating workouts and relationships

-- Create required tags
INSERT OR IGNORE INTO spicy_tags (id, name, createdAt, updatedAt, updateCounter) VALUES 
('tag_benchmark', 'benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_hero', 'hero', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_girl', 'girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_chipper', 'chipper', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_amrap', 'amrap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_emom', 'emom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tag_partner', 'partner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Create all required movements
INSERT OR IGNORE INTO movements (id, name, type, createdAt, updatedAt, updateCounter) VALUES 

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
('mov_ringmuscleup', 'ring muscle up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_toestobar', 'toes to bar', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_situp', 'sit up', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_burpee', 'burpee', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_boxjump', 'box jump', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_airsquat', 'air squat', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_lunge', 'lunge', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_pistol', 'pistol', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_ropeclimb', 'rope climb', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_handstandwalk', 'handstand walk', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_ringdip', 'ring dip', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_jumpingjack', 'jumping jack', 'gymnastic', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Monostructural movements
('mov_run', 'run', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_row', 'row', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_bike', 'bike', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_doubleunder', 'double under', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_singleunder', 'single under', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_skierg', 'ski erg', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('mov_assaultbike', 'assault bike', 'monostructural', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Create all Girls workouts
INSERT INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES 

-- Amanda
('wod_amanda', 'Amanda', 'For time:

9-7-5 reps
• Muscle-ups
• Squat Snatches (135/95lb)

Target: 14 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Angie  
('wod_angie', 'Angie', 'For time:
• 100 pull-ups
• 100 push-ups
• 100 sit-ups
• 100 squats

Target: 28 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Annie
('wod_annie', 'Annie', 'For time:

50-40-30-20-10 reps
• Double-unders
• Sit-ups

Target: 11 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Barbara
('wod_barbara', 'Barbara', 'For time:

5 rounds
• 20 pull-ups
• 30 push-ups
• 40 sit-ups
• 50 air squats
• 3 minutes rest

Target: 8 minutes per round', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Candy
('wod_candy', 'Candy', 'For time:

5 rounds
• 20 pull-ups
• 40 push-ups
• 60 squats

Target: 38 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Chelsea
('wod_chelsea', 'Chelsea', 'EMOM 30:
• 5 pull-ups
• 10 push-ups
• 15 air squats

Target: 20 rounds', 'emom', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Cindy
('wod_cindy', 'Cindy', 'AMRAP 20 minutes:
• 5 pull-ups
• 10 push-ups
• 15 air squats

Target: 12 rounds', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Diane
('wod_diane', 'Diane', 'For time:

21-15-9 reps
• Deadlifts (225/155lb)
• Handstand push-ups

Target: 4 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Elizabeth
('wod_elizabeth', 'Elizabeth', 'For time:

21-15-9 reps
• Squat Cleans (135/95lb)
• Ring Dips

', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Eva
('wod_eva', 'Eva', 'For time:

5 rounds
• 800-meter run
• 30 kettlebell swings (2 pood)
• 30 pull-ups

Target: 70 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Fran
('wod_fran', 'Fran', 'For time:

21-15-9 reps
• Thrusters (95/75lb)
• Pull-ups

Target: 5 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Grace
('wod_grace', 'Grace', 'For time:
• 30 Clean-and-Jerks (135/95lb)

Target: 8 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Gwen
('wod_gwen', 'Gwen', 'For time:
• 15-12-9 Clean and Jerks (unbroken)
• Rest as needed between sets

Score is weight used for all three unbroken sets. Each set must be unbroken (touch and go at floor) only; even a re-grip off the floor is a foul. Use same load for each set.

Target: 390 pounds', 'load', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Helen
('wod_helen', 'Helen', 'For time:

3 rounds
• 400-meter run
• 21 kettlebell swings (50/35lb)
• 12 pull-ups

Target: 16 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Hope
('wod_hope', 'Hope', 'AMRAP 3 rounds:
• Burpees
• Power snatch (75/55lb)
• Box jump (24/20 inch)
• Thruster (75/55lb)
• Chest to bar Pull-ups

Target: 150 points', 'points', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Isabel
('wod_isabel', 'Isabel', 'For time:
• 30 Snatches (135/95lb)

Target: 16 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Jackie
('wod_jackie', 'Jackie', 'For time:
• 1,000-meter row
• 50 thrusters (45/35lb)
• 30 pull-ups

Target: 18 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Karen
('wod_karen', 'Karen', 'For time:
• 150 Wall Ball Shots (20/14lb)

Target: 15 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Kelly
('wod_kelly', 'Kelly', 'For time:

5 rounds
• 400-meter run
• 30 box jumps (24/20 inch)
• 30 wall ball shots (20/14 lbs)

Target: 50 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Linda
('wod_linda', 'Linda', 'For time:

10-9-8-7-6-5-4-3-2-1 reps
• Deadlift (1.5 BW)
• Bench Press (BW)
• Clean (0.75 BW)

Target: 30 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Lynne
('wod_lynne', 'Lynne', '5 rounds:
• Max reps Bench Press (body weight)
• Pull-ups

Target: 50 reps total', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Maggie
('wod_maggie', 'Maggie', 'For time:

5 rounds
• 20 Handstand Push-ups
• 40 Pull-ups
• 60 Pistols (alternating legs)

Target: 60 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Marguerita
('wod_marguerita', 'Marguerita', 'For time:

50 rounds
• 1 Burpee
• 1 Push-up
• 1 Jumping-jack
• 1 Sit-up
• 1 Handstand push up

Target: 25 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Mary
('wod_mary', 'Mary', 'AMRAP 20 minutes:
• 5 handstand push-ups
• 10 pistols (alternating legs)
• 15 pull-ups

Target: 5 rounds', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Megan
('wod_megan', 'Megan', 'For time:

21-15-9 reps
• Burpees
• KB Swings (53/35lb)
• Double-unders

Target: 8 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Nancy
('wod_nancy', 'Nancy', 'For time:

5 rounds
• 400-meter run
• 15 overhead squats (95/65lb)

Target: 22 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Nicole
('wod_nicole', 'Nicole', 'AMRAP:

5 rounds
• 400-meter run
• Max reps pull-ups

Target: 55 reps total', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Tag all workouts as Girls benchmarks
INSERT INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES 
('wtag_amanda_girl', 'wod_amanda', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_amanda_benchmark', 'wod_amanda', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_angie_girl', 'wod_angie', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_angie_benchmark', 'wod_angie', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_annie_girl', 'wod_annie', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_annie_benchmark', 'wod_annie', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_barbara_girl', 'wod_barbara', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_barbara_benchmark', 'wod_barbara', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_candy_girl', 'wod_candy', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_candy_benchmark', 'wod_candy', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_chelsea_girl', 'wod_chelsea', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_chelsea_benchmark', 'wod_chelsea', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_chelsea_emom', 'wod_chelsea', 'tag_emom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_cindy_girl', 'wod_cindy', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_cindy_benchmark', 'wod_cindy', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_cindy_amrap', 'wod_cindy', 'tag_amrap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_diane_girl', 'wod_diane', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_diane_benchmark', 'wod_diane', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_elizabeth_girl', 'wod_elizabeth', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_elizabeth_benchmark', 'wod_elizabeth', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_eva_girl', 'wod_eva', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_eva_benchmark', 'wod_eva', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_fran_girl', 'wod_fran', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_fran_benchmark', 'wod_fran', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_grace_girl', 'wod_grace', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_grace_benchmark', 'wod_grace', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_gwen_girl', 'wod_gwen', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_gwen_benchmark', 'wod_gwen', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_helen_girl', 'wod_helen', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_helen_benchmark', 'wod_helen', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_hope_girl', 'wod_hope', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_hope_benchmark', 'wod_hope', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_isabel_girl', 'wod_isabel', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_isabel_benchmark', 'wod_isabel', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_jackie_girl', 'wod_jackie', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_jackie_benchmark', 'wod_jackie', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_jackie_chipper', 'wod_jackie', 'tag_chipper', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_karen_girl', 'wod_karen', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_karen_benchmark', 'wod_karen', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_kelly_girl', 'wod_kelly', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_kelly_benchmark', 'wod_kelly', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_linda_girl', 'wod_linda', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_linda_benchmark', 'wod_linda', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_lynne_girl', 'wod_lynne', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_lynne_benchmark', 'wod_lynne', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_maggie_girl', 'wod_maggie', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_maggie_benchmark', 'wod_maggie', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_marguerita_girl', 'wod_marguerita', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_marguerita_benchmark', 'wod_marguerita', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_mary_girl', 'wod_mary', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_mary_benchmark', 'wod_mary', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_mary_amrap', 'wod_mary', 'tag_amrap', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_megan_girl', 'wod_megan', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_megan_benchmark', 'wod_megan', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_nancy_girl', 'wod_nancy', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_nancy_benchmark', 'wod_nancy', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_nicole_girl', 'wod_nicole', 'tag_girl', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wtag_nicole_benchmark', 'wod_nicole', 'tag_benchmark', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Create workout movements relationships (using existing movement IDs from seed.sql)
INSERT INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES 
-- Amanda: Muscle-ups, Squat Snatches
('wm_amanda_muscleup', 'wod_amanda', 'mov_muscleup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_amanda_snatch', 'wod_amanda', 'mov_snatch', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Angie: Pull-ups, Push-ups, Sit-ups, Squats
('wm_angie_pullup', 'wod_angie', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_angie_pushup', 'wod_angie', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_angie_situp', 'wod_angie', 'mov_situp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_angie_squat', 'wod_angie', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Annie: Double-unders, Sit-ups
('wm_annie_du', 'wod_annie', 'mov_doubleunder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_annie_situp', 'wod_annie', 'mov_situp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Barbara: Pull-ups, Push-ups, Sit-ups, Air squats
('wm_barbara_pullup', 'wod_barbara', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_barbara_pushup', 'wod_barbara', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_barbara_situp', 'wod_barbara', 'mov_situp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_barbara_squat', 'wod_barbara', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Candy: Pull-ups, Push-ups, Squats  
('wm_candy_pullup', 'wod_candy', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_candy_pushup', 'wod_candy', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_candy_squat', 'wod_candy', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Chelsea: Pull-ups, Push-ups, Air squats
('wm_chelsea_pullup', 'wod_chelsea', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_chelsea_pushup', 'wod_chelsea', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_chelsea_squat', 'wod_chelsea', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Cindy: Pull-ups, Push-ups, Air squats
('wm_cindy_pullup', 'wod_cindy', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_cindy_pushup', 'wod_cindy', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_cindy_squat', 'wod_cindy', 'mov_airsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Diane: Deadlifts, Handstand Push-ups
('wm_diane_deadlift', 'wod_diane', 'mov_deadlift', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_diane_hspu', 'wod_diane', 'mov_hspu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Elizabeth: Squat Cleans, Ring Dips (using clean for squat clean, no ring dips in seed movements)
('wm_elizabeth_clean', 'wod_elizabeth', 'mov_clean', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Eva: Run, Kettlebell Swings, Pull-ups
('wm_eva_run', 'wod_eva', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_eva_kbswing', 'wod_eva', 'mov_kbswing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_eva_pullup', 'wod_eva', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Fran: Thrusters, Pull-ups
('wm_fran_thruster', 'wod_fran', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_fran_pullup', 'wod_fran', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Grace: Clean and Jerks
('wm_grace_cj', 'wod_grace', 'mov_cleanjerk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Gwen: Clean and Jerks
('wm_gwen_cj', 'wod_gwen', 'mov_cleanjerk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Helen: Run, Kettlebell Swings, Pull-ups
('wm_helen_run', 'wod_helen', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_helen_kbswing', 'wod_helen', 'mov_kbswing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_helen_pullup', 'wod_helen', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Hope: Burpees, Power Snatch, Box Jump, Thruster, Chest to Bar Pull-ups
('wm_hope_burpee', 'wod_hope', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_hope_powersnatch', 'wod_hope', 'mov_powersnatch', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_hope_boxjump', 'wod_hope', 'mov_boxjump', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_hope_thruster', 'wod_hope', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_hope_ctbpullup', 'wod_hope', 'mov_ctbpullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Isabel: Snatches
('wm_isabel_snatch', 'wod_isabel', 'mov_snatch', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Jackie: Row, Thrusters, Pull-ups
('wm_jackie_row', 'wod_jackie', 'mov_row', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_jackie_thruster', 'wod_jackie', 'mov_thruster', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_jackie_pullup', 'wod_jackie', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Karen: Wall Ball
('wm_karen_wallball', 'wod_karen', 'mov_wallball', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Kelly: Run, Box Jumps, Wall Ball
('wm_kelly_run', 'wod_kelly', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_kelly_boxjump', 'wod_kelly', 'mov_boxjump', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_kelly_wallball', 'wod_kelly', 'mov_wallball', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Linda: Deadlift, Bench Press, Clean
('wm_linda_deadlift', 'wod_linda', 'mov_deadlift', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_linda_bench', 'wod_linda', 'mov_benchpress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_linda_clean', 'wod_linda', 'mov_clean', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Lynne: Bench Press, Pull-ups
('wm_lynne_bench', 'wod_lynne', 'mov_benchpress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_lynne_pullup', 'wod_lynne', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Maggie: Handstand Push-ups, Pull-ups, Pistols
('wm_maggie_hspu', 'wod_maggie', 'mov_hspu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_maggie_pullup', 'wod_maggie', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_maggie_pistol', 'wod_maggie', 'mov_pistol', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Marguerita: Burpees, Push-ups, (jumping jack not in movements), Sit-ups, Handstand Push-ups
('wm_marguerita_burpee', 'wod_marguerita', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_marguerita_pushup', 'wod_marguerita', 'mov_pushup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_marguerita_situp', 'wod_marguerita', 'mov_situp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_marguerita_hspu', 'wod_marguerita', 'mov_hspu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Mary: Handstand Push-ups, Pistols, Pull-ups
('wm_mary_hspu', 'wod_mary', 'mov_hspu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_mary_pistol', 'wod_mary', 'mov_pistol', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_mary_pullup', 'wod_mary', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Megan: Burpees, KB Swings, Double-unders
('wm_megan_burpee', 'wod_megan', 'mov_burpee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_megan_kbswing', 'wod_megan', 'mov_kbswing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_megan_du', 'wod_megan', 'mov_doubleunder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Nancy: Run, Overhead Squats
('wm_nancy_run', 'wod_nancy', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_nancy_ohsquat', 'wod_nancy', 'mov_ohsquat', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),

-- Nicole: Run, Pull-ups
('wm_nicole_run', 'wod_nicole', 'mov_run', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('wm_nicole_pullup', 'wod_nicole', 'mov_pullup', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Add all workouts to the Girls programming track
INSERT INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES 
('trwk_girls_amanda', 'ptrk_girls', 'wod_amanda', 1, 1, 'Classic benchmark - muscle-ups and squat snatches', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_angie', 'ptrk_girls', 'wod_angie', 2, 1, 'High volume bodyweight movements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_annie', 'ptrk_girls', 'wod_annie', 3, 1, 'Double-unders and sit-ups descending ladder', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_barbara', 'ptrk_girls', 'wod_barbara', 4, 1, 'Time with rest - stay unbroken', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_candy', 'ptrk_girls', 'wod_candy', 5, 1, 'High volume upper body work', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_chelsea', 'ptrk_girls', 'wod_chelsea', 6, 1, 'EMOM format - maintain consistency', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_cindy', 'ptrk_girls', 'wod_cindy', 7, 1, 'Classic AMRAP - pace yourself', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_diane', 'ptrk_girls', 'wod_diane', 8, 2, 'Heavy deadlifts and handstand push-ups', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_elizabeth', 'ptrk_girls', 'wod_elizabeth', 9, 2, 'Squat cleans and ring dips', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_eva', 'ptrk_girls', 'wod_eva', 10, 2, 'Long chipper - pace management critical', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_fran', 'ptrk_girls', 'wod_fran', 11, 2, 'The classic sprint - fast and light', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_grace', 'ptrk_girls', 'wod_grace', 12, 2, 'Pure strength endurance - 30 clean and jerks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_gwen', 'ptrk_girls', 'wod_gwen', 13, 2, 'Load-based scoring - find your max unbroken weight', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_helen', 'ptrk_girls', 'wod_helen', 14, 2, 'Running and upper body combo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_hope', 'ptrk_girls', 'wod_hope', 15, 3, 'Points-based scoring across 5 stations', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_isabel', 'ptrk_girls', 'wod_isabel', 16, 3, '30 snatches - technical and demanding', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_jackie', 'ptrk_girls', 'wod_jackie', 17, 3, 'Chipper format - row, thrusters, pull-ups', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_karen', 'ptrk_girls', 'wod_karen', 18, 3, 'Simple but brutal - just wall balls', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_kelly', 'ptrk_girls', 'wod_kelly', 19, 3, 'Mixed modal endurance workout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_linda', 'ptrk_girls', 'wod_linda', 20, 3, 'Strength ladder based on bodyweight percentages', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_lynne', 'ptrk_girls', 'wod_lynne', 21, 3, 'Upper body strength endurance test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_maggie', 'ptrk_girls', 'wod_maggie', 22, 4, 'Advanced gymnastic movements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_marguerita', 'ptrk_girls', 'wod_marguerita', 23, 4, 'High volume mixed movements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_mary', 'ptrk_girls', 'wod_mary', 24, 4, 'Advanced gymnastic AMRAP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_megan', 'ptrk_girls', 'wod_megan', 25, 4, 'Fast couplet with skill component', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_nancy', 'ptrk_girls', 'wod_nancy', 26, 4, 'Running with overhead squats', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('trwk_girls_nicole', 'ptrk_girls', 'wod_nicole', 27, 4, 'Run and max pull-ups format', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);


-- Seed some sample results
INSERT OR IGNORE INTO results (id, user_id, date, workout_id, type, wod_score, scale, notes, createdAt, updatedAt, updateCounter) VALUES 
('res_john_fran', 'usr_demo3member', CURRENT_TIMESTAMP, 'wod_fran', 'wod', '4:23', 'rx', 'Great form on thrusters', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('res_jane_cindy', 'usr_demo4member', CURRENT_TIMESTAMP, 'wod_cindy', 'wod', '15 rounds + 3 reps', 'rx', 'Consistent pace throughout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('res_coach_helen', 'usr_demo2coach', CURRENT_TIMESTAMP, 'wod_helen', 'wod', '8:45', 'rx', 'Pushed hard on the runs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed some sample strength results
INSERT OR IGNORE INTO results (id, user_id, date, type, set_count, notes, createdAt, updatedAt, updateCounter) VALUES 
('res_john_squat', 'usr_demo3member', CURRENT_TIMESTAMP, 'strength', 5, 'Back squat work - feeling strong', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('res_jane_press', 'usr_demo4member', CURRENT_TIMESTAMP, 'strength', 3, 'Overhead press PR attempt', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed some sets for the strength results
INSERT OR IGNORE INTO sets (id, result_id, set_number, reps, weight, notes, createdAt, updatedAt, updateCounter) VALUES 
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
INSERT OR IGNORE INTO credit_transaction (id, userId, amount, remainingAmount, type, description, createdAt, updatedAt, updateCounter) VALUES 
('ctxn_admin_monthly', 'usr_demo1admin', 100, 90, 'MONTHLY_REFRESH', 'Monthly admin credit refresh', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('ctxn_coach_purchase', 'usr_demo2coach', 50, 35, 'PURCHASE', 'Credit purchase - starter pack', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('ctxn_john_usage', 'usr_demo3member', -5, 0, 'USAGE', 'Used credits for premium workout', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);