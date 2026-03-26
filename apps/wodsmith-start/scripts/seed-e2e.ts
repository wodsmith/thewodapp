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

async function main(): Promise<void> {
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
			"volunteer_registration_answers",
			"competition_registration_answers",
			"competition_registration_questions",
			"team_invitations",
			"competition_registrations",
			"competition_events",
			"scaling_levels",
			"scaling_groups",
			"competitions",
			"team_entitlement_overrides",
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
			"DELETE FROM `users` WHERE email IN (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			[
				"test@wodsmith.com", "admin@wodsmith.com",
				"alice@test.com", "bob@test.com", "carol@test.com",
				"dave@test.com", "eve@test.com",
				"volunteer1@test.com", "volunteer2@test.com",
			],
		)
		// Clean up volunteer user not caught by email list
		await connection.execute(
			"DELETE FROM `users` WHERE email = ?",
			["volunteer3@test.com"],
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
			"00000000000000000000000000000000:07909439c014b7b32f22e8a0d8ef9c94fd7c9c0d1783153d8a3d5b2072c6736e"

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
				"e2e_test_team",
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
				"e2e_test_team",
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
				"e2e_test_team",
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

		// Grant workout_tracking to both personal and gym teams (required for /workouts access)
		// Clean up any existing overrides first
		await connection.execute(
			"DELETE FROM `team_entitlement_overrides` WHERE id LIKE 'e2e_%'",
		)

		const workoutTrackingOverrides = [
			["e2e_teo_personal_workout", "e2e_personal_team_test", "feature", "workout_tracking", "true", "E2E test grant"],
			["e2e_teo_gym_workout", "e2e_test_team", "feature", "workout_tracking", "true", "E2E test grant"],
		]
		for (const [id, teamId, type, key, value, reason] of workoutTrackingOverrides) {
			await connection.execute(
				`INSERT IGNORE INTO \`team_entitlement_overrides\` (id, team_id, type, \`key\`, value, reason, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, teamId, type, key, value, reason, ts, ts, 0],
			)
		}

		console.log("  feature entitlements: 1 + 2 workout_tracking overrides inserted")

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

		// ================================================================
		// EXTRA ATHLETE USERS (for broadcast question filter testing)
		// ================================================================
		console.log("Seeding E2E athlete users...")

		const athleteUsers = [
			["e2e_athlete_1", "Alice", "Smith", "alice@test.com"],
			["e2e_athlete_2", "Bob", "Jones", "bob@test.com"],
			["e2e_athlete_3", "Carol", "Davis", "carol@test.com"],
			["e2e_athlete_4", "Dave", "Wilson", "dave@test.com"],
			["e2e_athlete_5", "Eve", "Taylor", "eve@test.com"],
		]

		for (const [id, firstName, lastName, email] of athleteUsers) {
			await connection.execute(
				`INSERT IGNORE INTO \`users\` (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, firstName, lastName, email, passwordHash, "user", ts, 0, ts, ts, 0],
			)
		}

		console.log(`  athlete users: ${athleteUsers.length} rows inserted`)

		// ================================================================
		// ATHLETE REGISTRATIONS
		// ================================================================
		console.log("Seeding E2E athlete registrations...")

		const registrations = [
			["e2e_reg_1", "e2e_athlete_1", "e2e_div_rx"],
			["e2e_reg_2", "e2e_athlete_2", "e2e_div_rx"],
			["e2e_reg_3", "e2e_athlete_3", "e2e_div_scaled"],
			["e2e_reg_4", "e2e_athlete_4", "e2e_div_scaled"],
			["e2e_reg_5", "e2e_athlete_5", "e2e_div_rx"],
		]

		for (const [id, userId, divisionId] of registrations) {
			await connection.execute(
				`INSERT IGNORE INTO \`competition_registrations\` (id, event_id, user_id, division_id, status, registration_type, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, "e2e_competition", userId, divisionId, "confirmed", "individual", ts, ts, 0],
			)
			// Also add athlete to competition team
			await connection.execute(
				`INSERT IGNORE INTO \`team_memberships\` (id, team_id, user_id, role_id, is_system_role, is_active, joined_at, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[`e2e_comp_membership_${userId}`, "e2e_comp_team", userId, "athlete", 1, 1, ts, ts, ts, 0],
			)
		}

		console.log(`  registrations: ${registrations.length} rows inserted`)

		// ================================================================
		// REGISTRATION QUESTIONS (athlete + volunteer)
		// ================================================================
		console.log("Seeding E2E registration questions...")

		const questions = [
			// Athlete questions
			[
				"e2e_q_tshirt", "e2e_competition", null, "select",
				"T-Shirt Size", "What size t-shirt do you want?",
				JSON.stringify(["S", "M", "L", "XL", "XXL"]),
				1, 0, 0, "athlete",
			],
			[
				"e2e_q_experience", "e2e_competition", null, "select",
				"Experience Level", "How long have you been competing?",
				JSON.stringify(["Beginner", "Intermediate", "Advanced", "Elite"]),
				1, 0, 1, "athlete",
			],
			[
				"e2e_q_dietary", "e2e_competition", null, "text",
				"Dietary Restrictions", "Any food allergies or dietary needs?",
				null,
				0, 0, 2, "athlete",
			],
			[
				"e2e_q_emergency", "e2e_competition", null, "text",
				"Emergency Contact Phone", "Phone number for your emergency contact",
				null,
				1, 0, 3, "athlete",
			],
			// Volunteer questions
			[
				"e2e_q_vol_cert", "e2e_competition", null, "select",
				"First Aid Certification", "Do you have a current first aid or EMT certification?",
				JSON.stringify(["Yes", "No"]),
				1, 0, 0, "volunteer",
			],
			[
				"e2e_q_vol_avail", "e2e_competition", null, "select",
				"Day Availability", "Which days can you volunteer?",
				JSON.stringify(["Saturday Only", "Sunday Only", "Both Days"]),
				1, 0, 1, "volunteer",
			],
		]

		for (const [id, compId, groupId, type, label, helpText, options, required, forTeammates, sortOrder, questionTarget] of questions) {
			await connection.execute(
				`INSERT IGNORE INTO \`competition_registration_questions\` (id, competition_id, group_id, type, label, help_text, options, required, for_teammates, sort_order, question_target, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, compId, groupId, type, label, helpText, options, required, forTeammates, sortOrder, questionTarget, ts, ts, 0],
			)
		}

		console.log(`  registration questions: ${questions.length} rows inserted`)

		// ================================================================
		// ATHLETE REGISTRATION ANSWERS
		// ================================================================
		console.log("Seeding E2E athlete registration answers...")

		const athleteAnswers = [
			// Alice: L shirt, Advanced, no dietary, has emergency contact
			["e2e_ans_1_shirt", "e2e_q_tshirt", "e2e_reg_1", "e2e_athlete_1", "L"],
			["e2e_ans_1_exp", "e2e_q_experience", "e2e_reg_1", "e2e_athlete_1", "Advanced"],
			["e2e_ans_1_emerg", "e2e_q_emergency", "e2e_reg_1", "e2e_athlete_1", "555-0101"],
			// Bob: XL shirt, Elite, gluten-free
			["e2e_ans_2_shirt", "e2e_q_tshirt", "e2e_reg_2", "e2e_athlete_2", "XL"],
			["e2e_ans_2_exp", "e2e_q_experience", "e2e_reg_2", "e2e_athlete_2", "Elite"],
			["e2e_ans_2_diet", "e2e_q_dietary", "e2e_reg_2", "e2e_athlete_2", "Gluten-free"],
			["e2e_ans_2_emerg", "e2e_q_emergency", "e2e_reg_2", "e2e_athlete_2", "555-0202"],
			// Carol: M shirt, Beginner, vegan
			["e2e_ans_3_shirt", "e2e_q_tshirt", "e2e_reg_3", "e2e_athlete_3", "M"],
			["e2e_ans_3_exp", "e2e_q_experience", "e2e_reg_3", "e2e_athlete_3", "Beginner"],
			["e2e_ans_3_diet", "e2e_q_dietary", "e2e_reg_3", "e2e_athlete_3", "Vegan"],
			["e2e_ans_3_emerg", "e2e_q_emergency", "e2e_reg_3", "e2e_athlete_3", "555-0303"],
			// Dave: L shirt, Intermediate
			["e2e_ans_4_shirt", "e2e_q_tshirt", "e2e_reg_4", "e2e_athlete_4", "L"],
			["e2e_ans_4_exp", "e2e_q_experience", "e2e_reg_4", "e2e_athlete_4", "Intermediate"],
			["e2e_ans_4_emerg", "e2e_q_emergency", "e2e_reg_4", "e2e_athlete_4", "555-0404"],
			// Eve: S shirt, Advanced, nut allergy
			["e2e_ans_5_shirt", "e2e_q_tshirt", "e2e_reg_5", "e2e_athlete_5", "S"],
			["e2e_ans_5_exp", "e2e_q_experience", "e2e_reg_5", "e2e_athlete_5", "Advanced"],
			["e2e_ans_5_diet", "e2e_q_dietary", "e2e_reg_5", "e2e_athlete_5", "Nut allergy"],
			["e2e_ans_5_emerg", "e2e_q_emergency", "e2e_reg_5", "e2e_athlete_5", "555-0505"],
		]

		for (const [id, questionId, registrationId, userId, answer] of athleteAnswers) {
			await connection.execute(
				`INSERT IGNORE INTO \`competition_registration_answers\` (id, question_id, registration_id, user_id, answer, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, questionId, registrationId, userId, answer, ts, ts, 0],
			)
		}

		console.log(`  athlete answers: ${athleteAnswers.length} rows inserted`)

		// ================================================================
		// VOLUNTEER INVITATIONS + ANSWERS
		// ================================================================
		console.log("Seeding E2E volunteer invitations and answers...")

		const volunteerInvitations = [
			["e2e_vol_inv_1", "e2e_comp_team", "volunteer1@test.com", "e2e_test_user", "e2e_vol_token_1"],
			["e2e_vol_inv_2", "e2e_comp_team", "volunteer2@test.com", "e2e_test_user", "e2e_vol_token_2"],
			["e2e_vol_inv_3", "e2e_comp_team", "volunteer3@test.com", "e2e_test_user", "e2e_vol_token_3"],
		]

		for (const [id, teamId, email, invitedBy, token] of volunteerInvitations) {
			await connection.execute(
				`INSERT IGNORE INTO \`team_invitations\` (id, team_id, email, role_id, is_system_role, token, invited_by, expires_at, status, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, teamId, email, "volunteer", 1, token, invitedBy, futureTs, "accepted", ts, ts, 0],
			)
		}

		// Create volunteer users and memberships
		const volunteerUsers = [
			["e2e_vol_user_1", "Frank", "Garcia", "volunteer1@test.com", "e2e_vol_inv_1"],
			["e2e_vol_user_2", "Grace", "Martinez", "volunteer2@test.com", "e2e_vol_inv_2"],
			["e2e_vol_user_3", "Hank", "Brown", "volunteer3@test.com", "e2e_vol_inv_3"],
		]

		for (const [id, firstName, lastName, email, invId] of volunteerUsers) {
			await connection.execute(
				`INSERT IGNORE INTO \`users\` (id, first_name, last_name, email, password_hash, role, email_verified, current_credits, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, firstName, lastName, email, passwordHash, "user", ts, 0, ts, ts, 0],
			)
			// Update invitation with acceptedBy
			await connection.execute(
				`UPDATE \`team_invitations\` SET accepted_by = ?, accepted_at = ? WHERE id = ?`,
				[id, ts, invId],
			)
			// Add volunteer team membership with role metadata
			const metadata = JSON.stringify({ volunteerRoleTypes: id === "e2e_vol_user_1" ? ["judge", "medical"] : id === "e2e_vol_user_2" ? ["judge"] : ["scorekeeper"] })
			await connection.execute(
				`INSERT IGNORE INTO \`team_memberships\` (id, team_id, user_id, role_id, is_system_role, is_active, metadata, joined_at, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[`e2e_vol_membership_${id}`, "e2e_comp_team", id, "volunteer", 1, 1, metadata, ts, ts, ts, 0],
			)
		}

		// Volunteer answers
		const volunteerAnswers = [
			// Frank: has EMT cert, both days
			["e2e_vans_1_cert", "e2e_q_vol_cert", "e2e_vol_inv_1", "Yes"],
			["e2e_vans_1_avail", "e2e_q_vol_avail", "e2e_vol_inv_1", "Both Days"],
			// Grace: no cert, saturday only
			["e2e_vans_2_cert", "e2e_q_vol_cert", "e2e_vol_inv_2", "No"],
			["e2e_vans_2_avail", "e2e_q_vol_avail", "e2e_vol_inv_2", "Saturday Only"],
			// Hank: no cert, both days
			["e2e_vans_3_cert", "e2e_q_vol_cert", "e2e_vol_inv_3", "No"],
			["e2e_vans_3_avail", "e2e_q_vol_avail", "e2e_vol_inv_3", "Both Days"],
		]

		for (const [id, questionId, invitationId, answer] of volunteerAnswers) {
			await connection.execute(
				`INSERT IGNORE INTO \`volunteer_registration_answers\` (id, question_id, invitation_id, answer, created_at, updated_at, update_counter)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[id, questionId, invitationId, answer, ts, ts, 0],
			)
		}

		console.log(`  volunteers: ${volunteerUsers.length} users + ${volunteerAnswers.length} answers inserted`)

		console.log("\nE2E seed complete!")
	} finally {
		await connection.end()
	}
}

main().catch((err) => {
	console.error("Fatal error:", err)
	process.exit(1)
})
