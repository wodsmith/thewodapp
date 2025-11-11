-- Seed script for entitlement types and plans
-- Run with: pnpm wrangler d1 execute DB_NAME --file=scripts/seed-entitlements.sql --local

-- Insert entitlement types
INSERT OR IGNORE INTO entitlement_type (id, name, description, createdAt, updatedAt, updateCounter)
VALUES
  ('etype_programming_track', 'programming_track_access', 'Access to individual programming tracks via purchase', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_ai_messages', 'ai_message_credits', 'AI message credits for workout generation and suggestions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_feature_trial', 'feature_trial', 'Time-limited trial access to premium features', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_manual_grant', 'manual_feature_grant', 'Manual feature grants by administrators', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_subscription_seat', 'subscription_seat', 'Subscription seat tracking for team plans', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('etype_addon_access', 'addon_access', 'Access via purchased add-ons', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- Insert plans
-- Free Plan
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
  '{"features":["basic_workouts","programming_tracks","basic_scaling","team_collaboration","basic_analytics"],"limits":{"max_members_per_team":5,"max_programming_tracks":2,"ai_messages_per_month":10,"max_admins":2}}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);

-- Pro Plan
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
  '{"features":["basic_workouts","advanced_workouts","workout_library","programming_tracks","program_calendar","basic_scaling","advanced_scaling","ai_workout_generation","ai_workout_suggestions","multi_team_management","team_collaboration","basic_analytics"],"limits":{"max_members_per_team":25,"max_programming_tracks":-1,"ai_messages_per_month":200,"max_admins":5}}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);

-- Enterprise Plan
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
  '{"features":["basic_workouts","advanced_workouts","workout_library","programming_tracks","program_calendar","program_analytics","basic_scaling","advanced_scaling","custom_scaling_groups","ai_workout_generation","ai_workout_suggestions","ai_programming_assistant","multi_team_management","team_collaboration","custom_branding","api_access","basic_analytics","advanced_analytics","custom_reports"],"limits":{"max_members_per_team":-1,"max_programming_tracks":-1,"ai_messages_per_month":-1,"max_admins":-1}}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  0
);
