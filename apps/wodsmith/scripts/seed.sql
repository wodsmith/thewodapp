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
DELETE FROM coach_to_skills;
DELETE FROM class_catalog_to_skills;
DELETE FROM coaches;
DELETE FROM class_catalog;
DELETE FROM skills;
DELETE FROM locations;
DELETE FROM team_invitation;
DELETE FROM team_membership;
DELETE FROM team_role;
-- Delete entitlements tables (must be before team due to FK)
DELETE FROM team_entitlement_override;
DELETE FROM team_usage;
DELETE FROM team_addon;
DELETE FROM team_subscription;
DELETE FROM entitlement;
DELETE FROM team;
DELETE FROM user;
-- Delete entitlements metadata tables
DELETE FROM plan;
DELETE FROM "limit";
DELETE FROM feature;
DELETE FROM entitlement_type;

-- Seed global default scaling group (system-wide default)
-- This must be seeded first as it's used as the ultimate fallback for all workouts
INSERT OR IGNORE INTO scaling_groups (id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter) VALUES
('sgrp_global_default', 'Standard Scaling', 'Default Rx+, Rx, and Scaled levels for backward compatibility', NULL, 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed global default scaling levels
INSERT OR IGNORE INTO scaling_levels (id, scalingGroupId, label, position, createdAt, updatedAt, updateCounter) VALUES
('slvl_global_rxplus', 'sgrp_global_default', 'Rx+', 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_global_rx', 'sgrp_global_default', 'Rx', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_global_scaled', 'sgrp_global_default', 'Scaled', 2, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed entitlement types and plans (must be before teams that reference currentPlanId)
-- Insert entitlement types
INSERT OR IGNORE INTO entitlement_type (id, name, description, createdAt, updatedAt, updateCounter)
VALUES
  ('etype_programming_track', 'programming_track_access', 'Access to individual programming tracks via purchase', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_ai_messages', 'ai_message_credits', 'AI message credits for workout generation and suggestions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_feature_trial', 'feature_trial', 'Time-limited trial access to premium features', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_manual_grant', 'manual_feature_grant', 'Manual feature grants by administrators', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_subscription_seat', 'subscription_seat', 'Subscription seat tracking for team plans', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_addon_access', 'addon_access', 'Access via purchased add-ons', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert plans (Free, Pro, Enterprise)
INSERT OR IGNORE INTO plan (id, name, description, price, interval, isActive, isPublic, sortOrder, entitlements, createdAt, updatedAt, updateCounter)
VALUES (
  'free',
  'Free',
  'Perfect for getting started with basic workout management',
  0,
  NULL,
  1,
  1,
  0,
  '{"features":["basic_workouts","basic_scaling","team_collaboration","basic_analytics"],"limits":{"max_teams":1,"max_members_per_team":5,"max_programming_tracks":5,"ai_messages_per_month":10,"max_admins":2,"max_file_storage_mb":100,"max_video_storage_mb":0}}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);

INSERT OR IGNORE INTO plan (id, name, description, price, interval, isActive, isPublic, sortOrder, entitlements, createdAt, updatedAt, updateCounter)
VALUES (
  'pro',
  'Pro',
  'Advanced features for growing gyms and coaches',
  2900,
  'month',
  1,
  1,
  1,
  '{"features":["basic_workouts","advanced_workouts","workout_library","programming_tracks","program_calendar","basic_scaling","advanced_scaling","ai_workout_generation","ai_workout_suggestions","multi_team_management","team_collaboration","basic_analytics"],"limits":{"max_teams":-1,"max_members_per_team":25,"max_programming_tracks":-1,"ai_messages_per_month":200,"max_admins":5,"max_file_storage_mb":1000,"max_video_storage_mb":500}}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);

INSERT OR IGNORE INTO plan (id, name, description, price, interval, isActive, isPublic, sortOrder, entitlements, createdAt, updatedAt, updateCounter)
VALUES (
  'enterprise',
  'Enterprise',
  'Everything you need for large organizations',
  9900,
  'month',
  1,
  1,
  2,
  '{"features":["basic_workouts","advanced_workouts","workout_library","programming_tracks","program_calendar","program_analytics","basic_scaling","advanced_scaling","custom_scaling_groups","ai_workout_generation","ai_workout_suggestions","ai_programming_assistant","multi_team_management","team_collaboration","custom_branding","api_access","basic_analytics","advanced_analytics","custom_reports"],"limits":{"max_teams":-1,"max_members_per_team":-1,"max_programming_tracks":-1,"ai_messages_per_month":-1,"max_admins":-1,"max_file_storage_mb":10000,"max_video_storage_mb":5000}}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);

-- Seed users table
-- Password for all users: password123
INSERT OR IGNORE INTO user (id, firstName, lastName, email, emailVerified, passwordHash, role, currentCredits, createdAt, updatedAt, updateCounter) VALUES
('usr_demo1admin', 'Admin', 'User', 'admin@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'admin', 100, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_demo2coach', 'Coach', 'Smith', 'coach@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 50, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_demo3member', 'John', 'Doe', 'john@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_demo4member', 'Jane', 'Smith', 'jane@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed teams table
INSERT OR IGNORE INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId, currentPlanId) VALUES
('team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit Box One', 'crossfit-box-one', 'Premier CrossFit gym in downtown', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, 'free'),
('team_homeymgym', 'Home Gym Heroes', 'home-gym-heroes', 'For athletes training at home', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, 'free'),
('team_personaladmin', 'Admin Personal', 'admin-personal', 'Personal team for admin user', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo1admin', 'free'),
('team_personalcoach', 'Coach Personal', 'coach-personal', 'Personal team for coach user', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo2coach', 'free'),
('team_personaljohn', 'John Personal', 'john-personal', 'Personal team for John Doe', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo3member', 'free'),
('team_personaljane', 'Jane Personal', 'jane-personal', 'Personal team for Jane Smith', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo4member', 'free');

-- Seed team memberships
INSERT OR IGNORE INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES 
('tmem_admin_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo1admin', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_coach_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo2coach', 'admin', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_john_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo3member', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_jane_homegym', 'team_homeymgym', 'usr_demo4member', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_admin_personal', 'team_personaladmin', 'usr_demo1admin', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_coach_personal', 'team_personalcoach', 'usr_demo2coach', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_john_personal', 'team_personaljohn', 'usr_demo3member', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_jane_personal', 'team_personaljane', 'usr_demo4member', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1);

-- Creates CrossFit user, team, and all Girls benchmark workouts in a programming track
-- Create CrossFit user
-- Password for crossfit@gmail.com is "crossfit"
INSERT INTO user (id, firstName, lastName, email, emailVerified, passwordHash, role, currentCredits, createdAt, updatedAt, updateCounter) VALUES
('usr_crossfit001', 'CrossFit', 'Admin', 'crossfit@gmail.com', 1750194531, 'eb1405f82c02e3e74723c82b24e16948:2c25e5090d2496f0a06fcd77f4a41e733abec33e0b0913637060e6619f3963f6', 'admin', 1000, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create CrossFit team
INSERT INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId, creditBalance, currentPlanId) VALUES
('team_cokkpu1klwo0ulfhl1iwzpvn', 'CrossFit', 'crossfit', 'Official CrossFit benchmark workouts and programming', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, 500, 'free');

-- Create team membership for CrossFit user
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES
('tmem_crossfit_owner', 'team_cokkpu1klwo0ulfhl1iwzpvn', 'usr_crossfit001', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1);

-- Create team subscriptions (all teams start on free plan)
INSERT OR IGNORE INTO team_subscription (id, teamId, planId, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt, updateCounter) VALUES
('tsub_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_homegym', 'team_homeymgym', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personaladmin', 'team_personaladmin', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personalcoach', 'team_personalcoach', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personaljohn', 'team_personaljohn', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personaljane', 'team_personaljane', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_crossfit', 'team_cokkpu1klwo0ulfhl1iwzpvn', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create Girls programming track
INSERT INTO programming_track (id, name, description, type, ownerTeamId, isPublic, createdAt, updatedAt, updateCounter) VALUES 
('ptrk_girls', 'Girls', 'Classic CrossFit Girls benchmark workouts - foundational CrossFit WODs named after women', 'official_third_party', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Subscribe CrossFit team to Girls programming track
INSERT INTO team_programming_track (teamId, trackId, isActive, subscribedAt, startDayOffset, createdAt, updatedAt, updateCounter) VALUES 
('team_cokkpu1klwo0ulfhl1iwzpvn', 'ptrk_girls', 1, strftime('%s', 'now'), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- First create all required tags and movements before creating workouts and relationships

-- Create required tags
INSERT OR IGNORE INTO spicy_tags (id, name, createdAt, updatedAt, updateCounter) VALUES 
('tag_benchmark', 'benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_hero', 'hero', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_girl', 'girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_chipper', 'chipper', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_amrap', 'amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_emom', 'emom', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tag_partner', 'partner', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed skills table
INSERT INTO skills (id, team_id, name, createdAt, updatedAt, updateCounter) VALUES 
-- CrossFit Box One skills
('skill_cf1_l1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit Level 1 Trainer', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_l2', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit Level 2 Trainer', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_l3', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit Level 3 Trainer', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_oly', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Olympic Weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_gym', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Gymnastics', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_power', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Powerlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_endurance', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Endurance', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_nutrition', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Nutrition Coaching', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_mobility', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Mobility & Recovery', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_cf1_kettlebell', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Kettlebell Sport', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Home Gym Heroes skills
('skill_hgh_bodyweight', 'team_homeymgym', 'Bodyweight Training', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_hgh_calisthenics', 'team_homeymgym', 'Calisthenics', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_hgh_yoga', 'team_homeymgym', 'Yoga', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_hgh_hiit', 'team_homeymgym', 'HIIT Training', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('skill_hgh_functional', 'team_homeymgym', 'Functional Movement', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed locations table
INSERT INTO locations (id, team_id, name, createdAt, updatedAt, updateCounter) VALUES 
-- CrossFit Box One locations
('loc_cf1_main', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Main Floor', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('loc_cf1_outdoor', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Outdoor Area', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('loc_cf1_strength', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Strength Room', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Home Gym Heroes locations
('loc_hgh_online', 'team_homeymgym', 'Online Platform', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('loc_hgh_park', 'team_homeymgym', 'Local Park', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed class catalog table
INSERT INTO class_catalog (id, team_id, name, description, duration_minutes, max_participants, createdAt, updatedAt, updateCounter) VALUES 
-- CrossFit Box One classes
('class_cf1_wod', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit WOD', 'Daily CrossFit workout of the day with scaling options for all levels', 60, 12, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('class_cf1_strength', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Strength & Conditioning', 'Focused strength training with barbell movements and accessory work', 75, 8, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('class_cf1_oly', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Olympic Lifting', 'Technical instruction and practice of snatch and clean & jerk', 90, 6, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('class_cf1_beginners', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Beginners Fundamentals', 'Introduction to CrossFit movements and methodology for new athletes', 45, 6, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('class_cf1_open_gym', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'Open Gym', 'Self-directed training time with coach supervision', 90, 15, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Home Gym Heroes classes  
('class_hgh_hiit', 'team_homeymgym', 'HIIT Bodyweight', 'High-intensity bodyweight circuits requiring no equipment', 45, 20, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('class_hgh_yoga', 'team_homeymgym', 'Flow Yoga', 'Dynamic yoga flows for mobility and mindfulness', 60, 15, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('class_hgh_calisthenics', 'team_homeymgym', 'Calisthenics Progressions', 'Progressive bodyweight skills training', 75, 10, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed coaches table
INSERT INTO coaches (id, team_id, user_id, weekly_class_limit, scheduling_preference, is_active, createdAt, updatedAt, updateCounter) VALUES 
-- CrossFit Box One coaches
('coach_cf1_admin', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo1admin', 20, 'any', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('coach_cf1_smith', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo2coach', 15, 'morning', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Home Gym Heroes coach  
('coach_hgh_jane', 'team_homeymgym', 'usr_demo4member', 12, 'afternoon', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed coach to skills relationships
INSERT INTO coach_to_skills (coach_id, skill_id) VALUES 
-- Admin (owns multiple certifications)
('coach_cf1_admin', 'skill_cf1_l3'),
('coach_cf1_admin', 'skill_cf1_oly'),
('coach_cf1_admin', 'skill_cf1_power'),
('coach_cf1_admin', 'skill_cf1_nutrition'),

-- Coach Smith (solid foundation)
('coach_cf1_smith', 'skill_cf1_l2'),
('coach_cf1_smith', 'skill_cf1_gym'),
('coach_cf1_smith', 'skill_cf1_mobility'),

-- Jane (home gym specialist)
('coach_hgh_jane', 'skill_hgh_yoga'),
('coach_hgh_jane', 'skill_hgh_hiit'),
('coach_hgh_jane', 'skill_hgh_functional');

-- Seed class catalog to skills relationships
INSERT INTO class_catalog_to_skills (class_catalog_id, skill_id) VALUES 
-- CrossFit WOD requires general training
('class_cf1_wod', 'skill_cf1_l1'),

-- Strength class requires powerlifting knowledge
('class_cf1_strength', 'skill_cf1_power'),
('class_cf1_strength', 'skill_cf1_l2'),

-- Olympic lifting requires specific certification
('class_cf1_oly', 'skill_cf1_oly'),
('class_cf1_oly', 'skill_cf1_l2'),

-- Beginners class needs patient, certified coaches  
('class_cf1_beginners', 'skill_cf1_l2'),

-- Open gym needs supervision
('class_cf1_open_gym', 'skill_cf1_l1'),

-- HIIT requires HIIT certification
('class_hgh_hiit', 'skill_hgh_hiit'),

-- Yoga requires yoga certification
('class_hgh_yoga', 'skill_hgh_yoga'),

-- Calisthenics requires bodyweight expertise
('class_hgh_calisthenics', 'skill_hgh_calisthenics'),
('class_hgh_calisthenics', 'skill_hgh_bodyweight');

-- Create all required movements
INSERT OR IGNORE INTO movements (id, name, type, createdAt, updatedAt, updateCounter) VALUES
-- Weightlifting movements
('mov_snatch', 'snatch', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_clean', 'clean', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_jerk', 'jerk', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_cleanjerk', 'clean and jerk', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_powersnatch', 'power snatch', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_powerclean', 'power clean', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_pushpress', 'push press', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_press', 'press', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_pushjerk', 'push jerk', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_splitjerk', 'split jerk', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_thruster', 'thruster', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_frontsquat', 'front squat', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_backsquat', 'back squat', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_ohsquat', 'overhead squat', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_deadlift', 'deadlift', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_sdhp', 'sumo deadlift high pull', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_benchpress', 'bench press', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_wallball', 'wall ball', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_kbswing', 'kettlebell swing', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_dbsnatch', 'dumbbell snatch', 'weightlifting', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Gymnastic movements
('mov_pushup', 'push up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_hspu', 'handstand push up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_pullup', 'pull up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_ctbpullup', 'chest to bar pull up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_muscleup', 'muscle up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_ringmuscleup', 'ring muscle up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_toestobar', 'toes to bar', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_knees_to_elbows', 'knees to elbows', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_situp', 'sit up', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_burpee', 'burpee', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_boxjump', 'box jump', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_airsquat', 'air squat', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_lunge', 'lunge', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_pistol', 'pistol', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_ropeclimb', 'rope climb', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_handstandwalk', 'handstand walk', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_ringdip', 'ring dip', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_jumpingjack', 'jumping jack', 'gymnastic', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Monostructural movements
('mov_run', 'run', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_row', 'row', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_bike', 'bike', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_doubleunder', 'double under', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_singleunder', 'single under', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_skierg', 'ski erg', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('mov_assaultbike', 'assault bike', 'monostructural', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create all Girls workouts
INSERT INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, createdAt, updatedAt, updateCounter) VALUES 

-- Amanda
('wod_amanda', 'Amanda', 'For time:

9-7-5 reps
• Muscle-ups
• Squat Snatches (135/95lb)

Target: 14 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Angie  
('wod_angie', 'Angie', 'For time:
• 100 pull-ups
• 100 push-ups
• 100 sit-ups
• 100 squats

Target: 28 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Annie
('wod_annie', 'Annie', 'For time:

50-40-30-20-10 reps
• Double-unders
• Sit-ups

Target: 11 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Barbara
('wod_barbara', 'Barbara', 'For time:

5 rounds
• 20 pull-ups
• 30 push-ups
• 40 sit-ups
• 50 air squats
• 3 minutes rest

Target: 8 minutes per round', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Candy
('wod_candy', 'Candy', 'For time:

5 rounds
• 20 pull-ups
• 40 push-ups
• 60 squats

Target: 38 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Chelsea
('wod_chelsea', 'Chelsea', 'EMOM 30:
• 5 pull-ups
• 10 push-ups
• 15 air squats

Target: 20 rounds', 'emom', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 30, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Cindy
('wod_cindy', 'Cindy', 'AMRAP 20 minutes:
• 5 pull-ups
• 10 push-ups
• 15 air squats

Target: 12 rounds', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Diane
('wod_diane', 'Diane', 'For time:

21-15-9 reps
• Deadlifts (225/155lb)
• Handstand push-ups

Target: 4 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Elizabeth
('wod_elizabeth', 'Elizabeth', 'For time:

21-15-9 reps
• Squat Cleans (135/95lb)
• Ring Dips

', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Eva
('wod_eva', 'Eva', 'For time:

5 rounds
• 800-meter run
• 30 kettlebell swings (2 pood)
• 30 pull-ups

Target: 70 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Fran
('wod_fran', 'Fran', 'For time:

21-15-9 reps
• Thrusters (95/75lb)
• Pull-ups

Target: 5 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Grace
('wod_grace', 'Grace', 'For time:
• 30 Clean-and-Jerks (135/95lb)

Target: 8 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Gwen
('wod_gwen', 'Gwen', 'For time:
• 15-12-9 Clean and Jerks (unbroken)
• Rest as needed between sets

Score is weight used for all three unbroken sets. Each set must be unbroken (touch and go at floor) only; even a re-grip off the floor is a foul. Use same load for each set.

Target: 390 pounds', 'load', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Helen
('wod_helen', 'Helen', 'For time:

3 rounds
• 400-meter run
• 21 kettlebell swings (50/35lb)
• 12 pull-ups

Target: 16 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hope
('wod_hope', 'Hope', 'AMRAP 3 rounds:
• Burpees
• Power snatch (75/55lb)
• Box jump (24/20 inch)
• Thruster (75/55lb)
• Chest to bar Pull-ups

Target: 150 points', 'points', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Isabel
('wod_isabel', 'Isabel', 'For time:
• 30 Snatches (135/95lb)

Target: 16 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jackie
('wod_jackie', 'Jackie', 'For time:
• 1,000-meter row
• 50 thrusters (45/35lb)
• 30 pull-ups

Target: 18 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Karen
('wod_karen', 'Karen', 'For time:
• 150 Wall Ball Shots (20/14lb)

Target: 15 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Kelly
('wod_kelly', 'Kelly', 'For time:

5 rounds
• 400-meter run
• 30 box jumps (24/20 inch)
• 30 wall ball shots (20/14 lbs)

Target: 50 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Linda
('wod_linda', 'Linda', 'For time:

10-9-8-7-6-5-4-3-2-1 reps
• Deadlift (1.5 BW)
• Bench Press (BW)
• Clean (0.75 BW)

Target: 30 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Lynne
('wod_lynne', 'Lynne', '5 rounds:
• Max reps Bench Press (body weight)
• Pull-ups

Target: 50 reps total', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 5, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Maggie
('wod_maggie', 'Maggie', 'For time:

5 rounds
• 20 Handstand Push-ups
• 40 Pull-ups
• 60 Pistols (alternating legs)

Target: 60 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Marguerita
('wod_marguerita', 'Marguerita', 'For time:

50 rounds
• 1 Burpee
• 1 Push-up
• 1 Jumping-jack
• 1 Sit-up
• 1 Handstand push up

Target: 25 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Mary
('wod_mary', 'Mary', 'AMRAP 20 minutes:
• 5 handstand push-ups
• 10 pistols (alternating legs)
• 15 pull-ups

Target: 5 rounds', 'rounds-reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Megan
('wod_megan', 'Megan', 'For time:

21-15-9 reps
• Burpees
• KB Swings (53/35lb)
• Double-unders

Target: 8 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nancy
('wod_nancy', 'Nancy', 'For time:

5 rounds
• 400-meter run
• 15 overhead squats (95/65lb)

Target: 22 minutes', 'time', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nicole
('wod_nicole', 'Nicole', 'AMRAP:

5 rounds
• 400-meter run
• Max reps pull-ups

Target: 55 reps total', 'reps', 'public', 'team_cokkpu1klwo0ulfhl1iwzpvn', 5, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Tag all workouts as Girls benchmarks
INSERT INTO workout_tags (id, workout_id, tag_id, createdAt, updatedAt, updateCounter) VALUES 
('wtag_amanda_girl', 'wod_amanda', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_amanda_benchmark', 'wod_amanda', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_angie_girl', 'wod_angie', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_angie_benchmark', 'wod_angie', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_annie_girl', 'wod_annie', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_annie_benchmark', 'wod_annie', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_barbara_girl', 'wod_barbara', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_barbara_benchmark', 'wod_barbara', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_candy_girl', 'wod_candy', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_candy_benchmark', 'wod_candy', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_chelsea_girl', 'wod_chelsea', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_chelsea_benchmark', 'wod_chelsea', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_chelsea_emom', 'wod_chelsea', 'tag_emom', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_cindy_girl', 'wod_cindy', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_cindy_benchmark', 'wod_cindy', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_cindy_amrap', 'wod_cindy', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_diane_girl', 'wod_diane', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_diane_benchmark', 'wod_diane', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_elizabeth_girl', 'wod_elizabeth', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_elizabeth_benchmark', 'wod_elizabeth', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_eva_girl', 'wod_eva', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_eva_benchmark', 'wod_eva', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_fran_girl', 'wod_fran', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_fran_benchmark', 'wod_fran', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_grace_girl', 'wod_grace', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_grace_benchmark', 'wod_grace', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_gwen_girl', 'wod_gwen', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_gwen_benchmark', 'wod_gwen', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_helen_girl', 'wod_helen', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_helen_benchmark', 'wod_helen', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hope_girl', 'wod_hope', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_hope_benchmark', 'wod_hope', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_isabel_girl', 'wod_isabel', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_isabel_benchmark', 'wod_isabel', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jackie_girl', 'wod_jackie', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jackie_benchmark', 'wod_jackie', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_jackie_chipper', 'wod_jackie', 'tag_chipper', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_karen_girl', 'wod_karen', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_karen_benchmark', 'wod_karen', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_kelly_girl', 'wod_kelly', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_kelly_benchmark', 'wod_kelly', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_linda_girl', 'wod_linda', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_linda_benchmark', 'wod_linda', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_lynne_girl', 'wod_lynne', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_lynne_benchmark', 'wod_lynne', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_maggie_girl', 'wod_maggie', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_maggie_benchmark', 'wod_maggie', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_marguerita_girl', 'wod_marguerita', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_marguerita_benchmark', 'wod_marguerita', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mary_girl', 'wod_mary', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mary_benchmark', 'wod_mary', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_mary_amrap', 'wod_mary', 'tag_amrap', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_megan_girl', 'wod_megan', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_megan_benchmark', 'wod_megan', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nancy_girl', 'wod_nancy', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nancy_benchmark', 'wod_nancy', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nicole_girl', 'wod_nicole', 'tag_girl', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wtag_nicole_benchmark', 'wod_nicole', 'tag_benchmark', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Create workout movements relationships (using existing movement IDs from seed.sql)
INSERT INTO workout_movements (id, workout_id, movement_id, createdAt, updatedAt, updateCounter) VALUES 
-- Amanda: Muscle-ups, Squat Snatches
('wm_amanda_muscleup', 'wod_amanda', 'mov_muscleup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_amanda_snatch', 'wod_amanda', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Angie: Pull-ups, Push-ups, Sit-ups, Squats
('wm_angie_pullup', 'wod_angie', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_angie_pushup', 'wod_angie', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_angie_situp', 'wod_angie', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_angie_squat', 'wod_angie', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Annie: Double-unders, Sit-ups
('wm_annie_du', 'wod_annie', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_annie_situp', 'wod_annie', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Barbara: Pull-ups, Push-ups, Sit-ups, Air squats
('wm_barbara_pullup', 'wod_barbara', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_barbara_pushup', 'wod_barbara', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_barbara_situp', 'wod_barbara', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_barbara_squat', 'wod_barbara', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Candy: Pull-ups, Push-ups, Squats  
('wm_candy_pullup', 'wod_candy', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_candy_pushup', 'wod_candy', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_candy_squat', 'wod_candy', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Chelsea: Pull-ups, Push-ups, Air squats
('wm_chelsea_pullup', 'wod_chelsea', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_chelsea_pushup', 'wod_chelsea', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_chelsea_squat', 'wod_chelsea', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Cindy: Pull-ups, Push-ups, Air squats
('wm_cindy_pullup', 'wod_cindy', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_cindy_pushup', 'wod_cindy', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_cindy_squat', 'wod_cindy', 'mov_airsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Diane: Deadlifts, Handstand Push-ups
('wm_diane_deadlift', 'wod_diane', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_diane_hspu', 'wod_diane', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Elizabeth: Squat Cleans, Ring Dips (using clean for squat clean, no ring dips in seed movements)
('wm_elizabeth_clean', 'wod_elizabeth', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Eva: Run, Kettlebell Swings, Pull-ups
('wm_eva_run', 'wod_eva', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_eva_kbswing', 'wod_eva', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_eva_pullup', 'wod_eva', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Fran: Thrusters, Pull-ups
('wm_fran_thruster', 'wod_fran', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_fran_pullup', 'wod_fran', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Grace: Clean and Jerks
('wm_grace_cj', 'wod_grace', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Gwen: Clean and Jerks
('wm_gwen_cj', 'wod_gwen', 'mov_cleanjerk', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Helen: Run, Kettlebell Swings, Pull-ups
('wm_helen_run', 'wod_helen', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_helen_kbswing', 'wod_helen', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_helen_pullup', 'wod_helen', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Hope: Burpees, Power Snatch, Box Jump, Thruster, Chest to Bar Pull-ups
('wm_hope_burpee', 'wod_hope', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hope_powersnatch', 'wod_hope', 'mov_powersnatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hope_boxjump', 'wod_hope', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hope_thruster', 'wod_hope', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_hope_ctbpullup', 'wod_hope', 'mov_ctbpullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Isabel: Snatches
('wm_isabel_snatch', 'wod_isabel', 'mov_snatch', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jackie: Row, Thrusters, Pull-ups
('wm_jackie_row', 'wod_jackie', 'mov_row', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jackie_thruster', 'wod_jackie', 'mov_thruster', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_jackie_pullup', 'wod_jackie', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Karen: Wall Ball
('wm_karen_wallball', 'wod_karen', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Kelly: Run, Box Jumps, Wall Ball
('wm_kelly_run', 'wod_kelly', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_kelly_boxjump', 'wod_kelly', 'mov_boxjump', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_kelly_wallball', 'wod_kelly', 'mov_wallball', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Linda: Deadlift, Bench Press, Clean
('wm_linda_deadlift', 'wod_linda', 'mov_deadlift', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_linda_bench', 'wod_linda', 'mov_benchpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_linda_clean', 'wod_linda', 'mov_clean', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Lynne: Bench Press, Pull-ups
('wm_lynne_bench', 'wod_lynne', 'mov_benchpress', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_lynne_pullup', 'wod_lynne', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Maggie: Handstand Push-ups, Pull-ups, Pistols
('wm_maggie_hspu', 'wod_maggie', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_maggie_pullup', 'wod_maggie', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_maggie_pistol', 'wod_maggie', 'mov_pistol', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Marguerita: Burpees, Push-ups, Jumping Jacks, Sit-ups, Handstand Push-ups
('wm_marguerita_burpee', 'wod_marguerita', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_marguerita_pushup', 'wod_marguerita', 'mov_pushup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_marguerita_jumpingjack', 'wod_marguerita', 'mov_jumpingjack', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_marguerita_situp', 'wod_marguerita', 'mov_situp', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_marguerita_hspu', 'wod_marguerita', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Mary: Handstand Push-ups, Pistols, Pull-ups
('wm_mary_hspu', 'wod_mary', 'mov_hspu', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mary_pistol', 'wod_mary', 'mov_pistol', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_mary_pullup', 'wod_mary', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Megan: Burpees, KB Swings, Double-unders
('wm_megan_burpee', 'wod_megan', 'mov_burpee', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_megan_kbswing', 'wod_megan', 'mov_kbswing', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_megan_du', 'wod_megan', 'mov_doubleunder', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nancy: Run, Overhead Squats
('wm_nancy_run', 'wod_nancy', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nancy_ohsquat', 'wod_nancy', 'mov_ohsquat', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Nicole: Run, Pull-ups
('wm_nicole_run', 'wod_nicole', 'mov_run', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('wm_nicole_pullup', 'wod_nicole', 'mov_pullup', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Add all workouts to the Girls programming track
INSERT INTO track_workout (id, trackId, workoutId, dayNumber, weekNumber, notes, createdAt, updatedAt, updateCounter) VALUES 
('trwk_girls_amanda', 'ptrk_girls', 'wod_amanda', 1, 1, 'Classic benchmark - muscle-ups and squat snatches', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_angie', 'ptrk_girls', 'wod_angie', 2, 1, 'High volume bodyweight movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_annie', 'ptrk_girls', 'wod_annie', 3, 1, 'Double-unders and sit-ups descending ladder', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_barbara', 'ptrk_girls', 'wod_barbara', 4, 1, 'Time with rest - stay unbroken', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_candy', 'ptrk_girls', 'wod_candy', 5, 1, 'High volume upper body work', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_chelsea', 'ptrk_girls', 'wod_chelsea', 6, 1, 'EMOM format - maintain consistency', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_cindy', 'ptrk_girls', 'wod_cindy', 7, 1, 'Classic AMRAP - pace yourself', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_diane', 'ptrk_girls', 'wod_diane', 8, 2, 'Heavy deadlifts and handstand push-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_elizabeth', 'ptrk_girls', 'wod_elizabeth', 9, 2, 'Squat cleans and ring dips', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_eva', 'ptrk_girls', 'wod_eva', 10, 2, 'Long chipper - pace management critical', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_fran', 'ptrk_girls', 'wod_fran', 11, 2, 'The classic sprint - fast and light', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_grace', 'ptrk_girls', 'wod_grace', 12, 2, 'Pure strength endurance - 30 clean and jerks', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_gwen', 'ptrk_girls', 'wod_gwen', 13, 2, 'Load-based scoring - find your max unbroken weight', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_helen', 'ptrk_girls', 'wod_helen', 14, 2, 'Running and upper body combo', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_hope', 'ptrk_girls', 'wod_hope', 15, 3, 'Points-based scoring across 5 stations', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_isabel', 'ptrk_girls', 'wod_isabel', 16, 3, '30 snatches - technical and demanding', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_jackie', 'ptrk_girls', 'wod_jackie', 17, 3, 'Chipper format - row, thrusters, pull-ups', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_karen', 'ptrk_girls', 'wod_karen', 18, 3, 'Simple but brutal - just wall balls', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_kelly', 'ptrk_girls', 'wod_kelly', 19, 3, 'Mixed modal endurance workout', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_linda', 'ptrk_girls', 'wod_linda', 20, 3, 'Strength ladder based on bodyweight percentages', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_lynne', 'ptrk_girls', 'wod_lynne', 21, 3, 'Upper body strength endurance test', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_maggie', 'ptrk_girls', 'wod_maggie', 22, 4, 'Advanced gymnastic movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_marguerita', 'ptrk_girls', 'wod_marguerita', 23, 4, 'High volume mixed movements', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_mary', 'ptrk_girls', 'wod_mary', 24, 4, 'Advanced gymnastic AMRAP', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_megan', 'ptrk_girls', 'wod_megan', 25, 4, 'Fast couplet with skill component', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_nancy', 'ptrk_girls', 'wod_nancy', 26, 4, 'Running with overhead squats', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_nicole', 'ptrk_girls', 'wod_nicole', 27, 4, 'Run and max pull-ups format', strftime('%s', 'now'), strftime('%s', 'now'), 0);


-- Seed some sample results
INSERT OR IGNORE INTO results (id, user_id, date, workout_id, type, wod_score, scale, notes, createdAt, updatedAt, updateCounter) VALUES 
('res_john_fran', 'usr_demo3member', strftime('%s', 'now'), 'wod_fran', 'wod', '4:23', 'rx', 'Great form on thrusters', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('res_jane_cindy', 'usr_demo4member', strftime('%s', 'now'), 'wod_cindy', 'wod', '15 rounds + 3 reps', 'rx', 'Consistent pace throughout', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('res_coach_helen', 'usr_demo2coach', strftime('%s', 'now'), 'wod_helen', 'wod', '8:45', 'rx', 'Pushed hard on the runs', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed some sample strength results
INSERT OR IGNORE INTO results (id, user_id, date, type, set_count, notes, createdAt, updatedAt, updateCounter) VALUES 
('res_john_squat', 'usr_demo3member', strftime('%s', 'now'), 'strength', 5, 'Back squat work - feeling strong', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('res_jane_press', 'usr_demo4member', strftime('%s', 'now'), 'strength', 3, 'Overhead press PR attempt', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed some sets for the strength results
INSERT OR IGNORE INTO sets (id, result_id, set_number, reps, weight, notes, createdAt, updatedAt, updateCounter) VALUES 
-- John's back squats
('set_john_squat_1', 'res_john_squat', 1, 5, 185, 'Warmup set', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('set_john_squat_2', 'res_john_squat', 2, 5, 205, 'Working weight', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('set_john_squat_3', 'res_john_squat', 3, 5, 225, 'Getting heavy', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('set_john_squat_4', 'res_john_squat', 4, 3, 245, 'Near max effort', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('set_john_squat_5', 'res_john_squat', 5, 1, 255, 'New PR!', strftime('%s', 'now'), strftime('%s', 'now'), 0),

-- Jane's overhead press
('set_jane_press_1', 'res_jane_press', 1, 5, 65, 'Warmup', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('set_jane_press_2', 'res_jane_press', 2, 3, 85, 'Working up', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('set_jane_press_3', 'res_jane_press', 3, 1, 95, 'PR attempt - success!', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed some sample credit transactions
INSERT OR IGNORE INTO credit_transaction (id, userId, amount, remainingAmount, type, description, createdAt, updatedAt, updateCounter) VALUES
('ctxn_admin_monthly', 'usr_demo1admin', 100, 90, 'MONTHLY_REFRESH', 'Monthly admin credit refresh', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('ctxn_coach_purchase', 'usr_demo2coach', 50, 35, 'PURCHASE', 'Credit purchase - starter pack', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('ctxn_john_usage', 'usr_demo3member', -5, 0, 'USAGE', 'Used credits for premium workout', strftime('%s', 'now'), strftime('%s', 'now'), 0);
