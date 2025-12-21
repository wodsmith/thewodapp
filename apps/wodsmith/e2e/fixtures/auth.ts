/**
 * Authentication fixtures for E2E tests
 *
 * Provides helpers for logging in and managing authenticated browser contexts.
 * Uses credentials from the seeded test database (seed-e2e.sql).
 */

import type { Page } from "@playwright/test"
import { TEST_DATA } from "./test-data"

/**
 * Default test user credentials (from seed-e2e.sql)
 */
export const TEST_USER = TEST_DATA.users.testUser
export const ADMIN_USER = TEST_DATA.users.adminUser

/**
 * Login with specified credentials
 */
export async function login(
	page: Page,
	credentials: { email: string; password: string },
): Promise<void> {
	await page.goto("/sign-in")

	// Fill in the login form
	await page.getByPlaceholder(/email/i).fill(credentials.email)
	await page.getByPlaceholder(/password/i).fill(credentials.password)

	// Submit the form
	await page.getByRole("button", { name: /sign in/i }).click()

	// Wait for redirect after successful login
	// The app redirects to /workouts after login
	await page.waitForURL(/\/(workouts|dashboard)/, { timeout: 10000 })
}

/**
 * Login as the default test user
 */
export async function loginAsTestUser(page: Page): Promise<void> {
	await login(page, {
		email: TEST_USER.email,
		password: TEST_USER.password,
	})
}

/**
 * Login as the admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
	await login(page, {
		email: ADMIN_USER.email,
		password: ADMIN_USER.password,
	})
}

/**
 * Create an authenticated browser context with session storage
 * Useful for tests that need to start with an authenticated state
 */
export async function createAuthenticatedContext(page: Page): Promise<void> {
	await loginAsTestUser(page)

	// Verify we're actually authenticated by checking for user-specific elements
	// Wait for any authenticated page element to appear
	await page.waitForSelector(
		'[data-testid="user-menu"], [data-testid="team-switcher"], nav',
		{ timeout: 10000 },
	)
}

/**
 * Logout the current user
 */
export async function logout(page: Page): Promise<void> {
	// Try to find and click logout in user menu
	const userMenu = page.getByTestId("user-menu")
	if (await userMenu.isVisible()) {
		await userMenu.click()
		await page.getByRole("menuitem", { name: /log out|sign out/i }).click()
	} else {
		// Fallback: navigate directly to logout endpoint
		await page.goto("/api/auth/logout")
	}

	// Wait for redirect to login page
	await page.waitForURL(/\/(login|sign-in)/, { timeout: 5000 })
}

/**
 * Check if the current page shows authenticated state
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
	try {
		await page.waitForSelector(
			'[data-testid="user-menu"], [data-testid="team-switcher"]',
			{ timeout: 2000 },
		)
		return true
	} catch {
		return false
	}
}
