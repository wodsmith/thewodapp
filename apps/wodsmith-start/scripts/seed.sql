-- Competition deep children
DELETE FROM score_rounds;
DELETE FROM scores;
DELETE FROM judge_heat_assignments;
DELETE FROM judge_assignment_versions;
DELETE FROM competition_judge_rotations;
DELETE FROM video_submissions;
DELETE FROM submission_window_notifications;
DELETE FROM event_judging_sheets;
DELETE FROM event_resources;
DELETE FROM competition_events;
DELETE FROM competition_heat_assignments;
DELETE FROM competition_heats;
DELETE FROM competition_registration_answers;
DELETE FROM competition_registration_questions;
DELETE FROM competition_registrations;
DELETE FROM competition_venues;
DELETE FROM competition_divisions;
DELETE FROM competitions;
DELETE FROM competition_groups;
DELETE FROM addresses;
-- Scheduling
DELETE FROM scheduled_classes;
DELETE FROM generated_schedules;
DELETE FROM schedule_template_class_required_skills;
DELETE FROM schedule_template_classes;
DELETE FROM schedule_templates;
-- Programming
DELETE FROM scheduled_workout_instance;
DELETE FROM team_programming_track;
DELETE FROM track_workout;
DELETE FROM programming_track;
-- Workouts and related
DELETE FROM sets;
DELETE FROM results;
DELETE FROM workout_scaling_descriptions;
DELETE FROM workout_movements;
DELETE FROM workout_tags;
DELETE FROM workouts;
DELETE FROM spicy_tags;
DELETE FROM movements;
-- Scaling
DELETE FROM scaling_levels;
DELETE FROM scaling_groups;
-- Coaches / Classes
DELETE FROM coach_to_skills;
DELETE FROM class_catalog_to_skills;
DELETE FROM coach_blackout_dates;
DELETE FROM coach_recurring_unavailability;
DELETE FROM coaches;
DELETE FROM class_catalog;
DELETE FROM skills;
DELETE FROM locations;
-- Sponsors
DELETE FROM sponsors;
DELETE FROM sponsor_groups;
-- Commerce
DELETE FROM purchased_item;
DELETE FROM credit_transaction;
DELETE FROM commerce_purchase;
DELETE FROM commerce_product;
-- Auth
DELETE FROM passkey_credential;
DELETE FROM waiver_signatures;
DELETE FROM waivers;
-- Team hierarchy (children before parents)
DELETE FROM affiliates;
DELETE FROM organizer_request;
DELETE FROM team_invitation;
DELETE FROM team_membership;
DELETE FROM team_role;
DELETE FROM team_entitlement_override;
DELETE FROM team_feature_entitlement;
DELETE FROM team_limit_entitlement;
DELETE FROM team_usage;
DELETE FROM team_addon;
DELETE FROM team_subscription;
DELETE FROM entitlement;
-- Plans and features (before team due to currentPlanId FK)
DELETE FROM plan_limit;
DELETE FROM plan_feature;
DELETE FROM plan;
DELETE FROM "limit";
DELETE FROM feature;
DELETE FROM entitlement_type;
-- Core entities
DELETE FROM team;
DELETE FROM user;

-- Seed global default scaling group (system-wide default)
-- This must be seeded first as it's used as the ultimate fallback for all workouts
INSERT OR IGNORE INTO scaling_groups (id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter) VALUES
('sgrp_global_default', 'Standard Scaling', 'Default Rx+, Rx, and Scaled levels for backward compatibility', NULL, 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed global default scaling levels
INSERT OR IGNORE INTO scaling_levels (id, scalingGroupId, label, position, teamSize, createdAt, updatedAt, updateCounter) VALUES
('slvl_global_rxplus', 'sgrp_global_default', 'Rx+', 0, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_global_rx', 'sgrp_global_default', 'Rx', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_global_scaled', 'sgrp_global_default', 'Scaled', 2, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

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

-- Insert features
INSERT OR IGNORE INTO feature (id, "key", name, description, category, isActive, createdAt, updatedAt, updateCounter)
VALUES
  ('feat_basic_workouts', 'basic_workouts', 'Basic Workouts', 'Create and manage basic workout templates', 'workouts', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_programming_tracks', 'programming_tracks', 'Programming Tracks', 'Create and manage unlimited programming tracks', 'programming', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_program_calendar', 'program_calendar', 'Program Calendar', 'Visual calendar for programming schedules', 'programming', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_program_analytics', 'program_analytics', 'Program Analytics', 'Advanced analytics for programming effectiveness', 'programming', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_custom_scaling_groups', 'custom_scaling_groups', 'Custom Scaling Groups', 'Create custom scaling groups for your gym', 'scaling', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_ai_workout_generation', 'ai_workout_generation', 'AI Workout Generation', 'Generate workouts using AI', 'ai', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_ai_programming_assistant', 'ai_programming_assistant', 'AI Programming Assistant', 'AI assistant for programming strategy', 'ai', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_multi_team_management', 'multi_team_management', 'Multi-Team Management', 'Manage multiple teams from one account', 'team', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_host_competitions', 'host_competitions', 'Host Competitions', 'Create and manage competitions and events', 'team', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('feat_workout_tracking', 'workout_tracking', 'Workout Tracking', 'Access to personal workout tracking features', 'workouts', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert limits
INSERT OR IGNORE INTO "limit" (id, "key", name, description, unit, resetPeriod, isActive, createdAt, updatedAt, updateCounter)
VALUES
  ('lmt_max_members_per_team', 'max_members_per_team', 'Team Members', 'Maximum members per team', 'members', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_max_admins', 'max_admins', 'Admins', 'Number of admin users per team', 'admins', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_max_programming_tracks', 'max_programming_tracks', 'Programming Tracks', 'Number of programming tracks per team', 'tracks', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_ai_messages_per_month', 'ai_messages_per_month', 'AI Messages', 'AI-powered messages per month', 'messages', 'monthly', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_max_published_competitions', 'max_published_competitions', 'Published Competitions', 'Maximum public competitions (0: pending approval, -1: unlimited)', 'competitions', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert plans (Free, Pro, Enterprise)
-- Note: entitlements field is deprecated, features/limits are now stored in junction tables
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
  NULL,
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
  NULL,
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
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);

-- Link features to plans (plan_feature junction table)
-- Free plan features
INSERT OR IGNORE INTO plan_feature (id, planId, featureId, createdAt, updatedAt, updateCounter)
VALUES
  ('pf_free_basic_workouts', 'free', 'feat_basic_workouts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_free_programming_tracks', 'free', 'feat_programming_tracks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Pro plan features
INSERT OR IGNORE INTO plan_feature (id, planId, featureId, createdAt, updatedAt, updateCounter)
VALUES
  ('pf_pro_basic_workouts', 'pro', 'feat_basic_workouts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_pro_programming_tracks', 'pro', 'feat_programming_tracks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_pro_program_calendar', 'pro', 'feat_program_calendar', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_pro_custom_scaling_groups', 'pro', 'feat_custom_scaling_groups', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_pro_ai_workout_generation', 'pro', 'feat_ai_workout_generation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_pro_multi_team_management', 'pro', 'feat_multi_team_management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Enterprise plan features
INSERT OR IGNORE INTO plan_feature (id, planId, featureId, createdAt, updatedAt, updateCounter)
VALUES
  ('pf_ent_basic_workouts', 'enterprise', 'feat_basic_workouts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_programming_tracks', 'enterprise', 'feat_programming_tracks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_program_calendar', 'enterprise', 'feat_program_calendar', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_program_analytics', 'enterprise', 'feat_program_analytics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_custom_scaling_groups', 'enterprise', 'feat_custom_scaling_groups', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_ai_workout_generation', 'enterprise', 'feat_ai_workout_generation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_ai_programming_assistant', 'enterprise', 'feat_ai_programming_assistant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pf_ent_multi_team_management', 'enterprise', 'feat_multi_team_management', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Link limits to plans (plan_limit junction table)
-- Free plan limits
INSERT OR IGNORE INTO plan_limit (id, planId, limitId, value, createdAt, updatedAt, updateCounter)
VALUES
  ('pl_free_max_members', 'free', 'lmt_max_members_per_team', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_free_max_tracks', 'free', 'lmt_max_programming_tracks', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_free_ai_messages', 'free', 'lmt_ai_messages_per_month', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_free_max_admins', 'free', 'lmt_max_admins', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Pro plan limits
INSERT OR IGNORE INTO plan_limit (id, planId, limitId, value, createdAt, updatedAt, updateCounter)
VALUES
  ('pl_pro_max_members', 'pro', 'lmt_max_members_per_team', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_pro_max_tracks', 'pro', 'lmt_max_programming_tracks', -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_pro_ai_messages', 'pro', 'lmt_ai_messages_per_month', 200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_pro_max_admins', 'pro', 'lmt_max_admins', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Enterprise plan limits
INSERT OR IGNORE INTO plan_limit (id, planId, limitId, value, createdAt, updatedAt, updateCounter)
VALUES
  ('pl_ent_max_members', 'enterprise', 'lmt_max_members_per_team', -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_ent_max_tracks', 'enterprise', 'lmt_max_programming_tracks', -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_ent_ai_messages', 'enterprise', 'lmt_ai_messages_per_month', -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pl_ent_max_admins', 'enterprise', 'lmt_max_admins', -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed users table
-- Password for all users: password123
INSERT OR IGNORE INTO user (id, firstName, lastName, email, emailVerified, passwordHash, role, currentCredits, gender, dateOfBirth, createdAt, updatedAt, updateCounter) VALUES
('usr_demo1admin', 'Admin', 'User', 'admin@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'admin', 100, 'male', strftime('%s', '1985-03-15'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_demo2coach', 'Coach', 'Smith', 'coach@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 50, 'male', strftime('%s', '1990-07-22'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_demo3member', 'John', 'Doe', 'john@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, 'male', strftime('%s', '1992-11-08'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_demo4member', 'Jane', 'Smith', 'jane@example.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 25, 'female', strftime('%s', '1995-05-30'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Additional athletes for competition registration testing
('usr_athlete_mike', 'Mike', 'Johnson', 'mike@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1988-09-12'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_sarah', 'Sarah', 'Williams', 'sarah@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1993-02-28'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_chris', 'Chris', 'Brown', 'chris@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1991-06-17'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_emma', 'Emma', 'Davis', 'emma@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1997-12-05'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Additional RX Division Athletes (10 total)
('usr_athlete_alex', 'Alex', 'Turner', 'alex.turner@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1994-03-15'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_ryan', 'Ryan', 'Mitchell', 'ryan.mitchell@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1992-07-22'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_marcus', 'Marcus', 'Reed', 'marcus.reed@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1990-11-08'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_tyler', 'Tyler', 'Brooks', 'tyler.brooks@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1995-01-30'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_jordan', 'Jordan', 'Hayes', 'jordan.hayes@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1993-09-12'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_nathan', 'Nathan', 'Cole', 'nathan.cole@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1991-05-25'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_derek', 'Derek', 'Foster', 'derek.foster@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1989-12-03'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_brandon', 'Brandon', 'West', 'brandon.west@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1996-08-17'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Additional Scaled Division Athletes (10 total)
('usr_athlete_megan', 'Megan', 'Parker', 'megan.parker@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1996-04-20'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_ashley', 'Ashley', 'Morgan', 'ashley.morgan@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1998-02-14'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_brittany', 'Brittany', 'Taylor', 'brittany.taylor@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1994-10-05'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_stephanie', 'Stephanie', 'Clark', 'stephanie.clark@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1993-06-28'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_lauren', 'Lauren', 'Adams', 'lauren.adams@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1997-01-11'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_nicole', 'Nicole', 'Roberts', 'nicole.roberts@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1995-08-19'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_amanda', 'Amanda', 'Nelson', 'amanda.nelson@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1992-12-07'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_athlete_kaitlyn', 'Kaitlyn', 'Hill', 'kaitlyn.hill@athlete.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1999-03-24'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Volunteers for Winter Throwdown 2025
('usr_volunteer_dave', 'Dave', 'Martinez', 'dave.martinez@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1985-04-12'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_lisa', 'Lisa', 'Chen', 'lisa.chen@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1990-08-25'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_tom', 'Tom', 'Wilson', 'tom.wilson@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1988-01-17'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_rachel', 'Rachel', 'Kim', 'rachel.kim@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1992-11-30'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_james', 'James', 'Rodriguez', 'james.rodriguez@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1987-06-08'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_emily', 'Emily', 'Thompson', 'emily.thompson@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1994-02-14'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_kevin', 'Kevin', 'Patel', 'kevin.patel@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1991-09-22'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_maria', 'Maria', 'Garcia', 'maria.garcia@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1989-12-03'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_brian', 'Brian', 'Lee', 'brian.lee@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'male', strftime('%s', '1993-07-19'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('usr_volunteer_sandra', 'Sandra', 'Nguyen', 'sandra.nguyen@volunteer.com', 1750194531, '8057bcf2b7ac55f82aa8d4d9e19a92f2:6151dccae7ea01138ea27feada39fa1337437c82d9d050723b5d35b679799983', 'user', 0, 'female', strftime('%s', '1995-05-11'), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed teams table (with different plans for testing)
-- type: 'gym' (default), 'competition_event', or 'personal'
INSERT OR IGNORE INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId, currentPlanId, type, parentOrganizationId) VALUES
('team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'CrossFit Box One', 'crossfit-box-one', 'Premier CrossFit gym in downtown', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, 'pro', 'gym', NULL),
('team_homeymgym', 'Home Gym Heroes', 'home-gym-heroes', 'For athletes training at home', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, 'enterprise', 'gym', NULL),
('team_personaladmin', 'Admin Personal', 'admin-personal', 'Personal team for admin user', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo1admin', 'free', 'personal', NULL),
('team_personalcoach', 'Coach Personal', 'coach-personal', 'Personal team for coach user', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo2coach', 'free', 'personal', NULL),
('team_personaljohn', 'John Personal', 'john-personal', 'Personal team for John Doe', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo3member', 'free', 'personal', NULL),
('team_personaljane', 'Jane Personal', 'jane-personal', 'Personal team for Jane Smith', strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, 'usr_demo4member', 'free', 'personal', NULL),
-- Competition event team (child of CrossFit Box One)
('team_winter_throwdown_2025', 'Winter Throwdown 2025', 'winter-throwdown-2025', 'Competition event team for Winter Throwdown 2025', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, NULL, 'competition_event', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1');

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
INSERT INTO team (id, name, slug, description, createdAt, updatedAt, updateCounter, isPersonalTeam, personalTeamOwnerId, creditBalance, currentPlanId, type, parentOrganizationId) VALUES
('team_cokkpu1klwo0ulfhl1iwzpvn', 'CrossFit', 'crossfit', 'Official CrossFit benchmark workouts and programming', strftime('%s', 'now'), strftime('%s', 'now'), 0, 0, NULL, 500, 'free', 'gym', NULL);

-- Create team membership for CrossFit user
INSERT INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES
('tmem_crossfit_owner', 'team_cokkpu1klwo0ulfhl1iwzpvn', 'usr_crossfit001', 'owner', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1);

-- ============================================
-- COMPETITION PLATFORM SEED DATA
-- CrossFit Box One hosts "Winter Throwdown 2025"
-- ============================================

-- Team memberships for the competition_event team
-- Admin of the organizing gym is also admin of the competition event team
INSERT OR IGNORE INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive) VALUES
('tmem_admin_winter_throwdown', 'team_winter_throwdown_2025', 'usr_demo1admin', 'admin', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
-- Athletes registered for the competition (member role in competition team)
('tmem_mike_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_mike', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_sarah_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_sarah', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_chris_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_chris', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_emma_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_emma', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_john_winter_throwdown', 'team_winter_throwdown_2025', 'usr_demo3member', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
-- Additional RX Division Athletes
('tmem_alex_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_alex', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_ryan_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_ryan', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_marcus_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_marcus', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_tyler_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_tyler', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_jordan_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_jordan', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_nathan_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_nathan', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_derek_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_derek', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_brandon_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_brandon', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
-- Additional Scaled Division Athletes
('tmem_megan_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_megan', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_ashley_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_ashley', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_brittany_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_brittany', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_stephanie_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_stephanie', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_lauren_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_lauren', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_nicole_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_nicole', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_amanda_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_amanda', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1),
('tmem_kaitlyn_winter_throwdown', 'team_winter_throwdown_2025', 'usr_athlete_kaitlyn', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1);

-- Volunteers for Winter Throwdown 2025
-- Volunteer memberships include metadata JSON with volunteer-specific info
INSERT OR IGNORE INTO team_membership (id, teamId, userId, roleId, isSystemRole, joinedAt, createdAt, updatedAt, updateCounter, isActive, metadata) VALUES
('tmem_volunteer_dave', 'team_winter_throwdown_2025', 'usr_volunteer_dave', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","head_judge"],"credentials":"L1 Judge Certified","shirtSize":"L","availability":"all_day","status":"approved","inviteSource":"direct"}'),
('tmem_volunteer_lisa', 'team_winter_throwdown_2025', 'usr_volunteer_lisa', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","scorekeeper"],"credentials":"CrossFit L2","shirtSize":"S","availability":"all_day","status":"approved","inviteSource":"direct"}'),
('tmem_volunteer_tom', 'team_winter_throwdown_2025', 'usr_volunteer_tom', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","equipment"],"shirtSize":"XL","availability":"morning","availabilityNotes":"Available 6am-12pm only","status":"approved","inviteSource":"application"}'),
('tmem_volunteer_rachel', 'team_winter_throwdown_2025', 'usr_volunteer_rachel', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","check_in","medical"],"credentials":"EMT Certified","shirtSize":"M","availability":"all_day","status":"approved","inviteSource":"direct"}'),
('tmem_volunteer_james', 'team_winter_throwdown_2025', 'usr_volunteer_james', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","floor_manager"],"credentials":"5 years judging experience","shirtSize":"L","availability":"all_day","status":"approved","inviteSource":"direct"}'),
('tmem_volunteer_emily', 'team_winter_throwdown_2025', 'usr_volunteer_emily', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","media"],"shirtSize":"S","availability":"afternoon","availabilityNotes":"Available after 12pm","status":"approved","inviteSource":"application"}'),
('tmem_volunteer_kevin', 'team_winter_throwdown_2025', 'usr_volunteer_kevin', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","scorekeeper"],"credentials":"L1 Trainer","shirtSize":"M","availability":"all_day","status":"approved","inviteSource":"direct"}'),
('tmem_volunteer_maria', 'team_winter_throwdown_2025', 'usr_volunteer_maria', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","emcee"],"credentials":"Former competitor","shirtSize":"S","availability":"all_day","status":"approved","inviteSource":"direct"}'),
('tmem_volunteer_brian', 'team_winter_throwdown_2025', 'usr_volunteer_brian', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","equipment","staff"],"shirtSize":"XL","availability":"morning","status":"approved","inviteSource":"application"}'),
('tmem_volunteer_sandra', 'team_winter_throwdown_2025', 'usr_volunteer_sandra', 'volunteer', 1, strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0, 1, '{"volunteerRoleTypes":["judge","general"],"credentials":"L1 Trainer","shirtSize":"M","availability":"all_day","status":"approved","inviteSource":"direct"}');

-- Affiliates (gyms that athletes can select when registering)
INSERT OR IGNORE INTO affiliates (id, name, location, verificationStatus, ownerTeamId, createdAt, updatedAt, updateCounter) VALUES
('aff_crossfit_canvas', 'CrossFit Canvas', 'Austin, TX', 'verified', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('aff_verdant_crossfit', 'Verdant CrossFit', 'Denver, CO', 'verified', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competition Groups (Series) - CrossFit Box One's annual throwdown series
INSERT OR IGNORE INTO competition_groups (id, organizingTeamId, slug, name, description, createdAt, updatedAt, updateCounter) VALUES
('cgrp_box1_throwdowns_2025', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', '2025-throwdown-series', '2025 Throwdown Series', 'CrossFit Box One''s annual community throwdown series featuring seasonal competitions throughout the year.', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competition-specific scaling group for Winter Throwdown 2025 divisions
INSERT OR IGNORE INTO scaling_groups (id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter) VALUES
('sgrp_winter_throwdown_2025', 'Winter Throwdown 2025 Divisions', 'Divisions for Winter Throwdown 2025', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 0, 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Division levels for Winter Throwdown 2025
INSERT OR IGNORE INTO scaling_levels (id, scalingGroupId, label, position, teamSize, createdAt, updatedAt, updateCounter) VALUES
('slvl_winter_rx', 'sgrp_winter_throwdown_2025', 'RX', 0, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_winter_rx_male_partner', 'sgrp_winter_throwdown_2025', 'RX Male Partner', 1, 2, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_winter_scaled', 'sgrp_winter_throwdown_2025', 'Scaled', 2, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_winter_masters_40', 'sgrp_winter_throwdown_2025', 'Masters 40+', 3, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_winter_teens', 'sgrp_winter_throwdown_2025', 'Teens 14-17', 4, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competitions - Winter Throwdown 2025
-- Registration opens 30 days before, closes 7 days before the event
-- defaultRegistrationFeeCents: 7500 = $75.00
INSERT OR IGNORE INTO competitions (id, organizingTeamId, competitionTeamId, groupId, slug, name, description, startDate, endDate, registrationOpensAt, registrationClosesAt, timezone, settings, defaultRegistrationFeeCents, visibility, status, competitionType, createdAt, updatedAt, updateCounter) VALUES
('comp_winter_throwdown_2025',
 'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
 'team_winter_throwdown_2025',
 'cgrp_box1_throwdowns_2025',
 'winter-throwdown-2025',
 'Winter Throwdown 2025',
 'Kick off the new year with CrossFit Box One''s signature winter competition! Four challenging workouts testing your strength, endurance, and mental toughness. Open to all skill levels with RX, RX Male Partner (teams of 2), Scaled, Masters 40+, and Teen divisions.',
 strftime('%Y-%m-%d', datetime('now', '+14 days')),
 strftime('%Y-%m-%d', datetime('now', '+14 days')),
 strftime('%Y-%m-%d', 'now'),
 strftime('%Y-%m-%d', datetime('now', '+7 days')),
 'America/Denver',
 '{"divisions": {"scalingGroupId": "sgrp_winter_throwdown_2025"}}',
 7500,
 'public',
 'published',
 'in-person',
 strftime('%s', 'now'),
 strftime('%s', 'now'),
 0);

-- Competition Registrations
-- Athletes registered for Winter Throwdown 2025
-- divisionId references scaling_levels for competition divisions
-- paymentStatus: PAID for seeded athletes
INSERT OR IGNORE INTO competition_registrations (id, eventId, userId, teamMemberId, divisionId, registeredAt, paymentStatus, paidAt, createdAt, updatedAt, updateCounter) VALUES
-- RX Division Athletes (10 total)
('creg_mike_winter', 'comp_winter_throwdown_2025', 'usr_athlete_mike', 'tmem_mike_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-27 10:30:00'), 'PAID', strftime('%s', '2024-12-27 10:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_sarah_winter', 'comp_winter_throwdown_2025', 'usr_athlete_sarah', 'tmem_sarah_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-27 14:15:00'), 'PAID', strftime('%s', '2024-12-27 14:16:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_alex_winter', 'comp_winter_throwdown_2025', 'usr_athlete_alex', 'tmem_alex_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-27 15:30:00'), 'PAID', strftime('%s', '2024-12-27 15:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_ryan_winter', 'comp_winter_throwdown_2025', 'usr_athlete_ryan', 'tmem_ryan_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-28 08:00:00'), 'PAID', strftime('%s', '2024-12-28 08:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_marcus_winter', 'comp_winter_throwdown_2025', 'usr_athlete_marcus', 'tmem_marcus_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-28 09:45:00'), 'PAID', strftime('%s', '2024-12-28 09:46:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_tyler_winter', 'comp_winter_throwdown_2025', 'usr_athlete_tyler', 'tmem_tyler_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-28 11:30:00'), 'PAID', strftime('%s', '2024-12-28 11:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_jordan_winter', 'comp_winter_throwdown_2025', 'usr_athlete_jordan', 'tmem_jordan_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-28 14:00:00'), 'PAID', strftime('%s', '2024-12-28 14:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_nathan_winter', 'comp_winter_throwdown_2025', 'usr_athlete_nathan', 'tmem_nathan_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-29 10:00:00'), 'PAID', strftime('%s', '2024-12-29 10:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_derek_winter', 'comp_winter_throwdown_2025', 'usr_athlete_derek', 'tmem_derek_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-29 12:30:00'), 'PAID', strftime('%s', '2024-12-29 12:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_brandon_winter', 'comp_winter_throwdown_2025', 'usr_athlete_brandon', 'tmem_brandon_winter_throwdown', 'slvl_winter_rx', strftime('%s', '2024-12-29 15:00:00'), 'PAID', strftime('%s', '2024-12-29 15:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Scaled Division Athletes (10 total)
('creg_emma_winter', 'comp_winter_throwdown_2025', 'usr_athlete_emma', 'tmem_emma_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-29 16:45:00'), 'PAID', strftime('%s', '2024-12-29 16:46:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_john_winter', 'comp_winter_throwdown_2025', 'usr_demo3member', 'tmem_john_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-30 11:20:00'), 'PAID', strftime('%s', '2024-12-30 11:21:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_megan_winter', 'comp_winter_throwdown_2025', 'usr_athlete_megan', 'tmem_megan_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-30 13:00:00'), 'PAID', strftime('%s', '2024-12-30 13:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_ashley_winter', 'comp_winter_throwdown_2025', 'usr_athlete_ashley', 'tmem_ashley_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-30 14:30:00'), 'PAID', strftime('%s', '2024-12-30 14:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_brittany_winter', 'comp_winter_throwdown_2025', 'usr_athlete_brittany', 'tmem_brittany_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-31 09:00:00'), 'PAID', strftime('%s', '2024-12-31 09:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_stephanie_winter', 'comp_winter_throwdown_2025', 'usr_athlete_stephanie', 'tmem_stephanie_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-31 10:30:00'), 'PAID', strftime('%s', '2024-12-31 10:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_lauren_winter', 'comp_winter_throwdown_2025', 'usr_athlete_lauren', 'tmem_lauren_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-31 12:00:00'), 'PAID', strftime('%s', '2024-12-31 12:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_nicole_winter', 'comp_winter_throwdown_2025', 'usr_athlete_nicole', 'tmem_nicole_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-31 14:00:00'), 'PAID', strftime('%s', '2024-12-31 14:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_amanda_winter', 'comp_winter_throwdown_2025', 'usr_athlete_amanda', 'tmem_amanda_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-31 15:30:00'), 'PAID', strftime('%s', '2024-12-31 15:31:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
('creg_kaitlyn_winter', 'comp_winter_throwdown_2025', 'usr_athlete_kaitlyn', 'tmem_kaitlyn_winter_throwdown', 'slvl_winter_scaled', strftime('%s', '2024-12-31 17:00:00'), 'PAID', strftime('%s', '2024-12-31 17:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Masters 40+ division
('creg_chris_winter', 'comp_winter_throwdown_2025', 'usr_athlete_chris', 'tmem_chris_winter_throwdown', 'slvl_winter_masters_40', strftime('%s', '2024-12-28 09:00:00'), 'PAID', strftime('%s', '2024-12-28 09:01:00'), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competition Programming Track for Winter Throwdown 2025
-- Creates the track that holds competition events (workouts)
-- NOTE: Competition events (track_workout) are inserted AFTER workouts table is populated below
INSERT OR IGNORE INTO programming_track (id, name, description, type, ownerTeamId, scalingGroupId, isPublic, competitionId, createdAt, updatedAt, updateCounter) VALUES
('track_winter_throwdown_2025', 'Winter Throwdown 2025 - Events', 'Competition events for Winter Throwdown 2025', 'team_owned', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'sgrp_winter_throwdown_2025', 0, 'comp_winter_throwdown_2025', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================
-- END COMPETITION PLATFORM SEED DATA
-- (Competition events added after workouts below)
-- ============================================

-- Create team subscriptions (different plans for testing)
INSERT OR IGNORE INTO team_subscription (id, teamId, planId, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, createdAt, updatedAt, updateCounter) VALUES
('tsub_box1', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'pro', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_homegym', 'team_homeymgym', 'enterprise', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personaladmin', 'team_personaladmin', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personalcoach', 'team_personalcoach', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personaljohn', 'team_personaljohn', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_personaljane', 'team_personaljane', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tsub_crossfit', 'team_cokkpu1klwo0ulfhl1iwzpvn', 'free', 'active', strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed team feature entitlements (snapshot of features each team has)
-- CrossFit Box One (Pro plan)
INSERT OR IGNORE INTO team_feature_entitlement (id, teamId, featureId, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tfe_box1_basic', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_basic_workouts', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_box1_tracks', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_programming_tracks', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_box1_calendar', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_program_calendar', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_box1_scaling', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_custom_scaling_groups', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_box1_ai_workout', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_ai_workout_generation', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_box1_multi_team', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_multi_team_management', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_box1_host_comp', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feat_host_competitions', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);


INSERT OR IGNORE INTO team_feature_entitlement (id, teamId, featureId, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tfe_winter_basic', 'team_winter_throwdown_2025', 'feat_basic_workouts', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_winter_tracks', 'team_winter_throwdown_2025', 'feat_programming_tracks', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_winter_calendar', 'team_winter_throwdown_2025', 'feat_program_calendar', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_winter_scaling', 'team_winter_throwdown_2025', 'feat_custom_scaling_groups', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_winter_ai_workout', 'team_winter_throwdown_2025', 'feat_ai_workout_generation', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_winter_multi_team', 'team_winter_throwdown_2025', 'feat_multi_team_management', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_winter_host_comp', 'team_winter_throwdown_2025', 'feat_host_competitions', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Home Gym Heroes (Enterprise plan)
INSERT OR IGNORE INTO team_feature_entitlement (id, teamId, featureId, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tfe_hgh_basic', 'team_homeymgym', 'feat_basic_workouts', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_tracks', 'team_homeymgym', 'feat_programming_tracks', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_calendar', 'team_homeymgym', 'feat_program_calendar', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_analytics', 'team_homeymgym', 'feat_program_analytics', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_scaling', 'team_homeymgym', 'feat_custom_scaling_groups', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_ai_workout', 'team_homeymgym', 'feat_ai_workout_generation', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_ai_prog', 'team_homeymgym', 'feat_ai_programming_assistant', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_hgh_multi_team', 'team_homeymgym', 'feat_multi_team_management', 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Personal Teams (Free plan)
INSERT OR IGNORE INTO team_feature_entitlement (id, teamId, featureId, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tfe_padmin_basic', 'team_personaladmin', 'feat_basic_workouts', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_padmin_tracks', 'team_personaladmin', 'feat_programming_tracks', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pcoach_basic', 'team_personalcoach', 'feat_basic_workouts', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pcoach_tracks', 'team_personalcoach', 'feat_programming_tracks', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pjohn_basic', 'team_personaljohn', 'feat_basic_workouts', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pjohn_tracks', 'team_personaljohn', 'feat_programming_tracks', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pjane_basic', 'team_personaljane', 'feat_basic_workouts', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pjane_tracks', 'team_personaljane', 'feat_programming_tracks', 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed team limit entitlements (snapshot of limits each team has)
-- CrossFit Box One (Pro plan)
INSERT OR IGNORE INTO team_limit_entitlement (id, teamId, limitId, value, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tle_box1_members', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'lmt_max_members_per_team', 25, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_box1_tracks', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'lmt_max_programming_tracks', -1, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_box1_ai', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'lmt_ai_messages_per_month', 200, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_box1_admins', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'lmt_max_admins', 5, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Home Gym Heroes (Enterprise plan)
INSERT OR IGNORE INTO team_limit_entitlement (id, teamId, limitId, value, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tle_hgh_members', 'team_homeymgym', 'lmt_max_members_per_team', -1, 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_hgh_tracks', 'team_homeymgym', 'lmt_max_programming_tracks', -1, 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_hgh_ai', 'team_homeymgym', 'lmt_ai_messages_per_month', -1, 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_hgh_admins', 'team_homeymgym', 'lmt_max_admins', -1, 'plan', 'enterprise', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Personal Teams (Free plan - personal teams can only have 1 member, the owner)
INSERT OR IGNORE INTO team_limit_entitlement (id, teamId, limitId, value, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tle_padmin_members', 'team_personaladmin', 'lmt_max_members_per_team', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_padmin_tracks', 'team_personaladmin', 'lmt_max_programming_tracks', 2, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_padmin_ai', 'team_personaladmin', 'lmt_ai_messages_per_month', 10, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_padmin_admins', 'team_personaladmin', 'lmt_max_admins', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pcoach_members', 'team_personalcoach', 'lmt_max_members_per_team', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pcoach_tracks', 'team_personalcoach', 'lmt_max_programming_tracks', 2, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pcoach_ai', 'team_personalcoach', 'lmt_ai_messages_per_month', 10, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pcoach_admins', 'team_personalcoach', 'lmt_max_admins', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjohn_members', 'team_personaljohn', 'lmt_max_members_per_team', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjohn_tracks', 'team_personaljohn', 'lmt_max_programming_tracks', 2, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjohn_ai', 'team_personaljohn', 'lmt_ai_messages_per_month', 10, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjohn_admins', 'team_personaljohn', 'lmt_max_admins', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjane_members', 'team_personaljane', 'lmt_max_members_per_team', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjane_tracks', 'team_personaljane', 'lmt_max_programming_tracks', 2, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjane_ai', 'team_personaljane', 'lmt_ai_messages_per_month', 10, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pjane_admins', 'team_personaljane', 'lmt_max_admins', 1, 'plan', 'free', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Seed initial usage tracking for AI messages (monthly reset)
INSERT OR IGNORE INTO team_usage (id, teamId, limitKey, currentValue, periodStart, periodEnd, createdAt, updatedAt, updateCounter) VALUES
('tusage_box1_ai', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'ai_messages_per_month', 0, strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tusage_hgh_ai', 'team_homeymgym', 'ai_messages_per_month', 0, strftime('%s', 'now'), strftime('%s', datetime('now', '+1 month')), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- ============================================
-- ORGANIZER ONBOARDING SEED DATA
-- CrossFit Box One has an approved organizer application
-- ============================================

-- Approved organizer request for CrossFit Box One
-- Submitted by admin user (usr_demo1admin) and approved by system admin
INSERT OR IGNORE INTO organizer_request (id, teamId, userId, reason, status, adminNotes, reviewedBy, reviewedAt, createdAt, updatedAt, updateCounter) VALUES
('oreq_box1_approved', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'usr_demo1admin', 'CrossFit Box One wants to host local community competitions and throwdowns for our members and the greater fitness community.', 'approved', 'Approved - established CrossFit gym with good track record', 'usr_demo1admin', strftime('%s', 'now'), strftime('%s', datetime('now', '-7 days')), strftime('%s', 'now'), 0);

-- Team entitlement override for unlimited published competitions
-- This is set when an organizer request is approved (value -1 = unlimited)
INSERT OR IGNORE INTO team_entitlement_override (id, teamId, type, key, value, reason, expiresAt, createdBy, createdAt, updatedAt, updateCounter) VALUES
('teo_box1_competitions', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'limit', 'max_published_competitions', '-1', 'Organizer request approved', NULL, 'usr_demo1admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('teo_box1_workout_tracking', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feature', 'workout_tracking', 'true', 'Early access grant', NULL, 'usr_demo1admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('teo_personaladmin_workout_tracking', 'team_personaladmin', 'feature', 'workout_tracking', 'true', 'Early access grant', NULL, 'usr_demo1admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

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
INSERT INTO track_workout (id, trackId, workoutId, trackOrder, notes, heatStatus, createdAt, updatedAt, updateCounter) VALUES
('trwk_girls_amanda', 'ptrk_girls', 'wod_amanda', 1, 'Classic benchmark - muscle-ups and squat snatches', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_angie', 'ptrk_girls', 'wod_angie', 2, 'High volume bodyweight movements', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_annie', 'ptrk_girls', 'wod_annie', 3, 'Double-unders and sit-ups descending ladder', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_barbara', 'ptrk_girls', 'wod_barbara', 4, 'Time with rest - stay unbroken', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_candy', 'ptrk_girls', 'wod_candy', 5, 'High volume upper body work', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_chelsea', 'ptrk_girls', 'wod_chelsea', 6, 'EMOM format - maintain consistency', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_cindy', 'ptrk_girls', 'wod_cindy', 7, 'Classic AMRAP - pace yourself', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_diane', 'ptrk_girls', 'wod_diane', 8, 'Heavy deadlifts and handstand push-ups', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_elizabeth', 'ptrk_girls', 'wod_elizabeth', 9, 'Squat cleans and ring dips', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_eva', 'ptrk_girls', 'wod_eva', 10, 'Long chipper - pace management critical', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_fran', 'ptrk_girls', 'wod_fran', 11, 'The classic sprint - fast and light', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_grace', 'ptrk_girls', 'wod_grace', 12, 'Pure strength endurance - 30 clean and jerks', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_gwen', 'ptrk_girls', 'wod_gwen', 13, 'Load-based scoring - find your max unbroken weight', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_helen', 'ptrk_girls', 'wod_helen', 14, 'Running and upper body combo', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_hope', 'ptrk_girls', 'wod_hope', 15, 'Points-based scoring across 5 stations', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_isabel', 'ptrk_girls', 'wod_isabel', 16, '30 snatches - technical and demanding', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_jackie', 'ptrk_girls', 'wod_jackie', 17, 'Chipper format - row, thrusters, pull-ups', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_karen', 'ptrk_girls', 'wod_karen', 18, 'Simple but brutal - just wall balls', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_kelly', 'ptrk_girls', 'wod_kelly', 19, 'Mixed modal endurance workout', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_linda', 'ptrk_girls', 'wod_linda', 20, 'Strength ladder based on bodyweight percentages', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_lynne', 'ptrk_girls', 'wod_lynne', 21, 'Upper body strength endurance test', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_maggie', 'ptrk_girls', 'wod_maggie', 22, 'Advanced gymnastic movements', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_marguerita', 'ptrk_girls', 'wod_marguerita', 23, 'High volume mixed movements', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_mary', 'ptrk_girls', 'wod_mary', 24, 'Advanced gymnastic AMRAP', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_megan', 'ptrk_girls', 'wod_megan', 25, 'Fast couplet with skill component', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_nancy', 'ptrk_girls', 'wod_nancy', 26, 'Running with overhead squats', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('trwk_girls_nicole', 'ptrk_girls', 'wod_nicole', 27, 'Run and max pull-ups format', NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Remixed workouts for Winter Throwdown 2025 competition
-- These are copies of the benchmark workouts, owned by the organizing team
INSERT OR IGNORE INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, source_workout_id, createdAt, updatedAt, updateCounter) VALUES
-- Fran (remixed for competition)
('wod_winter_fran', 'Fran', 'For time:

21-15-9 reps
• Thrusters (95/75lb)
• Pull-ups

Target: 5 minutes', 'time', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, 'wod_fran', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Grace (remixed for competition)
('wod_winter_grace', 'Grace', 'For time:
• 30 Clean-and-Jerks (135/95lb)

Target: 8 minutes', 'time', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, 'wod_grace', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Cindy (remixed for competition)
('wod_winter_cindy', 'Cindy', 'AMRAP 20 minutes:
• 5 pull-ups
• 10 push-ups
• 15 air squats

Target: 12 rounds', 'rounds-reps', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, 'wod_cindy', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Linda (remixed for competition)
('wod_winter_linda', 'Linda', 'For time:

10-9-8-7-6-5-4-3-2-1 reps
• Deadlift (1.5 BW)
• Bench Press (BW)
• Clean (0.75 BW)

Target: 30 minutes', 'time', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, 'wod_linda', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competition Events for Winter Throwdown 2025 (4 workouts: 2 short, 1 medium, 1 long)
-- Using remixed benchmark workouts owned by the organizing team
-- trackOrder determines the event order in the competition
-- heatStatus: 'draft' (assignments hidden from athletes) or 'published' (assignments visible)
INSERT OR IGNORE INTO track_workout (id, trackId, workoutId, trackOrder, notes, pointsMultiplier, heatStatus, createdAt, updatedAt, updateCounter) VALUES
-- Event 1: Fran (short ~5 min) - Classic sprint workout
('tw_winter_event1_fran', 'track_winter_throwdown_2025', 'wod_winter_fran', 1, 'Event 1: Fran - A classic benchmark testing barbell cycling and gymnastics under fatigue. Fast and furious!', 100, 'draft', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 2: Grace (short ~8 min) - Olympic lifting under fatigue
('tw_winter_event2_grace', 'track_winter_throwdown_2025', 'wod_winter_grace', 2, 'Event 2: Grace - 30 clean and jerks for time. Test your barbell cycling and mental fortitude.', 100, 'draft', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 3: Cindy (medium 20 min) - Bodyweight AMRAP
('tw_winter_event3_cindy', 'track_winter_throwdown_2025', 'wod_winter_cindy', 3, 'Event 3: Cindy - 20 minute AMRAP of pull-ups, push-ups, and squats. Pace yourself!', 100, 'draft', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 4: Linda (long ~30 min) - Heavy barbell chipper, final event with 1.5x points
('tw_winter_event4_linda', 'track_winter_throwdown_2025', 'wod_winter_linda', 4, 'Event 4: Linda (Finals) - The ultimate test with deadlifts, bench press, and cleans. 1.5x points!', 150, 'draft', strftime('%s', 'now'), strftime('%s', 'now'), 0);

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

-- ============================================
-- ONLINE COMPETITION SEED DATA
-- For testing video submission feature (WOD-105)
-- ============================================

-- Online Competition Team (athletes become members when they register)
INSERT OR IGNORE INTO team (id, name, slug, type, description, createdAt, updatedAt, updateCounter) VALUES
('team_online_qualifier_2026', 'Online Qualifier 2026 Athletes', 'online-qualifier-2026-athletes', 'competition_event', 'Athlete team for the Online Qualifier 2026', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Scaling Group for Online Qualifier 2026 divisions
INSERT OR IGNORE INTO scaling_groups (id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter) VALUES
('sgrp_online_qualifier_2026', 'Online Qualifier 2026 Divisions', 'Divisions for Online Qualifier 2026', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 0, 0, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Divisions for Online Qualifier
INSERT OR IGNORE INTO scaling_levels (id, scalingGroupId, label, position, teamSize, createdAt, updatedAt, updateCounter) VALUES
('slvl_online_rx', 'sgrp_online_qualifier_2026', 'RX', 0, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_online_scaled', 'sgrp_online_qualifier_2026', 'Scaled', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_online_masters', 'sgrp_online_qualifier_2026', 'Masters 40+', 2, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Online Competition - competitionType = 'online'
-- Registration is open now, competition runs for 2 weeks
INSERT OR IGNORE INTO competitions (id, organizingTeamId, competitionTeamId, groupId, slug, name, description, startDate, endDate, registrationOpensAt, registrationClosesAt, timezone, settings, defaultRegistrationFeeCents, visibility, status, competitionType, createdAt, updatedAt, updateCounter) VALUES
('comp_online_qualifier_2026',
 'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
 'team_online_qualifier_2026',
 'cgrp_box1_throwdowns_2025',
 'online-qualifier-2026',
 'Online Qualifier 2026',
 'Complete the workouts on your own time and submit your video for verification. Athletes have a 7-day window to complete each event and submit their video.',
 strftime('%Y-%m-%d', 'now'),
 strftime('%Y-%m-%d', datetime('now', '+14 days')),
 strftime('%Y-%m-%d', datetime('now', '-7 days')),
 strftime('%Y-%m-%d', datetime('now', '+7 days')),
 'America/Denver',
 '{"divisions": {"scalingGroupId": "sgrp_online_qualifier_2026"}}',
 5000,
 'public',
 'published',
 'online',
 strftime('%s', 'now'),
 strftime('%s', 'now'),
 0);

-- Programming Track for Online Qualifier
INSERT OR IGNORE INTO programming_track (id, name, description, type, ownerTeamId, scalingGroupId, isPublic, competitionId, createdAt, updatedAt, updateCounter) VALUES
('track_online_qualifier_2026', 'Online Qualifier 2026 - Events', 'Competition events for Online Qualifier 2026', 'team_owned', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'sgrp_online_qualifier_2026', 0, 'comp_online_qualifier_2026', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Team memberships for online competition team (athletes need these to be registered)
INSERT OR IGNORE INTO team_membership (id, teamId, userId, roleId, isSystemRole, createdAt, updatedAt, updateCounter) VALUES
('tmem_john_online', 'team_online_qualifier_2026', 'usr_demo3member', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tmem_jane_online', 'team_online_qualifier_2026', 'usr_demo4member', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tmem_mike_online', 'team_online_qualifier_2026', 'usr_athlete_mike', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tmem_sarah_online', 'team_online_qualifier_2026', 'usr_athlete_sarah', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tmem_alex_online', 'team_online_qualifier_2026', 'usr_athlete_alex', 'member', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competition Registrations for Online Qualifier
INSERT OR IGNORE INTO competition_registrations (id, eventId, userId, teamMemberId, divisionId, registeredAt, paymentStatus, paidAt, createdAt, updatedAt, updateCounter) VALUES
-- John (demo3member) - RX Division - use this account to test video submission
('creg_john_online', 'comp_online_qualifier_2026', 'usr_demo3member', 'tmem_john_online', 'slvl_online_rx', strftime('%s', 'now'), 'PAID', strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Jane (demo4member) - Scaled Division
('creg_jane_online', 'comp_online_qualifier_2026', 'usr_demo4member', 'tmem_jane_online', 'slvl_online_scaled', strftime('%s', 'now'), 'PAID', strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Mike - RX Division
('creg_mike_online', 'comp_online_qualifier_2026', 'usr_athlete_mike', 'tmem_mike_online', 'slvl_online_rx', strftime('%s', 'now'), 'PAID', strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Sarah - RX Division
('creg_sarah_online', 'comp_online_qualifier_2026', 'usr_athlete_sarah', 'tmem_sarah_online', 'slvl_online_rx', strftime('%s', 'now'), 'PAID', strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Alex - Masters Division
('creg_alex_online', 'comp_online_qualifier_2026', 'usr_athlete_alex', 'tmem_alex_online', 'slvl_online_masters', strftime('%s', 'now'), 'PAID', strftime('%s', 'now'), strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Workouts for Online Qualifier (remixed versions owned by organizing team)
INSERT OR IGNORE INTO workouts (id, name, description, scheme, scope, team_id, rounds_to_score, time_cap, source_workout_id, createdAt, updatedAt, updateCounter) VALUES
-- Event 1: Online Fran
('wod_online_fran', 'Online Qualifier Event 1 - Fran', 'For time:

21-15-9 reps of:
• Thrusters (95/65 lb)
• Pull-ups

Time cap: 10 minutes

Movement Standards:
- Thrusters: Full depth squat, bar finishes overhead with hips and knees fully extended
- Pull-ups: Chin must break the horizontal plane of the bar', 'time-with-cap', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, 600, 'wod_fran', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 2: Online Karen
('wod_online_karen', 'Online Qualifier Event 2 - Karen', 'For time:

150 Wall Ball Shots (20/14 lb to 10/9 ft)

Time cap: 15 minutes

Movement Standards:
- Wall Ball: Hip crease must pass below knee at bottom
- Ball must hit target at or above required height', 'time-with-cap', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, 900, 'wod_karen', strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 3: Online AMRAP
('wod_online_amrap', 'Online Qualifier Event 3 - Chipper AMRAP', 'AMRAP 12 minutes:

5 Deadlifts (225/155 lb)
10 Box Jump Overs (24/20 in)
15 Toes-to-Bar

Movement Standards:
- Deadlifts: Full hip and knee extension at top
- Box Jump Overs: Two-foot takeoff, both feet must touch top of box
- Toes-to-Bar: Both feet must touch the bar simultaneously', 'rounds-reps', 'private', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 1, NULL, NULL, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Track Workouts (Competition Events) for Online Qualifier
-- eventStatus: 'published' makes them visible to athletes
INSERT OR IGNORE INTO track_workout (id, trackId, workoutId, trackOrder, notes, pointsMultiplier, heatStatus, eventStatus, createdAt, updatedAt, updateCounter) VALUES
('tw_online_event1', 'track_online_qualifier_2026', 'wod_online_fran', 1, 'Event 1: Complete Fran and submit your video within the submission window.', 100, 'draft', 'published', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tw_online_event2', 'track_online_qualifier_2026', 'wod_online_karen', 2, 'Event 2: Complete Karen and submit your video within the submission window.', 100, 'draft', 'published', strftime('%s', 'now'), strftime('%s', 'now'), 0),
('tw_online_event3', 'track_online_qualifier_2026', 'wod_online_amrap', 3, 'Event 3: Complete the AMRAP and submit your video within the submission window.', 150, 'draft', 'published', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Competition Events (Submission Windows) for Online Qualifier
-- Event 1: Open now for 7 days
-- Event 2: Opens in 3 days, closes in 10 days
-- Event 3: Opens in 7 days, closes in 14 days
INSERT OR IGNORE INTO competition_events (id, competitionId, trackWorkoutId, submissionOpensAt, submissionClosesAt, createdAt, updatedAt, updateCounter) VALUES
-- Event 1: Submission window is OPEN NOW (for testing)
('cevt_online_event1', 'comp_online_qualifier_2026', 'tw_online_event1',
 datetime('now', '-1 day'),
 datetime('now', '+6 days'),
 strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 2: Opens in 3 days (for testing "window not open yet")
('cevt_online_event2', 'comp_online_qualifier_2026', 'tw_online_event2',
 datetime('now', '+3 days'),
 datetime('now', '+10 days'),
 strftime('%s', 'now'), strftime('%s', 'now'), 0),
-- Event 3: Opens in 7 days
('cevt_online_event3', 'comp_online_qualifier_2026', 'tw_online_event3',
 datetime('now', '+7 days'),
 datetime('now', '+14 days'),
 strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================
-- END ONLINE COMPETITION SEED DATA
-- 
-- To test video submission:
-- 1. Log in as john@example.com (demo user, registered for online comp)
-- 2. Go to /compete/online-qualifier-2026/workouts/tw_online_event1
-- 3. You should see the Video Submission card in the sidebar
-- 4. Event 1 submission window is open - you can submit
-- 5. Event 2 window not open yet - shows when it opens
-- 6. Event 3 window not open yet - shows when it opens
--
-- To test "not registered" scenario:
-- 1. Log in as admin@example.com (not registered)
-- 2. Go to same URL - should see "Registration Required"
-- ============================================
