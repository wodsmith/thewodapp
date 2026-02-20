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
	await page.goto("/sign-in", { waitUntil: 'domcontentloaded' })

	if (!page.url().includes('/sign-in')) {
		return
	}

	const signInButton = page.getByRole("button", { name: "Sign In" })
	await signInButton.waitFor({ state: 'visible', timeout: 15000 })

	// Placeholders: "name@example.com" and "Enter your password"
	await page.getByPlaceholder("name@example.com").fill(credentials.email)
	await page.getByPlaceholder("Enter your password").fill(credentials.password)

	await signInButton.click()

	// After login, app redirects to "/" (REDIRECT_AFTER_SIGN_IN)
	await page.waitForURL(/^https?:\/\/[^/]+(\/)?$/, {
		timeout: 15000,
	})

	await page.waitForLoadState('domcontentloaded')

	let attempts = 0
	const maxAttempts = 20
	while (attempts < maxAttempts) {
		const cookies = await page.context().cookies()
		if (cookies.some(c => c.name === 'session')) {
			break
		}
		await page.waitForTimeout(100)
		attempts++
	}
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
 * 
 * Admin login requires extra care because admin routes have strict session validation.
 * We verify the session is fully established before returning.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
	await login(page, {
		email: ADMIN_USER.email,
		password: ADMIN_USER.password,
	})

	// Extra verification for admin login - wait for session to be fully established
	// The admin needs the session to be properly set before accessing /admin routes
	await page.waitForLoadState('domcontentloaded')

	// Verify the session cookie exists before proceeding
	// This is critical for admin routes which redirect to sign-in if no session
	const cookies = await page.context().cookies()
	const sessionCookie = cookies.find(c => c.name === 'session')
	
	if (!sessionCookie) {
		// If no session cookie, the login may have failed silently
		// Try to verify by checking if we're on an authenticated page
		const url = page.url()
		if (url.includes('/sign-in')) {
			throw new Error('Admin login failed - still on sign-in page')
		}
	}
}

/**
 * Logout the current user
 *
 * LogoutButton has aria-label="Log out". After logout, app redirects to /sign-in.
 */
export async function logout(page: Page): Promise<void> {
	const logoutButton = page.getByRole('button', { name: 'Log out' })
	await logoutButton.click()
	await page.waitForURL(/\/sign-in/, { timeout: 10000 })
}

/**
 * Check if the current page shows authenticated state
 *
 * Looks for the logout button which only appears when authenticated.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
	try {
		await page.waitForSelector(
			'button[aria-label="Log out"]',
			{ timeout: 5000 },
		)
		return true
	} catch {
		return false
	}
}
