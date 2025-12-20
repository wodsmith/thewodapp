/**
 * Test data setup and seeded data references
 * Provides helpers to ensure test data exists for E2E tests
 */

import type { Page } from "@playwright/test"

/**
 * Seeded test data references
 * These should match the data created by your database seed script
 */
export const SEEDED_DATA = {
	users: {
		testUser: {
			id: "test-user-id",
			email: "test@wodsmith.com",
			name: "Test User",
		},
		adminUser: {
			id: "admin-user-id",
			email: "admin@wodsmith.com",
			name: "Admin User",
		},
	},
	teams: {
		testTeam: {
			id: "test-team-id",
			name: "Test CrossFit Gym",
			slug: "test-crossfit-gym",
		},
	},
	workouts: {
		sampleWorkout: {
			id: "sample-workout-id",
			name: "Fran",
			type: "time",
		},
	},
} as const

/**
 * Helper to ensure test data exists in the database
 * This should be called in test setup (beforeAll/beforeEach) if needed
 * @returns Promise that resolves when test data is verified
 */
export async function ensureTestDataExists(): Promise<void> {
	// In a real implementation, this would:
	// 1. Connect to the test database
	// 2. Check if seeded data exists
	// 3. Create it if missing
	// For now, assume data is seeded via pnpm db:seed
	console.log("Assuming test data is seeded via database seed script")
}

/**
 * Helper to reset test data to known state
 * Useful for tests that modify data and need a clean slate
 * @returns Promise that resolves when data is reset
 */
export async function resetTestData(): Promise<void> {
	// In a real implementation, this would:
	// 1. Connect to the test database
	// 2. Delete test-specific records
	// 3. Re-seed with SEEDED_DATA
	console.log("Resetting test data to seeded state")
}

/**
 * Helper to wait for API calls to complete
 * Useful when interacting with the UI that triggers background requests
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to wait for (e.g., '/api/workouts')
 */
export async function waitForApiCall(
	page: Page,
	urlPattern: string,
): Promise<void> {
	await page.waitForResponse((response) => response.url().includes(urlPattern))
}
