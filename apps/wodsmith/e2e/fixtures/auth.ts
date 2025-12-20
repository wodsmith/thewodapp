/**
 * Authentication fixtures for E2E tests
 * Provides helpers for logging in and managing authenticated browser contexts
 */

import type { Page } from "@playwright/test"

/**
 * Test user credentials configuration
 */
export const TEST_USER = {
	email: "test@wodsmith.com",
	password: "TestPassword123!",
} as const

/**
 * Helper to login as test user
 * @param page - Playwright page object
 * @returns Promise that resolves when login is complete
 */
export async function loginAsTestUser(page: Page): Promise<void> {
	await page.goto("/sign-in")
	await page.fill('input[type="email"]', TEST_USER.email)
	await page.fill('input[type="password"]', TEST_USER.password)
	await page.click('button[type="submit"]')

	// Wait for redirect after successful login
	await page.waitForURL("/workouts", { timeout: 5000 })
}

/**
 * Helper to create authenticated browser context with session storage
 * Useful for tests that need to start with an authenticated state
 * @param page - Playwright page object
 * @returns Promise that resolves when authentication context is set up
 */
export async function createAuthenticatedContext(page: Page): Promise<void> {
	await loginAsTestUser(page)

	// Verify we're actually authenticated by checking for user-specific elements
	// This ensures the session is fully established before tests run
	await page.waitForSelector('[data-testid="user-menu"]', { timeout: 5000 })
}

/**
 * Helper to logout current user
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
	// Navigate to logout endpoint or trigger logout action
	await page.goto("/api/auth/logout")
	// Wait for redirect to sign-in page
	await page.waitForURL("/sign-in", { timeout: 5000 })
}
