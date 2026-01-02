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
	// Navigate to sign-in page and wait for network to settle
	await page.goto("/sign-in", { waitUntil: 'networkidle' })

	// Check if already authenticated (server-side redirect to workouts)
	// This happens when the user has a valid session cookie
	if (!page.url().includes('/sign-in')) {
		// Already logged in, redirected away from sign-in
		return
	}

	// Check if the sign-in button exists (page might still be redirecting)
	const signInButton = page.getByRole("button", { name: "SIGN IN", exact: true })
	if (!(await signInButton.isVisible({ timeout: 2000 }).catch(() => false))) {
		// No sign-in button visible, we're probably already authenticated
		return
	}

	// Fill in the login form
	await page.getByPlaceholder(/email/i).fill(credentials.email)
	await page.getByPlaceholder(/password/i).fill(credentials.password)

	// Submit the form
	await signInButton.click()

	// Wait for redirect after successful login
	// The app redirects to /workouts after login
	await page.waitForURL(/\/(workouts|dashboard)/, { 
		timeout: 10000,
		waitUntil: 'networkidle'
	})

	// Wait for network to settle and session to be fully established
	// This ensures cookies are set before navigating to protected routes
	await page.waitForLoadState('networkidle')
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

	// Extra verification for admin login - wait for session to be fully established
	// The admin needs the session to be properly set before accessing /admin routes
	await page.waitForLoadState('networkidle')
}

/**
 * Create an authenticated browser context with session storage
 * Useful for tests that need to start with an authenticated state
 */
export async function createAuthenticatedContext(page: Page): Promise<void> {
	await loginAsTestUser(page)

	// Verify we're actually authenticated by checking for user-specific elements
	// Wait for authenticated nav links to appear
	await page.waitForSelector(
		'nav a[href="/log"], nav a[href="/teams"]',
		{ timeout: 10000 },
	)
}

/**
 * Logout the current user
 * 
 * The app uses a LogoutButton component that triggers signOutAction server action.
 * The button only has a LogOut icon, so we find it by role and position in the nav.
 * After logout, the app redirects to /compete.
 */
export async function logout(page: Page): Promise<void> {
	// The logout button is in the nav, appears after other nav items
	// It's a button with a LogOut icon (no text)
	// On desktop, find it in the main nav
	const logoutButton = page.locator('nav button').filter({ has: page.locator('svg.lucide-log-out') }).first()
	
	if (await logoutButton.isVisible({ timeout: 2000 })) {
		await logoutButton.click()
	} else {
		// On mobile, might need to open menu first
		const mobileMenuButton = page.getByRole('button', { name: /menu/i })
		if (await mobileMenuButton.isVisible()) {
			await mobileMenuButton.click()
			// Look for logout in mobile menu
			const mobileLogout = page.locator('button').filter({ has: page.locator('svg.lucide-log-out') }).first()
			await mobileLogout.click()
		}
	}

	// The app redirects to /compete after logout (see useSignOut hook)
	// Wait for navigation away from the authenticated page
	await page.waitForURL(/\/(compete|sign-in|login)/, { timeout: 5000 })
}

/**
 * Check if the current page shows authenticated state
 *
 * We check for authenticated-only UI elements:
 * - Navigation links that only appear when logged in (Log, Team, etc.)
 * - Settings link in the nav
 * - The logout button
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
	try {
		// Look for nav elements that only appear when authenticated
		// The main nav shows "LOG" and "TEAM" links only for authenticated users
		await page.waitForSelector(
			'nav a[href="/log"], nav a[href="/teams"], nav a[href="/settings"]',
			{ timeout: 2000 },
		)
		return true
	} catch {
		return false
	}
}
