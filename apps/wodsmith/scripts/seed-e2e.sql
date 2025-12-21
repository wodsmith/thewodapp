-- E2E Test Seed Data
-- This file seeds predictable test data for Playwright E2E tests
-- IDs are prefixed with 'e2e_' for easy identification and cleanup
--
-- Test User Credentials:
--   Email: test@wodsmith.com
--   Password: TestPassword123!

-- Clean up any existing E2E test data first (order matters for FK constraints)
-- Delete by ID pattern AND by known slugs/emails to catch all E2E data
DELETE FROM team_subscription WHERE id LIKE 'e2e_%';
DELETE FROM team_subscription WHERE teamId IN (SELECT id FROM team WHERE slug = 'e2e-test-gym');
DELETE FROM team_subscription WHERE teamId IN (SELECT id FROM team WHERE slug LIKE 'test-%' OR slug LIKE 'admin-%');
DELETE FROM workouts WHERE id LIKE 'e2e_%';
DELETE FROM workouts WHERE team_id IN (SELECT id FROM team WHERE slug = 'e2e-test-gym');
DELETE FROM team_membership WHERE id LIKE 'e2e_%';
DELETE FROM team_membership WHERE teamId IN (SELECT id FROM team WHERE slug = 'e2e-test-gym');
DELETE FROM team_membership WHERE teamId IN (SELECT id FROM team WHERE slug LIKE 'test-%' OR slug LIKE 'admin-%');
DELETE FROM team WHERE id LIKE 'e2e_%';
DELETE FROM team WHERE slug = 'e2e-test-gym';
DELETE FROM team WHERE slug LIKE 'test-%' AND isPersonalTeam = 1;
DELETE FROM team WHERE slug LIKE 'admin-%' AND isPersonalTeam = 1;
DELETE FROM user WHERE id LIKE 'e2e_%';
DELETE FROM user WHERE email = 'test@wodsmith.com';
DELETE FROM user WHERE email = 'admin@wodsmith.com';

-- ============================================================================
-- TEST USER
-- ============================================================================
-- Password hash generated with fixed salt for reproducibility
-- Salt: e2e0test0salt00000000000000000000
-- Password: TestPassword123!
INSERT INTO user (
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
    'e2e_test_user',
    'Test',
    'User',
    'test@wodsmith.com',
    'e2e0test0salt00000000000000000000:4187a1e862ad918acfead153cf13af93f70ceb8b2f5d185eef7a7e7afc58f830',
    'user',
    strftime('%s', 'now'),
    100,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Admin test user
INSERT INTO user (
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
    'e2e_admin_user',
    'Admin',
    'User',
    'admin@wodsmith.com',
    'e2e0test0salt00000000000000000000:4187a1e862ad918acfead153cf13af93f70ceb8b2f5d185eef7a7e7afc58f830',
    'admin',
    strftime('%s', 'now'),
    1000,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- PERSONAL TEAMS (Required for each user)
-- ============================================================================
-- Personal team for test user
INSERT INTO team (
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
    'e2e_personal_team_test',
    'Test''s Team (personal)',
    'test-st_user',
    'Personal team for individual programming track subscriptions',
    1,
    'e2e_test_user',
    0,
    'free',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Personal team for admin user
INSERT INTO team (
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
    'e2e_personal_team_admin',
    'Admin''s Team (personal)',
    'admin-n_user',
    'Personal team for individual programming track subscriptions',
    1,
    'e2e_admin_user',
    0,
    'free',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEST TEAM (Gym)
-- ============================================================================
INSERT INTO team (
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
    'e2e_test_team',
    'E2E Test Gym',
    'e2e-test-gym',
    'A test gym for E2E testing',
    'gym',
    500,
    'free',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEAM MEMBERSHIPS
-- ============================================================================
-- Test user is owner of their personal team
INSERT INTO team_membership (
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
    'e2e_membership_personal_test',
    'e2e_personal_team_test',
    'e2e_test_user',
    'owner',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Admin user is owner of their personal team
INSERT INTO team_membership (
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
    'e2e_membership_personal_admin',
    'e2e_personal_team_admin',
    'e2e_admin_user',
    'owner',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Test user is owner of test gym team
INSERT INTO team_membership (
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
    'e2e_membership_owner',
    'e2e_test_team',
    'e2e_test_user',
    'owner',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Admin user is admin of test gym team
INSERT INTO team_membership (
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
    'e2e_membership_admin',
    'e2e_test_team',
    'e2e_admin_user',
    'admin',
    1,
    1,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEST WORKOUTS
-- ============================================================================
-- Classic CrossFit workout: Fran (time-based)
INSERT INTO workouts (
    id,
    team_id,
    name,
    description,
    scheme,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'e2e_workout_fran',
    'e2e_test_team',
    'Fran',
    '21-15-9 Thrusters (95/65 lb) and Pull-ups',
    'time',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- Hero workout: Murph (time-based)
INSERT INTO workouts (
    id,
    team_id,
    name,
    description,
    scheme,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'e2e_workout_murph',
    'e2e_test_team',
    'Murph',
    '1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Squats, 1 mile Run',
    'time',
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- AMRAP workout: Cindy (rounds-reps)
INSERT INTO workouts (
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
    'e2e_workout_cindy',
    'e2e_test_team',
    'Cindy',
    '5 Pull-ups, 10 Push-ups, 15 Squats - AMRAP 20 minutes',
    'rounds-reps',
    1200,
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);

-- ============================================================================
-- TEAM SUBSCRIPTION (Free plan)
-- ============================================================================
-- team_subscription has required fields: currentPeriodStart, currentPeriodEnd
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
    'e2e_sub_free',
    'e2e_test_team',
    'free',
    'active',
    strftime('%s', 'now'),
    strftime('%s', 'now', '+1 year'),
    strftime('%s', 'now'),
    strftime('%s', 'now'),
    0
);
