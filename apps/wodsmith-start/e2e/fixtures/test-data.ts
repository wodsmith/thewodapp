/**
 * E2E Test Data References
 *
 * These constants match the data seeded by scripts/seed-e2e.sql
 * IDs are prefixed with 'e2e_' for easy identification
 *
 * IMPORTANT: Keep these in sync with seed-e2e.sql
 */

import type { Page } from "@playwright/test"

/**
 * Seeded test data - matches seed-e2e.sql exactly
 */
export const TEST_DATA = {
	users: {
		testUser: {
			id: "e2e_test_user",
			email: "test@wodsmith.com",
			password: "TestPassword123!",
			firstName: "Test",
			lastName: "User",
			role: "user" as const,
		},
		adminUser: {
			id: "e2e_admin_user",
			email: "admin@wodsmith.com",
			password: "TestPassword123!",
			firstName: "Admin",
			lastName: "User",
			role: "admin" as const,
		},
	},
	teams: {
		testTeam: {
			id: "e2e_test_team",
			name: "E2E Test Gym",
			slug: "e2e-test-gym",
			type: "gym" as const,
		},
	},
	memberships: {
		ownerMembership: {
			id: "e2e_membership_owner",
			teamId: "e2e_test_team",
			userId: "e2e_test_user",
			roleId: "owner",
		},
		adminMembership: {
			id: "e2e_membership_admin",
			teamId: "e2e_test_team",
			userId: "e2e_admin_user",
			roleId: "admin",
		},
	},
	competition: {
		id: "e2e_competition",
		name: "E2E Test Throwdown",
		slug: "e2e-throwdown",
		teamId: "e2e_test_team",
	},
	divisions: {
		rx: { id: "e2e_div_rx", label: "RX", teamSize: 1 },
		scaled: { id: "e2e_div_scaled", label: "Scaled", teamSize: 1 },
		team: { id: "e2e_div_team", label: "Team of 2", teamSize: 2 },
	},
	workouts: {
		fran: {
			id: "e2e_workout_fran",
			name: "Fran",
			type: "time" as const,
			scheme: "21-15-9",
		},
		murph: {
			id: "e2e_workout_murph",
			name: "Murph",
			type: "time" as const,
			scheme: "Hero WOD",
		},
		cindy: {
			id: "e2e_workout_cindy",
			name: "Cindy",
			type: "amrap" as const,
			duration: 20,
		},
	},
} as const

// Type exports for use in tests
export type TestUser = (typeof TEST_DATA.users)[keyof typeof TEST_DATA.users]
export type TestTeam = (typeof TEST_DATA.teams)[keyof typeof TEST_DATA.teams]
export type TestWorkout =
	(typeof TEST_DATA.workouts)[keyof typeof TEST_DATA.workouts]

/**
 * Helper to wait for API calls to complete
 * Useful when interacting with the UI that triggers background requests
 */
export async function waitForApiCall(
	page: Page,
	urlPattern: string,
): Promise<void> {
	await page.waitForResponse((response) => response.url().includes(urlPattern))
}

/**
 * Helper to wait for navigation to complete
 */
export async function waitForNavigation(
	page: Page,
	urlPattern: string | RegExp,
): Promise<void> {
	await page.waitForURL(urlPattern)
}
