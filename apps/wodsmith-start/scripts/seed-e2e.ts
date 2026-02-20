#!/usr/bin/env tsx
/**
 * E2E Test Seed Data
 *
 * Seeds predictable test data for Playwright E2E tests.
 * IDs are prefixed with 'e2e_' for easy identification and cleanup.
 *
 * Test User Credentials:
 *   Email: test@wodsmith.com
 *   Password: TestPassword123!
 */

import mysql from "mysql2/promise"

function currentTimestamp(): string {
	return new Date().toISOString().slice(0, 19).replace("T", " ")
}

function futureTimestamp(days: number): string {
	const d = new Date()
	d.setDate(d.getDate() + days)
	return d.toISOString().slice(0, 19).replace("T", " ")
}

function dateString(daysFromNow: number): string {
	const d = new Date()
	d.setDate(d.getDate() + daysFromNow)
	return d.toISOString().slice(0, 10)
}

async function main() {
	const url = process.env.DATABASE_URL
	if (!url) {
		console.error("DATABASE_URL environment variable is required")
		process.exit(1)
	}

	const connection = await mysql.createConnection({ uri: url })
	const ts = currentTimestamp()

	try {
		console.log("Cleaning up existing E2E test data...")

		// Clean up in reverse dependency order
		const cleanupTables = [
			"competition_registrations",
			"competition_events",
			"scaling_levels",
			"scaling_groups",
			"competitions",
			"team_feature_entitlements",
			"team_subscriptions",
			"workouts",
			"team_memberships",
			"teams",
			"users",
		]

		for (const table of cleanupTables) {
			await connection.execute(
				`DELETE FROM \`${table}\` WHERE id LIKE 'e2e_%'`,
			)
		}
		// Clean up registrations by event_id
		await connection.execute(
			"DELETE FROM `competition_registrations` WHERE event_id = 'e2e_competition'",
		)
		// Also clean up users by email
		await connection.execute(
			"DELETE FROM `users` WHERE email IN (?, ?)",
			["test@wodsmith.com", "admin@wodsmith.com"],
		)
		// Clean up workouts by team_id
		for (const teamId of [
			"e2e_personal_team_test",
			"e2e_personal_team_admin",
			"e2e_test_team",
		]) {
			await connection.execute(
				"DELETE FROM `workouts` WHERE team_id = ?",
				[teamId],
			)
		}
		// Clean up memberships by user_id
		await connection.execute(
			"DELETE FROM `team_memberships` WHERE user_id LIKE 'e2e_%'",
		)
		// Clean up teams by slug
		await connection.execute(
			"DELETE FROM `teams` WHERE slug IN ('e2e-test-gym', 'e2e-comp-athletes')",
		)
		// Clean up competitions by slug
		await connection.execute(
			"DELETE FROM `competitions` WHERE slug = 'e2e-throwdown'",
		)

		console.log("  Cleanup done\n")

		// ================================================================
		// TEST USERS
		// ================================================================
		console.log("Seeding E2E users...")

		const passwordHash =
			"e2e0test0salt00000000000000000000:4187a1e862ad918acfead153cf13af93f70ceb8b2f5d185eef7a7e7afc58f830"

		await connection.execute(
			`INSERT IGNORE INTO \`users\` (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_test_user",
				"Test",
				"User",
				"test@wodsmith.com",
				passwordHash,
				"user",
				ts,
				100,
				ts,
				ts,
				0,
			],
		)

		await connection.execute(
			`INSERT IGNORE INTO \`users\` (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_admin_user",
				"Admin",
				"User",
				"admin@wodsmith.com",
				passwordHash,
				"admin",
				ts,
				1000,
				ts,
				ts,
				0,
			],
		)

		console.log("  users: 2 rows inserted")

		// ================================================================
		// TEAMS
		// ================================================================
		console.log("Seeding E2E teams...")

		// Personal team for test user
		await connection.execute(
			`INSERT IGNORE INTO \`teams\` (id, name, slug, description, is_personal_team, personal_team_owner_id, credit_balance, current_plan_id, type, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_personal_team_test",
				"Test's Team (personal)",
				"test-st_user",
				"Personal team for individual programming track subscriptions",
				1,
				"e2e_test_user",
				0,
				"free",
				"personal",
				ts,
				ts,
				0,
			],
		)

		// Personal team for admin user
		await connection.execute(
			`INSERT IGNORE INTO \`teams\` (id, name, slug, description, is_personal_team, personal_team_owner_id, credit_balance, current_plan_id, type, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_personal_team_admin",
				"Admin's Team (personal)",
				"admin-n_user",
				"Personal team for individual programming track subscriptions",
				1,
				"e2e_admin_user",
				0,
				"free",
				"personal",
				ts,
				ts,
				0,
			],
		)

		// Test gym team
		await connection.execute(
			`INSERT IGNORE INTO \`teams\` (id, name, slug, description, type, credit_balance, current_plan_id, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_test_team",
				"E2E Test Gym",
				"e2e-test-gym",
				"A test gym for E2E testing",
				"gym",
				500,
				"free",
				ts,
				ts,
				0,
			],
		)

		console.log("  teams: 3 rows inserted")

		// ================================================================
		// TEAM MEMBERSHIPS
		// ================================================================
		console.log("Seeding E2E team memberships...")

		const memberships = [
			// Test user owns personal team
			["e2e_membership_personal_test", "e2e_personal_team_test", "e2e_test_user", "owner"],
			// Admin user owns personal team
			["e2e_membership_personal_admin", "e2e_personal_team_admin", "e2e_admin_user", "owner"],
			// Test user owns test gym
			["e2e_membership_owner", "e2e_test_team", "e2e_test_user", "owner"],
			// Admin user is admin of test gym
			["e2e_membership_admin", "e2e_test_team", "e2e_admin_user", "admin"],
		]

		for (const [id, teamId, userId, roleId] of memberships) {
			await connection.execute(
				`INSERT IGNORE INTO \`team_memberships\` (id, team_id, user_id, role_id, is_system_role, is_active, joined_at, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, teamId, userId, roleId, 1, 1, ts, ts, ts, 0],
			)
		}

		console.log("  team_memberships: 4 rows inserted")

		// ================================================================
		// WORKOUTS
		// ================================================================
		console.log("Seeding E2E workouts...")

		await connection.execute(
			`INSERT IGNORE INTO \`workouts\` (id, team_id, name, description, scheme, scope, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_workout_fran",
				"e2e_personal_team_test",
				"Fran",
				"21-15-9 Thrusters (95/65 lb) and Pull-ups",
				"time",
				"private",
				ts,
				ts,
				0,
			],
		)

		await connection.execute(
			`INSERT IGNORE INTO \`workouts\` (id, team_id, name, description, scheme, scope, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_workout_murph",
				"e2e_personal_team_test",
				"Murph",
				"1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Squats, 1 mile Run",
				"time",
				"private",
				ts,
				ts,
				0,
			],
		)

		await connection.execute(
			`INSERT IGNORE INTO \`workouts\` (id, team_id, name, description, scheme, scope, time_cap, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_workout_cindy",
				"e2e_personal_team_test",
				"Cindy",
				"5 Pull-ups, 10 Push-ups, 15 Squats - AMRAP 20 minutes",
				"rounds-reps",
				"private",
				1200,
				ts,
				ts,
				0,
			],
		)

		console.log("  workouts: 3 rows inserted")

		// ================================================================
		// TEAM SUBSCRIPTION
		// ================================================================
		console.log("Seeding E2E team subscription...")

		const futureTs = futureTimestamp(365)

		await connection.execute(
			`INSERT IGNORE INTO \`team_subscriptions\` (id, team_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_sub_free",
				"e2e_test_team",
				"free",
				"active",
				ts,
				futureTs,
				ts,
				ts,
				0,
			],
		)

		console.log("  team_subscriptions: 1 row inserted")

		// ================================================================
		// FEATURE ENTITLEMENT (host_competitions for organizer tests)
		// ================================================================
		console.log("Seeding E2E feature entitlements...")

		// Ensure the feature exists (may already exist from base seed)
		await connection.execute(
			`INSERT IGNORE INTO \`features\` (id, \`key\`, name, description, category, is_active, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_feature_host_comp",
				"host_competitions",
				"Host Competitions",
				"Allow team to host competitions",
				"team",
				1,
				ts,
				ts,
				0,
			],
		)

		// Get the actual feature ID (may differ if base seed created it)
		const [featureRows] = await connection.execute(
			"SELECT id FROM `features` WHERE `key` = 'host_competitions'",
		) as [Array<{ id: string }>, unknown]
		const hostFeatureId = featureRows[0]?.id || "e2e_feature_host_comp"

		// Grant host_competitions to e2e_test_team
		await connection.execute(
			`INSERT IGNORE INTO \`team_feature_entitlements\` (id, team_id, feature_id, source, is_active, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			["e2e_feat_host", "e2e_test_team", hostFeatureId, "override", 1, ts, ts, 0],
		)

		console.log("  feature entitlements: 1 row inserted")

		// ================================================================
		// COMPETITION (for registration tests)
		// ================================================================
		console.log("Seeding E2E competition...")

		// Competition athlete team
		await connection.execute(
			`INSERT IGNORE INTO \`teams\` (id, name, slug, description, type, credit_balance, current_plan_id, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_comp_team",
				"E2E Comp Athletes",
				"e2e-comp-athletes",
				"Athlete team for E2E test competition",
				"competition_event",
				0,
				"free",
				ts,
				ts,
				0,
			],
		)

		// Scaling group + levels (divisions)
		await connection.execute(
			`INSERT IGNORE INTO \`scaling_groups\` (id, title, description, team_id, is_default, is_system, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			["e2e_scaling_group", "E2E Divisions", null, "e2e_test_team", 0, 0, ts, ts, 0],
		)

		const divisions = [
			["e2e_div_rx", "e2e_scaling_group", "RX", 0, 1],
			["e2e_div_scaled", "e2e_scaling_group", "Scaled", 1, 1],
			["e2e_div_team", "e2e_scaling_group", "Team of 2", 2, 2],
		]
		for (const [id, groupId, label, position, teamSize] of divisions) {
			await connection.execute(
				`INSERT IGNORE INTO \`scaling_levels\` (id, scaling_group_id, label, position, team_size, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, groupId, label, position, teamSize, ts, ts, 0],
			)
		}

		// Competition with open registration
		const settings = JSON.stringify({ divisions: { scalingGroupId: "e2e_scaling_group" } })
		await connection.execute(
			`INSERT IGNORE INTO \`competitions\` (id, organizing_team_id, competition_team_id, slug, name, description, start_date, end_date, registration_opens_at, registration_closes_at, timezone, settings, default_registration_fee_cents, visibility, status, competition_type, created_at, updated_at, update_counter)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"e2e_competition",
				"e2e_test_team",
				"e2e_comp_team",
				"e2e-throwdown",
				"E2E Test Throwdown",
				"A test competition for E2E testing",
				dateString(30),
				dateString(31),
				dateString(-1),
				dateString(29),
				"America/Denver",
				settings,
				0,
				"public",
				"published",
				"in-person",
				ts,
				ts,
				0,
			],
		)

		console.log("  competition: 1 + 1 team + 3 divisions inserted")

		console.log("\nE2E seed complete!")
	} finally {
		await connection.end()
	}
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
