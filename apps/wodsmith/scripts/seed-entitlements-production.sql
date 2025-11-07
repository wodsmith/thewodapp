-- Production Seed Script for Entitlements System
-- This script is safe to run multiple times (uses INSERT OR IGNORE)
-- Run with: pnpm db:seed:entitlements:prod

-- ============================================================================
-- 1. ENTITLEMENT TYPES
-- ============================================================================

INSERT OR IGNORE INTO entitlement_type (id, name, description, createdAt, updatedAt, updateCounter)
VALUES
  ('ent_type_' || lower(hex(randomblob(16))), 'programming_track_access', 'Access to individual programming tracks via purchase', strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('ent_type_' || lower(hex(randomblob(16))), 'ai_message_credits', 'AI message credits for workout generation and suggestions', strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('ent_type_' || lower(hex(randomblob(16))), 'feature_trial', 'Time-limited trial access to premium features', strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('ent_type_' || lower(hex(randomblob(16))), 'manual_feature_grant', 'Manual feature grants by administrators', strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('ent_type_' || lower(hex(randomblob(16))), 'subscription_seat', 'Subscription seat tracking for team plans', strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('ent_type_' || lower(hex(randomblob(16))), 'addon_access', 'Access via purchased add-ons', strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================================================
-- 2. FEATURES
-- ============================================================================

INSERT OR IGNORE INTO feature (id, key, name, description, category, isActive, createdAt, updatedAt, updateCounter)
VALUES
  ('feat_' || lower(hex(randomblob(16))), 'basic_workouts', 'Basic Workouts', 'Create and manage basic workout templates', 'workouts', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'programming_tracks', 'Programming Tracks', 'Create and manage unlimited programming tracks', 'programming', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'program_calendar', 'Program Calendar', 'Visual calendar for programming schedules', 'programming', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'program_analytics', 'Program Analytics', 'Advanced analytics for programming effectiveness', 'programming', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'custom_scaling_groups', 'Custom Scaling Groups', 'Create custom scaling groups for your gym', 'scaling', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'ai_workout_generation', 'AI Workout Generation', 'Generate workouts using AI', 'ai', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'ai_programming_assistant', 'AI Programming Assistant', 'AI assistant for programming strategy', 'ai', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('feat_' || lower(hex(randomblob(16))), 'multi_team_management', 'Multi-Team Management', 'Manage multiple teams from one account', 'team', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================================================
-- 3. LIMITS
-- ============================================================================

INSERT OR IGNORE INTO "limit" (id, key, name, description, unit, resetPeriod, isActive, createdAt, updatedAt, updateCounter)
VALUES
  ('limit_' || lower(hex(randomblob(16))), 'max_teams', 'Teams', 'Number of teams you can create (excluding personal team)', 'teams', 'never', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('limit_' || lower(hex(randomblob(16))), 'max_members_per_team', 'Team Members', 'Maximum members per team', 'members', 'never', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('limit_' || lower(hex(randomblob(16))), 'max_admins', 'Admins', 'Number of admin users per team', 'admins', 'never', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('limit_' || lower(hex(randomblob(16))), 'max_programming_tracks', 'Programming Tracks', 'Number of programming tracks per team', 'tracks', 'never', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('limit_' || lower(hex(randomblob(16))), 'ai_messages_per_month', 'AI Messages', 'AI-powered messages per month', 'messages', 'monthly', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('limit_' || lower(hex(randomblob(16))), 'max_file_storage_mb', 'File Storage', 'Total file storage space', 'MB', 'never', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('limit_' || lower(hex(randomblob(16))), 'max_video_storage_mb', 'Video Storage', 'Total video storage space', 'MB', 'never', 1, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================================================
-- 4. PLANS
-- ============================================================================

INSERT OR IGNORE INTO plan (id, name, description, price, interval, isActive, isPublic, sortOrder, createdAt, updatedAt, updateCounter)
VALUES
  ('free', 'Free', 'Perfect for getting started with basic workout management', 0, NULL, 1, 1, 0, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('pro', 'Pro', 'Advanced features for growing gyms and coaches', 2900, 'month', 1, 1, 1, strftime('%s', 'now'), strftime('%s', 'now'), 0),
  ('enterprise', 'Enterprise', 'Everything you need for large organizations', 9900, 'month', 1, 1, 2, strftime('%s', 'now'), strftime('%s', 'now'), 0);

-- ============================================================================
-- 5. PLAN FEATURES (Junction Table)
-- ============================================================================

-- Free Plan Features
INSERT OR IGNORE INTO plan_feature (id, planId, featureId, createdAt, updatedAt, updateCounter)
SELECT
  'plan_feat_' || lower(hex(randomblob(16))),
  'free',
  id,
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
FROM feature
WHERE key IN ('basic_workouts');

-- Pro Plan Features
INSERT OR IGNORE INTO plan_feature (id, planId, featureId, createdAt, updatedAt, updateCounter)
SELECT
  'plan_feat_' || lower(hex(randomblob(16))),
  'pro',
  id,
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
FROM feature
WHERE key IN ('basic_workouts', 'programming_tracks', 'program_calendar', 'custom_scaling_groups', 'ai_workout_generation', 'multi_team_management');

-- Enterprise Plan Features
INSERT OR IGNORE INTO plan_feature (id, planId, featureId, createdAt, updatedAt, updateCounter)
SELECT
  'plan_feat_' || lower(hex(randomblob(16))),
  'enterprise',
  id,
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
FROM feature
WHERE key IN ('basic_workouts', 'programming_tracks', 'program_calendar', 'program_analytics', 'custom_scaling_groups', 'ai_workout_generation', 'ai_programming_assistant', 'multi_team_management');

-- ============================================================================
-- 6. PLAN LIMITS (Junction Table)
-- ============================================================================

-- Free Plan Limits
INSERT OR IGNORE INTO plan_limit (id, planId, limitId, value, createdAt, updatedAt, updateCounter)
SELECT
  'plan_limit_' || lower(hex(randomblob(16))),
  'free',
  l.id,
  CASE l.key
    WHEN 'max_teams' THEN 1
    WHEN 'max_members_per_team' THEN 5
    WHEN 'max_programming_tracks' THEN 5
    WHEN 'ai_messages_per_month' THEN 10
    WHEN 'max_admins' THEN 2
    WHEN 'max_file_storage_mb' THEN 100
    WHEN 'max_video_storage_mb' THEN 0
  END,
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
FROM "limit" l
WHERE l.key IN ('max_teams', 'max_members_per_team', 'max_programming_tracks', 'ai_messages_per_month', 'max_admins', 'max_file_storage_mb', 'max_video_storage_mb');

-- Pro Plan Limits
INSERT OR IGNORE INTO plan_limit (id, planId, limitId, value, createdAt, updatedAt, updateCounter)
SELECT
  'plan_limit_' || lower(hex(randomblob(16))),
  'pro',
  l.id,
  CASE l.key
    WHEN 'max_teams' THEN -1
    WHEN 'max_members_per_team' THEN 25
    WHEN 'max_programming_tracks' THEN -1
    WHEN 'ai_messages_per_month' THEN 200
    WHEN 'max_admins' THEN 5
    WHEN 'max_file_storage_mb' THEN 1000
    WHEN 'max_video_storage_mb' THEN 500
  END,
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
FROM "limit" l
WHERE l.key IN ('max_teams', 'max_members_per_team', 'max_programming_tracks', 'ai_messages_per_month', 'max_admins', 'max_file_storage_mb', 'max_video_storage_mb');

-- Enterprise Plan Limits
INSERT OR IGNORE INTO plan_limit (id, planId, limitId, value, createdAt, updatedAt, updateCounter)
SELECT
  'plan_limit_' || lower(hex(randomblob(16))),
  'enterprise',
  l.id,
  CASE l.key
    WHEN 'max_teams' THEN -1
    WHEN 'max_members_per_team' THEN -1
    WHEN 'max_programming_tracks' THEN -1
    WHEN 'ai_messages_per_month' THEN -1
    WHEN 'max_admins' THEN -1
    WHEN 'max_file_storage_mb' THEN 10000
    WHEN 'max_video_storage_mb' THEN 5000
  END,
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
FROM "limit" l
WHERE l.key IN ('max_teams', 'max_members_per_team', 'max_programming_tracks', 'ai_messages_per_month', 'max_admins', 'max_file_storage_mb', 'max_video_storage_mb');

-- ============================================================================
-- 7. UPDATE EXISTING TEAMS TO HAVE FREE PLAN
-- ============================================================================

-- Set all teams without a plan to have the free plan
UPDATE team
SET currentPlanId = 'free', updatedAt = strftime('%s', 'now')
WHERE currentPlanId IS NULL OR currentPlanId = '';

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Entitlements seeded successfully!' as status;
