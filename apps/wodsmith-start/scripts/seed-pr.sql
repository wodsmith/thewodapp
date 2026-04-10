-- PR Environment Seed Data (MySQL / PlanetScale)
-- Seeds minimal demo data for PR preview environments.
--
-- Test User Credentials:
--   Email: admin@example.com
--   Password: password123
--
-- Note: This assumes migrations have already been applied to the PR database.
-- Cleanup runs first to ensure idempotent re-seeding on subsequent pushes.

-- ============================================================================
-- CLEANUP (delete in reverse FK order for idempotent re-seeding)
-- ============================================================================

-- Event-division mappings
DELETE FROM event_division_mappings;
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
DELETE FROM scheduled_workout_instances;
DELETE FROM team_programming_tracks;
DELETE FROM track_workouts;
DELETE FROM programming_tracks;
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
DELETE FROM class_catalogs;
DELETE FROM skills;
DELETE FROM locations;
-- Sponsors
DELETE FROM sponsors;
DELETE FROM sponsor_groups;
-- Commerce
DELETE FROM purchased_items;
DELETE FROM credit_transactions;
DELETE FROM commerce_purchases;
DELETE FROM commerce_products;
-- Auth
DELETE FROM passkey_credentials;
DELETE FROM waiver_signatures;
DELETE FROM waivers;
-- Team hierarchy (children before parents)
DELETE FROM affiliates;
DELETE FROM organizer_requests;
DELETE FROM team_invitations;
DELETE FROM team_memberships;
DELETE FROM team_roles;
DELETE FROM team_entitlement_overrides;
DELETE FROM team_feature_entitlements;
DELETE FROM team_limit_entitlements;
DELETE FROM team_usages;
DELETE FROM team_addons;
DELETE FROM team_subscriptions;
DELETE FROM entitlements;
-- Plans and features (before team due to currentPlanId FK)
DELETE FROM plan_limits;
DELETE FROM plan_features;
DELETE FROM plans;
DELETE FROM `limits`;
DELETE FROM features;
DELETE FROM entitlement_types;
-- Core entities
DELETE FROM teams;
DELETE FROM users;

-- ============================================================================
-- GLOBAL DEFAULTS (Required for app to function)
-- ============================================================================

INSERT IGNORE INTO scaling_groups (id, title, description, team_id, is_default, is_system, created_at, updated_at, update_counter) VALUES
('sgrp_global_default', 'Standard Scaling', 'Default Rx+, Rx, and Scaled levels for backward compatibility', NULL, 1, 1, NOW(), NOW(), 0);

INSERT IGNORE INTO scaling_levels (id, scaling_group_id, label, position, team_size, created_at, updated_at, update_counter) VALUES
('slvl_global_rxplus', 'sgrp_global_default', 'Rx+', 0, 1, NOW(), NOW(), 0),
('slvl_global_rx', 'sgrp_global_default', 'Rx', 1, 1, NOW(), NOW(), 0),
('slvl_global_scaled', 'sgrp_global_default', 'Scaled', 2, 1, NOW(), NOW(), 0);

-- ============================================================================
-- ENTITLEMENT TYPES, FEATURES, LIMITS, AND PLANS
-- ============================================================================

INSERT IGNORE INTO entitlement_types (id, name, description, created_at, updated_at, update_counter) VALUES
('etype_programming_track', 'programming_track_access', 'Access to individual programming tracks via purchase', NOW(), NOW(), 0),
('etype_ai_messages', 'ai_message_credits', 'AI message credits for workout generation and suggestions', NOW(), NOW(), 0),
('etype_feature_trial', 'feature_trial', 'Time-limited trial access to premium features', NOW(), NOW(), 0),
('etype_manual_grant', 'manual_feature_grant', 'Manual feature grants by administrators', NOW(), NOW(), 0),
('etype_subscription_seat', 'subscription_seat', 'Subscription seat tracking for team plans', NOW(), NOW(), 0),
('etype_addon_access', 'addon_access', 'Access via purchased add-ons', NOW(), NOW(), 0);

INSERT IGNORE INTO features (id, `key`, name, description, category, is_active, created_at, updated_at, update_counter) VALUES
('feat_basic_workouts', 'basic_workouts', 'Basic Workouts', 'Create and manage basic workout templates', 'workouts', 1, NOW(), NOW(), 0),
('feat_programming_tracks', 'programming_tracks', 'Programming Tracks', 'Create and manage unlimited programming tracks', 'programming', 1, NOW(), NOW(), 0),
('feat_program_calendar', 'program_calendar', 'Program Calendar', 'Visual calendar for programming schedules', 'programming', 1, NOW(), NOW(), 0),
('feat_program_analytics', 'program_analytics', 'Program Analytics', 'Advanced analytics for programming effectiveness', 'programming', 1, NOW(), NOW(), 0),
('feat_custom_scaling_groups', 'custom_scaling_groups', 'Custom Scaling Groups', 'Create custom scaling groups for your gym', 'scaling', 1, NOW(), NOW(), 0),
('feat_ai_workout_generation', 'ai_workout_generation', 'AI Workout Generation', 'Generate workouts using AI', 'ai', 1, NOW(), NOW(), 0),
('feat_ai_programming_assistant', 'ai_programming_assistant', 'AI Programming Assistant', 'AI assistant for programming strategy', 'ai', 1, NOW(), NOW(), 0),
('feat_multi_team_management', 'multi_team_management', 'Multi-Team Management', 'Manage multiple teams from one account', 'team', 1, NOW(), NOW(), 0),
('feat_host_competitions', 'host_competitions', 'Host Competitions', 'Create and manage competitions and events', 'team', 1, NOW(), NOW(), 0),
('feat_workout_tracking', 'workout_tracking', 'Workout Tracking', 'Access to personal workout tracking features', 'workouts', 1, NOW(), NOW(), 0);

INSERT IGNORE INTO `limits` (id, `key`, name, description, unit, reset_period, is_active, created_at, updated_at, update_counter) VALUES
('lmt_max_members_per_team', 'max_members_per_team', 'Team Members', 'Maximum members per team', 'members', 'never', 1, NOW(), NOW(), 0),
('lmt_max_admins', 'max_admins', 'Admins', 'Number of admin users per team', 'admins', 'never', 1, NOW(), NOW(), 0),
('lmt_max_programming_tracks', 'max_programming_tracks', 'Programming Tracks', 'Number of programming tracks per team', 'tracks', 'never', 1, NOW(), NOW(), 0),
('lmt_ai_messages_per_month', 'ai_messages_per_month', 'AI Messages', 'AI-powered messages per month', 'messages', 'monthly', 1, NOW(), NOW(), 0),
('lmt_max_published_competitions', 'max_published_competitions', 'Published Competitions', 'Maximum public competitions (0: pending approval, -1: unlimited)', 'competitions', 'never', 1, NOW(), NOW(), 0);

INSERT IGNORE INTO plans (id, name, description, price, `interval`, is_active, is_public, sort_order, entitlements, created_at, updated_at, update_counter) VALUES
('free', 'Free', 'Perfect for getting started with basic workout management', 0, NULL, 1, 1, 0, NULL, NOW(), NOW(), 0),
('pro', 'Pro', 'Advanced features for growing gyms and coaches', 2900, 'month', 1, 1, 1, NULL, NOW(), NOW(), 0),
('enterprise', 'Enterprise', 'Everything you need for large organizations', 9900, 'month', 1, 1, 2, NULL, NOW(), NOW(), 0);

-- Plan features
INSERT IGNORE INTO plan_features (id, plan_id, feature_id, created_at, updated_at, update_counter) VALUES
('pf_free_basic_workouts', 'free', 'feat_basic_workouts', NOW(), NOW(), 0),
('pf_free_programming_tracks', 'free', 'feat_programming_tracks', NOW(), NOW(), 0),
('pf_pro_basic_workouts', 'pro', 'feat_basic_workouts', NOW(), NOW(), 0),
('pf_pro_programming_tracks', 'pro', 'feat_programming_tracks', NOW(), NOW(), 0),
('pf_pro_program_calendar', 'pro', 'feat_program_calendar', NOW(), NOW(), 0),
('pf_pro_custom_scaling_groups', 'pro', 'feat_custom_scaling_groups', NOW(), NOW(), 0),
('pf_pro_ai_workout_generation', 'pro', 'feat_ai_workout_generation', NOW(), NOW(), 0),
('pf_pro_multi_team_management', 'pro', 'feat_multi_team_management', NOW(), NOW(), 0);

-- Plan limits
INSERT IGNORE INTO plan_limits (id, plan_id, limit_id, value, created_at, updated_at, update_counter) VALUES
('pl_free_max_members', 'free', 'lmt_max_members_per_team', 5, NOW(), NOW(), 0),
('pl_free_max_tracks', 'free', 'lmt_max_programming_tracks', 2, NOW(), NOW(), 0),
('pl_free_ai_messages', 'free', 'lmt_ai_messages_per_month', 10, NOW(), NOW(), 0),
('pl_free_max_admins', 'free', 'lmt_max_admins', 2, NOW(), NOW(), 0),
('pl_pro_max_members', 'pro', 'lmt_max_members_per_team', 25, NOW(), NOW(), 0),
('pl_pro_max_tracks', 'pro', 'lmt_max_programming_tracks', -1, NOW(), NOW(), 0),
('pl_pro_ai_messages', 'pro', 'lmt_ai_messages_per_month', 200, NOW(), NOW(), 0),
('pl_pro_max_admins', 'pro', 'lmt_max_admins', 5, NOW(), NOW(), 0);

-- ============================================================================
-- ADMIN USER
-- ============================================================================
-- Password hash generated with PBKDF2 (100k iterations, SHA-256)
-- Salt: "adminsalt0000000" (16 bytes)
-- Password: password123
INSERT IGNORE INTO users (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter) VALUES
('usr_pr_demo_user', 'Admin', 'User', 'admin@example.com', '5a0db2ee7cd6c0130790e5a84c4607b6:486e247bc7843f2834182cbac3e05dff4aaa0af62d5d864644fb065b2debe2e8', 'user', NOW(), 100, NOW(), NOW(), 0);

-- ============================================================================
-- PERSONAL TEAM (Required for each user)
-- ============================================================================
INSERT IGNORE INTO teams (id, name, slug, description, is_personal_team, personal_team_owner_id, credit_balance, current_plan_id, created_at, updated_at, update_counter) VALUES
('team_pr_personal_demo', 'Demo''s Team (personal)', 'demo-mo_user', 'Personal team for individual programming track subscriptions', 1, 'usr_pr_demo_user', 0, 'free', NOW(), NOW(), 0);

-- ============================================================================
-- DEMO GYM TEAM
-- ============================================================================
INSERT IGNORE INTO teams (id, name, slug, description, type, credit_balance, current_plan_id, created_at, updated_at, update_counter) VALUES
('team_pr_demo_gym', 'PR Demo Gym', 'pr-demo-gym', 'A demo gym for PR preview testing', 'gym', 500, 'pro', NOW(), NOW(), 0);

-- ============================================================================
-- TEAM MEMBERSHIPS
-- ============================================================================
INSERT IGNORE INTO team_memberships (id, team_id, user_id, role_id, is_system_role, is_active, joined_at, created_at, updated_at, update_counter) VALUES
('tmem_pr_personal_demo', 'team_pr_personal_demo', 'usr_pr_demo_user', 'owner', 1, 1, NOW(), NOW(), NOW(), 0),
('tmem_pr_gym_owner', 'team_pr_demo_gym', 'usr_pr_demo_user', 'owner', 1, 1, NOW(), NOW(), NOW(), 0);

-- ============================================================================
-- TEAM SUBSCRIPTIONS
-- ============================================================================
INSERT IGNORE INTO team_subscriptions (id, team_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at, update_counter) VALUES
('tsub_pr_demo_gym', 'team_pr_demo_gym', 'pro', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), NOW(), NOW(), 0);

-- ============================================================================
-- DEMO WORKOUTS
-- ============================================================================
INSERT IGNORE INTO workouts (id, team_id, name, description, scheme, created_at, updated_at, update_counter) VALUES
('wkt_pr_fran', 'team_pr_personal_demo', 'Fran', '21-15-9 Thrusters (95/65 lb) and Pull-ups', 'time', NOW(), NOW(), 0),
('wkt_pr_cindy', 'team_pr_personal_demo', 'Cindy', '5 Pull-ups, 10 Push-ups, 15 Squats - AMRAP 20 minutes', 'rounds-reps', NOW(), NOW(), 0),
('wkt_pr_grace', 'team_pr_personal_demo', 'Grace', '30 Clean and Jerks (135/95 lb) for time', 'time', NOW(), NOW(), 0);

-- ============================================================================
-- TEAM FEATURE ENTITLEMENTS
-- ============================================================================
INSERT IGNORE INTO team_feature_entitlements (id, team_id, feature_id, source, source_plan_id, created_at, updated_at, update_counter) VALUES
('tfe_pr_gym_basic', 'team_pr_demo_gym', 'feat_basic_workouts', 'plan', 'pro', NOW(), NOW(), 0),
('tfe_pr_gym_tracks', 'team_pr_demo_gym', 'feat_programming_tracks', 'plan', 'pro', NOW(), NOW(), 0),
('tfe_pr_gym_calendar', 'team_pr_demo_gym', 'feat_program_calendar', 'plan', 'pro', NOW(), NOW(), 0),
('tfe_pr_gym_scaling', 'team_pr_demo_gym', 'feat_custom_scaling_groups', 'plan', 'pro', NOW(), NOW(), 0),
('tfe_pr_gym_host', 'team_pr_demo_gym', 'feat_host_competitions', 'plan', 'pro', NOW(), NOW(), 0);

-- ============================================================================
-- TEAM LIMIT ENTITLEMENTS
-- ============================================================================
INSERT IGNORE INTO team_limit_entitlements (id, team_id, limit_id, value, source, source_plan_id, created_at, updated_at, update_counter) VALUES
('tle_pr_gym_members', 'team_pr_demo_gym', 'lmt_max_members_per_team', 25, 'plan', 'pro', NOW(), NOW(), 0),
('tle_pr_gym_tracks', 'team_pr_demo_gym', 'lmt_max_programming_tracks', -1, 'plan', 'pro', NOW(), NOW(), 0),
('tle_pr_gym_ai', 'team_pr_demo_gym', 'lmt_ai_messages_per_month', 200, 'plan', 'pro', NOW(), NOW(), 0),
('tle_pr_gym_admins', 'team_pr_demo_gym', 'lmt_max_admins', 5, 'plan', 'pro', NOW(), NOW(), 0);

-- ============================================================================
-- TEAM ENTITLEMENT OVERRIDES
-- ============================================================================
INSERT IGNORE INTO team_entitlement_overrides (id, team_id, type, `key`, value, reason, expires_at, created_by, created_at, updated_at, update_counter) VALUES
('teo_pr_gym_workout_tracking', 'team_pr_demo_gym', 'feature', 'workout_tracking', 'true', 'Early access grant', NULL, 'usr_pr_demo_user', NOW(), NOW(), 0),
('teo_pr_personal_workout_tracking', 'team_pr_personal_demo', 'feature', 'workout_tracking', 'true', 'Early access grant', NULL, 'usr_pr_demo_user', NOW(), NOW(), 0);

-- ============================================================================
-- ORGANIZER REQUEST (required to access organizer dashboard)
-- ============================================================================
INSERT IGNORE INTO organizer_requests (id, team_id, user_id, reason, status, created_at, updated_at, update_counter) VALUES
('oreq_pr_demo_gym', 'team_pr_demo_gym', 'usr_pr_demo_user', 'Demo organizer', 'approved', NOW(), NOW(), 0);

-- ============================================================================
-- ONLINE COMPETITION
-- ============================================================================

-- Competition team
INSERT IGNORE INTO teams (id, name, slug, description, type, credit_balance, current_plan_id, created_at, updated_at, update_counter) VALUES
('team_pr_comp_online', 'Online Throwdown Team', 'online-throwdown-team', 'Competition team for Online Throwdown', 'competition', 0, NULL, NOW(), NOW(), 0);

-- Competition scaling group (divisions)
INSERT IGNORE INTO scaling_groups (id, title, description, team_id, is_default, is_system, created_at, updated_at, update_counter) VALUES
('sgrp_pr_online_comp', 'Online Throwdown Divisions', 'Divisions for the Online Throwdown', 'team_pr_demo_gym', 0, 0, NOW(), NOW(), 0);

-- Divisions
INSERT IGNORE INTO scaling_levels (id, scaling_group_id, label, position, team_size, created_at, updated_at, update_counter) VALUES
('div_pr_rxplus', 'sgrp_pr_online_comp', 'Rx+', 0, 1, NOW(), NOW(), 0),
('div_pr_rx', 'sgrp_pr_online_comp', 'Rx', 1, 1, NOW(), NOW(), 0),
('div_pr_scaled', 'sgrp_pr_online_comp', 'Scaled', 2, 1, NOW(), NOW(), 0),
('div_pr_partners', 'sgrp_pr_online_comp', 'Partners', 3, 2, NOW(), NOW(), 0);

-- The competition (online type)
INSERT IGNORE INTO competitions (
  id, organizing_team_id, competition_team_id, slug, name, description,
  start_date, end_date, registration_opens_at, registration_closes_at,
  timezone, competition_type, status, visibility,
  created_at, updated_at, update_counter
) VALUES (
  'comp_pr_online_throwdown', 'team_pr_demo_gym', 'team_pr_comp_online',
  'online-throwdown-2026', 'Online Throwdown 2026',
  'A 3-event online competition with individual and partner divisions',
  '2026-05-01', '2026-05-15',
  '2026-04-01', '2026-04-28',
  'America/Denver', 'online', 'published', 'public',
  NOW(), NOW(), 0
);

-- Competition divisions
INSERT IGNORE INTO competition_divisions (id, competition_id, division_id, fee_cents, description, max_spots, created_at, updated_at, update_counter) VALUES
('cdiv_pr_rxplus', 'comp_pr_online_throwdown', 'div_pr_rxplus', 2500, 'Elite individual division', 50, NOW(), NOW(), 0),
('cdiv_pr_rx', 'comp_pr_online_throwdown', 'div_pr_rx', 2500, 'Standard individual division', 100, NOW(), NOW(), 0),
('cdiv_pr_scaled', 'comp_pr_online_throwdown', 'div_pr_scaled', 2000, 'Beginner-friendly individual division', NULL, NOW(), NOW(), 0),
('cdiv_pr_partners', 'comp_pr_online_throwdown', 'div_pr_partners', 4000, 'Two-person partner division', 40, NOW(), NOW(), 0);

-- Programming track for competition events
INSERT IGNORE INTO programming_tracks (id, name, description, type, owner_team_id, scaling_group_id, is_public, competition_id, created_at, updated_at, update_counter) VALUES
('trk_pr_online_comp', 'Online Throwdown Events', 'Events for the Online Throwdown competition', 'competition', 'team_pr_demo_gym', 'sgrp_pr_online_comp', 0, 'comp_pr_online_throwdown', NOW(), NOW(), 0);

-- Competition workouts
INSERT IGNORE INTO workouts (id, team_id, name, description, scheme, time_cap, created_at, updated_at, update_counter) VALUES
('wkt_pr_event1', 'team_pr_demo_gym', 'Event 1 - The Grind', '3 rounds: 15 Deadlifts (225/155), 15 Box Jump Overs, 15 Bar-Facing Burpees', 'time', 900, NOW(), NOW(), 0),
('wkt_pr_event2', 'team_pr_demo_gym', 'Event 2 - Heavy Hitter', '1RM Clean & Jerk', 'weight', NULL, NOW(), NOW(), 0),
('wkt_pr_event3', 'team_pr_demo_gym', 'Event 3 - Team Sprint', 'Partners alternate: 5 rounds each of 10 Synchro Wall Balls + 10 Cal Row', 'time', 720, NOW(), NOW(), 0);

-- Track workouts (competition events)
INSERT IGNORE INTO track_workouts (id, track_id, workout_id, track_order, notes, points_multiplier, event_status, created_at, updated_at, update_counter) VALUES
('tw_pr_event1', 'trk_pr_online_comp', 'wkt_pr_event1', 1.00, 'Individual event - all divisions', 100, 'published', NOW(), NOW(), 0),
('tw_pr_event2', 'trk_pr_online_comp', 'wkt_pr_event2', 2.00, 'Individual event - Rx and Rx+ only', 100, 'published', NOW(), NOW(), 0),
('tw_pr_event3', 'trk_pr_online_comp', 'wkt_pr_event3', 3.00, 'Team event - Partner division only', 100, 'published', NOW(), NOW(), 0);

-- Competition events (with submission windows)
INSERT IGNORE INTO competition_events (id, competition_id, track_workout_id, submission_opens_at, submission_closes_at, created_at, updated_at, update_counter) VALUES
('ce_pr_event1', 'comp_pr_online_throwdown', 'tw_pr_event1', '2026-05-01', '2026-05-08', NOW(), NOW(), 0),
('ce_pr_event2', 'comp_pr_online_throwdown', 'tw_pr_event2', '2026-05-05', '2026-05-12', NOW(), NOW(), 0),
('ce_pr_event3', 'comp_pr_online_throwdown', 'tw_pr_event3', '2026-05-08', '2026-05-15', NOW(), NOW(), 0);

-- ============================================================================
-- EVENT-DIVISION MAPPINGS
-- ============================================================================

-- Event 1 (The Grind): all divisions
INSERT IGNORE INTO event_division_mappings (id, competition_id, track_workout_id, division_id, created_at, updated_at, update_counter) VALUES
('edm_e1_rxplus', 'comp_pr_online_throwdown', 'tw_pr_event1', 'div_pr_rxplus', NOW(), NOW(), 0),
('edm_e1_rx', 'comp_pr_online_throwdown', 'tw_pr_event1', 'div_pr_rx', NOW(), NOW(), 0),
('edm_e1_scaled', 'comp_pr_online_throwdown', 'tw_pr_event1', 'div_pr_scaled', NOW(), NOW(), 0),
('edm_e1_partners', 'comp_pr_online_throwdown', 'tw_pr_event1', 'div_pr_partners', NOW(), NOW(), 0);

-- Event 2 (Heavy Hitter): Rx+ and Rx only (no Scaled, no Partners)
INSERT IGNORE INTO event_division_mappings (id, competition_id, track_workout_id, division_id, created_at, updated_at, update_counter) VALUES
('edm_e2_rxplus', 'comp_pr_online_throwdown', 'tw_pr_event2', 'div_pr_rxplus', NOW(), NOW(), 0),
('edm_e2_rx', 'comp_pr_online_throwdown', 'tw_pr_event2', 'div_pr_rx', NOW(), NOW(), 0);

-- Event 3 (Team Sprint): Partners only
INSERT IGNORE INTO event_division_mappings (id, competition_id, track_workout_id, division_id, created_at, updated_at, update_counter) VALUES
('edm_e3_partners', 'comp_pr_online_throwdown', 'tw_pr_event3', 'div_pr_partners', NOW(), NOW(), 0);

-- ============================================================================
-- ATHLETE USERS FOR ONLINE THROWDOWN
-- ============================================================================

INSERT IGNORE INTO users (id, first_name, last_name, email, role, email_verified, current_credits, created_at, updated_at, update_counter) VALUES
-- Rx+ division athletes
('usr_ath_jake', 'Jake', 'Anderson', 'jake.anderson@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_sarah', 'Sarah', 'Chen', 'sarah.chen@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
-- Rx division athletes
('usr_ath_mike', 'Mike', 'Rodriguez', 'mike.rodriguez@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_emily', 'Emily', 'Watson', 'emily.watson@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_chris', 'Chris', 'Taylor', 'chris.taylor@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_aisha', 'Aisha', 'Patel', 'aisha.patel@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
-- Scaled division athletes
('usr_ath_tom', 'Tom', 'Baker', 'tom.baker@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_lisa', 'Lisa', 'Kim', 'lisa.kim@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
-- Partner division athletes
('usr_ath_dave', 'Dave', 'Martinez', 'dave.martinez@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_nicole', 'Nicole', 'James', 'nicole.james@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_marcus', 'Marcus', 'Wright', 'marcus.wright@example.com', 'user', NOW(), 0, NOW(), NOW(), 0),
('usr_ath_jen', 'Jen', 'Cooper', 'jen.cooper@example.com', 'user', NOW(), 0, NOW(), NOW(), 0);

-- ============================================================================
-- COMPETITION TEAM MEMBERSHIPS (athletes join the competition team)
-- ============================================================================

INSERT IGNORE INTO team_memberships (id, team_id, user_id, role_id, is_system_role, is_active, joined_at, created_at, updated_at, update_counter) VALUES
('tmem_ath_jake', 'team_pr_comp_online', 'usr_ath_jake', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_sarah', 'team_pr_comp_online', 'usr_ath_sarah', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_mike', 'team_pr_comp_online', 'usr_ath_mike', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_emily', 'team_pr_comp_online', 'usr_ath_emily', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_chris', 'team_pr_comp_online', 'usr_ath_chris', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_aisha', 'team_pr_comp_online', 'usr_ath_aisha', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_tom', 'team_pr_comp_online', 'usr_ath_tom', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_lisa', 'team_pr_comp_online', 'usr_ath_lisa', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_dave', 'team_pr_comp_online', 'usr_ath_dave', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_nicole', 'team_pr_comp_online', 'usr_ath_nicole', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_marcus', 'team_pr_comp_online', 'usr_ath_marcus', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_jen', 'team_pr_comp_online', 'usr_ath_jen', 'member', 0, 1, NOW(), NOW(), NOW(), 0);

-- ============================================================================
-- ATHLETE TEAMS (for partner division registrations)
-- ============================================================================

INSERT IGNORE INTO teams (id, name, slug, description, type, credit_balance, current_plan_id, created_at, updated_at, update_counter) VALUES
('team_ath_sendit', 'Send It', 'athlete-team-sendit', 'Partner team: Send It', 'competition', 0, NULL, NOW(), NOW(), 0),
('team_ath_norest', 'No Rest Days', 'athlete-team-norest', 'Partner team: No Rest Days', 'competition', 0, NULL, NOW(), NOW(), 0);

-- Athlete team memberships (partner pairs)
INSERT IGNORE INTO team_memberships (id, team_id, user_id, role_id, is_system_role, is_active, joined_at, created_at, updated_at, update_counter) VALUES
('tmem_ath_dave_sendit', 'team_ath_sendit', 'usr_ath_dave', 'owner', 1, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_nicole_sendit', 'team_ath_sendit', 'usr_ath_nicole', 'member', 0, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_marcus_norest', 'team_ath_norest', 'usr_ath_marcus', 'owner', 1, 1, NOW(), NOW(), NOW(), 0),
('tmem_ath_jen_norest', 'team_ath_norest', 'usr_ath_jen', 'member', 0, 1, NOW(), NOW(), NOW(), 0);

-- ============================================================================
-- COMPETITION REGISTRATIONS
-- ============================================================================

INSERT IGNORE INTO competition_registrations (id, event_id, user_id, team_member_id, division_id, registered_at, status, payment_status, captain_user_id, athlete_team_id, team_name, created_at, updated_at, update_counter) VALUES
-- Rx+ division (2 athletes)
('creg_jake', 'comp_pr_online_throwdown', 'usr_ath_jake', 'tmem_ath_jake', 'div_pr_rxplus', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
('creg_sarah', 'comp_pr_online_throwdown', 'usr_ath_sarah', 'tmem_ath_sarah', 'div_pr_rxplus', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
-- Rx division (4 athletes)
('creg_mike', 'comp_pr_online_throwdown', 'usr_ath_mike', 'tmem_ath_mike', 'div_pr_rx', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
('creg_emily', 'comp_pr_online_throwdown', 'usr_ath_emily', 'tmem_ath_emily', 'div_pr_rx', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
('creg_chris', 'comp_pr_online_throwdown', 'usr_ath_chris', 'tmem_ath_chris', 'div_pr_rx', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
('creg_aisha', 'comp_pr_online_throwdown', 'usr_ath_aisha', 'tmem_ath_aisha', 'div_pr_rx', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
-- Scaled division (2 athletes)
('creg_tom', 'comp_pr_online_throwdown', 'usr_ath_tom', 'tmem_ath_tom', 'div_pr_scaled', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
('creg_lisa', 'comp_pr_online_throwdown', 'usr_ath_lisa', 'tmem_ath_lisa', 'div_pr_scaled', NOW(), 'active', 'PAID', NULL, NULL, NULL, NOW(), NOW(), 0),
-- Partners division (captains only, with athlete team info)
('creg_dave', 'comp_pr_online_throwdown', 'usr_ath_dave', 'tmem_ath_dave', 'div_pr_partners', NOW(), 'active', 'PAID', 'usr_ath_dave', 'team_ath_sendit', 'Send It', NOW(), NOW(), 0),
('creg_marcus', 'comp_pr_online_throwdown', 'usr_ath_marcus', 'tmem_ath_marcus', 'div_pr_partners', NOW(), 'active', 'PAID', 'usr_ath_marcus', 'team_ath_norest', 'No Rest Days', NOW(), NOW(), 0);

-- ============================================================================
-- PUBLISH DIVISION RESULTS (required for online competition leaderboard)
-- ============================================================================

UPDATE competitions
SET settings = '{"divisionResults":{"tw_pr_event1":{"div_pr_rxplus":{"publishedAt":"2026-05-09T00:00:00.000Z"},"div_pr_rx":{"publishedAt":"2026-05-09T00:00:00.000Z"},"div_pr_scaled":{"publishedAt":"2026-05-09T00:00:00.000Z"},"div_pr_partners":{"publishedAt":"2026-05-09T00:00:00.000Z"}},"tw_pr_event2":{"div_pr_rxplus":{"publishedAt":"2026-05-13T00:00:00.000Z"},"div_pr_rx":{"publishedAt":"2026-05-13T00:00:00.000Z"}},"tw_pr_event3":{"div_pr_partners":{"publishedAt":"2026-05-16T00:00:00.000Z"}}}}'
WHERE id = 'comp_pr_online_throwdown';

-- ============================================================================
-- COMPETITION SCORES
-- ============================================================================
-- Score values: time in ms, weight in grams
-- Sort keys computed via computeSortKey() from src/lib/scoring/sort/sort-key.ts

-- Event 1 - The Grind (scheme: time, scoreType: min, timeCap: 900s)
-- All divisions compete. Lower time = better.
INSERT IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, status, status_order, sort_key, scaling_level_id, as_rx, recorded_at, verification_status, verified_at, verified_by_user_id, created_at, updated_at, update_counter) VALUES
-- Rx+ division
('scr_e1_jake',   'usr_ath_jake',   'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 435000, 'scored', 0, '00000000525882731532363690997186560000', 'div_pr_rxplus',   1, '2026-05-03 14:30:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e1_sarah',  'usr_ath_sarah',  'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 468000, 'scored', 0, '00000000565777283579646453762490368000', 'div_pr_rxplus',   1, '2026-05-04 09:15:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
-- Rx division
('scr_e1_mike',   'usr_ath_mike',   'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 502000, 'scored', 0, '00000000606880761446543845702500352000', 'div_pr_rx',       1, '2026-05-02 18:00:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e1_emily',  'usr_ath_emily',  'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 525000, 'scored', 0, '00000000634686055297680316720742400000', 'div_pr_rx',       1, '2026-05-03 11:45:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e1_chris',  'usr_ath_chris',  'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 550000, 'scored', 0, '00000000664909200788046046088396800000', 'div_pr_rx',       1, '2026-05-05 16:30:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e1_aisha',  'usr_ath_aisha',  'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 575000, 'scored', 0, '00000000695132346278411775456051200000', 'div_pr_rx',       1, '2026-05-04 20:00:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
-- Scaled division
('scr_e1_tom',    'usr_ath_tom',    'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 615000, 'scored', 0, '00000000743489379062996942444298240000', 'div_pr_scaled',   0, '2026-05-06 10:00:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e1_lisa',   'usr_ath_lisa',   'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 590000, 'scored', 0, '00000000713266233572631213076643840000', 'div_pr_scaled',   0, '2026-05-05 08:30:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
-- Partners division (captain scores for the team)
('scr_e1_dave',   'usr_ath_dave',   'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 645000, 'scored', 0, '00000000779757153651435817685483520000', 'div_pr_partners', 0, '2026-05-04 15:00:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e1_marcus', 'usr_ath_marcus', 'team_pr_demo_gym', 'wkt_pr_event1', 'tw_pr_event1', 'time', 'min', 680000, 'scored', 0, '00000000822069557337947838800199680000', 'div_pr_partners', 0, '2026-05-06 13:00:00', 'verified', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0);

-- Event 2 - Heavy Hitter (scheme: weight, scoreType: max, no timeCap)
-- Rx+ and Rx only. Higher weight = better. Values in grams.
INSERT IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, status, status_order, sort_key, scaling_level_id, as_rx, recorded_at, verification_status, verified_at, verified_by_user_id, created_at, updated_at, update_counter) VALUES
-- Rx+ division
('scr_e2_jake',   'usr_ath_jake',   'team_pr_demo_gym', 'wkt_pr_event2', 'tw_pr_event2', 'weight', 'max', 155000, 'scored', 0, '01329227808400204906816670351648358400', 'div_pr_rxplus', 1, '2026-05-08 14:00:00', 'verified', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e2_sarah',  'usr_ath_sarah',  'team_pr_demo_gym', 'wkt_pr_event2', 'tw_pr_event2', 'weight', 'max', 105000, 'scored', 0, '01329227868846495887548129086957158400', 'div_pr_rxplus', 1, '2026-05-09 10:30:00', 'verified', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
-- Rx division
('scr_e2_mike',   'usr_ath_mike',   'team_pr_demo_gym', 'wkt_pr_event2', 'tw_pr_event2', 'weight', 'max', 125000, 'scored', 0, '01329227844667979495255545592833638400', 'div_pr_rx',     1, '2026-05-07 17:00:00', 'verified', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e2_emily',  'usr_ath_emily',  'team_pr_demo_gym', 'wkt_pr_event2', 'tw_pr_event2', 'weight', 'max',  80000, 'scored', 0, '01329227899069641377913858454611558400', 'div_pr_rx',     1, '2026-05-08 09:00:00', 'verified', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e2_chris',  'usr_ath_chris',  'team_pr_demo_gym', 'wkt_pr_event2', 'tw_pr_event2', 'weight', 'max', 140000, 'scored', 0, '01329227826534092201036107972240998400', 'div_pr_rx',     1, '2026-05-10 12:00:00', 'verified', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e2_aisha',  'usr_ath_aisha',  'team_pr_demo_gym', 'wkt_pr_event2', 'tw_pr_event2', 'weight', 'max',  75000, 'scored', 0, '01329227905114270475987004328142438400', 'div_pr_rx',     1, '2026-05-09 19:30:00', 'verified', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0);

-- Event 3 - Team Sprint (scheme: time, scoreType: min, timeCap: 720s)
-- Partners division only. Lower time = better.
INSERT IGNORE INTO scores (id, user_id, team_id, workout_id, competition_event_id, scheme, score_type, score_value, status, status_order, sort_key, scaling_level_id, as_rx, recorded_at, verification_status, verified_at, verified_by_user_id, created_at, updated_at, update_counter) VALUES
('scr_e3_dave',   'usr_ath_dave',   'team_pr_demo_gym', 'wkt_pr_event3', 'tw_pr_event3', 'time', 'min', 645000, 'scored', 0, '00000000779757153651435817685483520000', 'div_pr_partners', 0, '2026-05-12 16:00:00', 'verified', '2026-05-16 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('scr_e3_marcus', 'usr_ath_marcus', 'team_pr_demo_gym', 'wkt_pr_event3', 'tw_pr_event3', 'time', 'min', 680000, 'scored', 0, '00000000822069557337947838800199680000', 'div_pr_partners', 0, '2026-05-13 11:00:00', 'verified', '2026-05-16 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0);

-- ============================================================================
-- VIDEO SUBMISSIONS (required for online competition scores)
-- ============================================================================

-- Event 1 - The Grind (all divisions)
INSERT IGNORE INTO video_submissions (id, registration_id, track_workout_id, video_index, user_id, video_url, notes, submitted_at, review_status, status_updated_at, reviewed_at, reviewed_by, created_at, updated_at, update_counter) VALUES
('vsub_e1_jake',   'creg_jake',   'tw_pr_event1', 0, 'usr_ath_jake',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Felt great, PR pace', '2026-05-03 14:30:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_sarah',  'creg_sarah',  'tw_pr_event1', 0, 'usr_ath_sarah',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Steady pacing strategy', '2026-05-04 09:15:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_mike',   'creg_mike',   'tw_pr_event1', 0, 'usr_ath_mike',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Pushed hard on burpees', '2026-05-02 18:00:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_emily',  'creg_emily',  'tw_pr_event1', 0, 'usr_ath_emily',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Box jumps felt smooth', '2026-05-03 11:45:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_chris',  'creg_chris',  'tw_pr_event1', 0, 'usr_ath_chris',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Deadlifts unbroken all sets', '2026-05-05 16:30:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_aisha',  'creg_aisha',  'tw_pr_event1', 0, 'usr_ath_aisha',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Consistent rounds', '2026-05-04 20:00:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_tom',    'creg_tom',    'tw_pr_event1', 0, 'usr_ath_tom',    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'First comp, happy to finish', '2026-05-06 10:00:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_lisa',   'creg_lisa',   'tw_pr_event1', 0, 'usr_ath_lisa',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Scaled deadlifts to 115', '2026-05-05 08:30:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_dave',   'creg_dave',   'tw_pr_event1', 0, 'usr_ath_dave',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Team worked well together', '2026-05-04 15:00:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e1_marcus', 'creg_marcus', 'tw_pr_event1', 0, 'usr_ath_marcus', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Close finish, gave it all', '2026-05-06 13:00:00', 'verified', '2026-05-09 10:00:00', '2026-05-09 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0);

-- Event 2 - Heavy Hitter (Rx+ and Rx only)
INSERT IGNORE INTO video_submissions (id, registration_id, track_workout_id, video_index, user_id, video_url, notes, submitted_at, review_status, status_updated_at, reviewed_at, reviewed_by, created_at, updated_at, update_counter) VALUES
('vsub_e2_jake',   'creg_jake',   'tw_pr_event2', 0, 'usr_ath_jake',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '155kg PR clean and jerk', '2026-05-08 14:00:00', 'verified', '2026-05-13 10:00:00', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e2_sarah',  'creg_sarah',  'tw_pr_event2', 0, 'usr_ath_sarah',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Missed 110 but happy with 105', '2026-05-09 10:30:00', 'verified', '2026-05-13 10:00:00', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e2_mike',   'creg_mike',   'tw_pr_event2', 0, 'usr_ath_mike',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Solid lift, 125kg', '2026-05-07 17:00:00', 'verified', '2026-05-13 10:00:00', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e2_emily',  'creg_emily',  'tw_pr_event2', 0, 'usr_ath_emily',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '80kg felt heavy today', '2026-05-08 09:00:00', 'verified', '2026-05-13 10:00:00', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e2_chris',  'creg_chris',  'tw_pr_event2', 0, 'usr_ath_chris',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Strong day, 140kg', '2026-05-10 12:00:00', 'verified', '2026-05-13 10:00:00', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e2_aisha',  'creg_aisha',  'tw_pr_event2', 0, 'usr_ath_aisha',  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Technique felt good', '2026-05-09 19:30:00', 'verified', '2026-05-13 10:00:00', '2026-05-13 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0);

-- Event 3 - Team Sprint (Partners only)
INSERT IGNORE INTO video_submissions (id, registration_id, track_workout_id, video_index, user_id, video_url, notes, submitted_at, review_status, status_updated_at, reviewed_at, reviewed_by, created_at, updated_at, update_counter) VALUES
('vsub_e3_dave',   'creg_dave',   'tw_pr_event3', 0, 'usr_ath_dave',   'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Great sync on wall balls', '2026-05-12 16:00:00', 'verified', '2026-05-16 10:00:00', '2026-05-16 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0),
('vsub_e3_marcus', 'creg_marcus', 'tw_pr_event3', 0, 'usr_ath_marcus', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Rowing transitions were key', '2026-05-13 11:00:00', 'verified', '2026-05-16 10:00:00', '2026-05-16 10:00:00', 'usr_pr_demo_user', NOW(), NOW(), 0);
