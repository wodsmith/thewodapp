-- PR Environment Seed Data
-- This file seeds minimal demo data for PR preview environments.
-- Used by scripts/seed-pr.ts to populate PR-specific D1 databases.
--
-- Test User Credentials:
--   Email: admin@example.com
--   Password: password123
--
-- Note: This assumes migrations have already been applied to the PR database.
-- The PR database is created fresh, so no cleanup is needed.

-- ============================================================================
-- GLOBAL DEFAULTS (Required for app to function)
-- ============================================================================

-- Seed global default scaling group (system-wide default)
INSERT OR IGNORE INTO scaling_groups (id, title, description, teamId, isDefault, isSystem, createdAt, updatedAt, updateCounter) VALUES
('sgrp_global_default', 'Standard Scaling', 'Default Rx+, Rx, and Scaled levels for backward compatibility', NULL, 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- Seed global default scaling levels
INSERT OR IGNORE INTO scaling_levels (id, scalingGroupId, label, position, teamSize, createdAt, updatedAt, updateCounter) VALUES
('slvl_global_rxplus', 'sgrp_global_default', 'Rx+', 0, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_global_rx', 'sgrp_global_default', 'Rx', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
('slvl_global_scaled', 'sgrp_global_default', 'Scaled', 2, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================================================
-- ENTITLEMENT TYPES, FEATURES, LIMITS, AND PLANS
-- ============================================================================

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
  ('feat_host_competitions', 'host_competitions', 'Host Competitions', 'Create and manage competitions and events', 'team', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert limits
INSERT OR IGNORE INTO "limit" (id, "key", name, description, unit, resetPeriod, isActive, createdAt, updatedAt, updateCounter)
VALUES
  ('lmt_max_members_per_team', 'max_members_per_team', 'Team Members', 'Maximum members per team', 'members', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_max_admins', 'max_admins', 'Admins', 'Number of admin users per team', 'admins', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_max_programming_tracks', 'max_programming_tracks', 'Programming Tracks', 'Number of programming tracks per team', 'tracks', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_ai_messages_per_month', 'ai_messages_per_month', 'AI Messages', 'AI-powered messages per month', 'messages', 'monthly', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('lmt_max_published_competitions', 'max_published_competitions', 'Published Competitions', 'Maximum public competitions (0: pending approval, -1: unlimited)', 'competitions', 'never', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert plans (Free, Pro, Enterprise)
INSERT OR IGNORE INTO plan (id, name, description, price, interval, isActive, isPublic, sortOrder, entitlements, createdAt, updatedAt, updateCounter)
VALUES 
  ('free', 'Free', 'Perfect for getting started with basic workout management', 0, NULL, 1, 1, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('pro', 'Pro', 'Advanced features for growing gyms and coaches', 2900, 'month', 1, 1, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('enterprise', 'Enterprise', 'Everything you need for large organizations', 9900, 'month', 1, 1, 2, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Link features to plans
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

-- Link limits to plans
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

-- ============================================================================
-- ADMIN USER
-- ============================================================================
-- Password hash generated with PBKDF2 (100k iterations, SHA-256)
-- Salt: "adminsalt0000000" (16 bytes)
-- Password: password123
INSERT OR IGNORE INTO user (
    id,
    firstName,
    lastName,
    email,
    passwordHash,
    role,
    emailVerified,
    currentCredits,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'usr_pr_demo_user',
    'Admin',
    'User',
    'admin@example.com',
    '5a0db2ee7cd6c0130790e5a84c4607b6:486e247bc7843f2834182cbac3e05dff4aaa0af62d5d864644fb065b2debe2e8',
    'user',
    strftime('%s', 'now'),
    100,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- PERSONAL TEAM (Required for each user)
-- ============================================================================
INSERT OR IGNORE INTO team (
    id,
    name,
    slug,
    description,
    isPersonalTeam,
    personalTeamOwnerId,
    creditBalance,
    currentPlanId,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'team_pr_personal_demo',
    'Demo''s Team (personal)',
    'demo-mo_user',
    'Personal team for individual programming track subscriptions',
    1,
    'usr_pr_demo_user',
    0,
    'free',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- DEMO GYM TEAM
-- ============================================================================
INSERT OR IGNORE INTO team (
    id,
    name,
    slug,
    description,
    type,
    creditBalance,
    currentPlanId,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'team_pr_demo_gym',
    'PR Demo Gym',
    'pr-demo-gym',
    'A demo gym for PR preview testing',
    'gym',
    500,
    'pro',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEAM MEMBERSHIPS
-- ============================================================================
-- Demo user is owner of their personal team
INSERT OR IGNORE INTO team_membership (
    id,
    teamId,
    userId,
    roleId,
    isSystemRole,
    isActive,
    joinedAt,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'tmem_pr_personal_demo',
    'team_pr_personal_demo',
    'usr_pr_demo_user',
    'owner',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Demo user is owner of demo gym team
INSERT OR IGNORE INTO team_membership (
    id,
    teamId,
    userId,
    roleId,
    isSystemRole,
    isActive,
    joinedAt,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'tmem_pr_gym_owner',
    'team_pr_demo_gym',
    'usr_pr_demo_user',
    'owner',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEAM SUBSCRIPTIONS
-- ============================================================================
INSERT OR IGNORE INTO team_subscription (
    id,
    teamId,
    planId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'tsub_pr_demo_gym',
    'team_pr_demo_gym',
    'pro',
    'active',
    strftime('%s', 'now'),
    strftime('%s', 'now', '+1 year'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- DEMO WORKOUTS
-- ============================================================================
-- Classic CrossFit workout: Fran (time-based)
INSERT OR IGNORE INTO workouts (
    id,
    team_id,
    name,
    description,
    scheme,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'wkt_pr_fran',
    'team_pr_personal_demo',
    'Fran',
    '21-15-9 Thrusters (95/65 lb) and Pull-ups',
    'time',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- AMRAP workout: Cindy (rounds-reps)
INSERT OR IGNORE INTO workouts (
    id,
    team_id,
    name,
    description,
    scheme,
    time_cap,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'wkt_pr_cindy',
    'team_pr_personal_demo',
    'Cindy',
    '5 Pull-ups, 10 Push-ups, 15 Squats - AMRAP 20 minutes',
    'rounds-reps',
    1200,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Grace workout (time-based)
INSERT OR IGNORE INTO workouts (
    id,
    team_id,
    name,
    description,
    scheme,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'wkt_pr_grace',
    'team_pr_personal_demo',
    'Grace',
    '30 Clean and Jerks (135/95 lb) for time',
    'time',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEAM FEATURE ENTITLEMENTS
-- ============================================================================
INSERT OR IGNORE INTO team_feature_entitlement (id, teamId, featureId, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tfe_pr_gym_basic', 'team_pr_demo_gym', 'feat_basic_workouts', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pr_gym_tracks', 'team_pr_demo_gym', 'feat_programming_tracks', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pr_gym_calendar', 'team_pr_demo_gym', 'feat_program_calendar', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tfe_pr_gym_scaling', 'team_pr_demo_gym', 'feat_custom_scaling_groups', 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- ============================================================================
-- TEAM LIMIT ENTITLEMENTS
-- ============================================================================
INSERT OR IGNORE INTO team_limit_entitlement (id, teamId, limitId, value, source, sourcePlanId, createdAt, updatedAt, updateCounter) VALUES
('tle_pr_gym_members', 'team_pr_demo_gym', 'lmt_max_members_per_team', 25, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pr_gym_tracks', 'team_pr_demo_gym', 'lmt_max_programming_tracks', -1, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pr_gym_ai', 'team_pr_demo_gym', 'lmt_ai_messages_per_month', 200, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
('tle_pr_gym_admins', 'team_pr_demo_gym', 'lmt_max_admins', 5, 'plan', 'pro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
