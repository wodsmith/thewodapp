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
 *
 * Crew does not expose the full WODsmith Start sign-in screen yet. For E2E,
 * ask the app's guarded test endpoint to mint the same session cookie the auth
 * server function creates after password sign-in.
 */
export async function login(
	page: Page,
	credentials: { email: string; password: string },
): Promise<void> {
	const userId = getUserIdForCredentials(credentials)
	const response = await page.request.post("/api/e2e/session", {
		data: { userId },
	})

	if (!response.ok()) {
		throw new Error(
			`E2E session bootstrap failed with ${response.status()}: ${await response.text()}`,
		)
	}

	// Wait for session cookie to be set
	let attempts = 0
	const maxAttempts = 30
	while (attempts < maxAttempts) {
		const cookies = await page.context().cookies()
		if (cookies.some(c => c.name === 'session')) {
			return
		}
		await page.waitForTimeout(100)
		attempts++
	}

	throw new Error("E2E session bootstrap did not set a session cookie")
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

function getUserIdForCredentials(credentials: {
	email: string
	password: string
}) {
	if (
		credentials.email === TEST_USER.email &&
		credentials.password === TEST_USER.password
	) {
		return TEST_USER.id
	}

	if (
		credentials.email === ADMIN_USER.email &&
		credentials.password === ADMIN_USER.password
	) {
		return ADMIN_USER.id
	}

	throw new Error(`No seeded E2E user matches ${credentials.email}`)
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
 * Wait for React hydration on the current page.
 * Checks that at least one interactive element has React fibers attached,
 * which means React has mounted and event handlers are active.
 * Call this after page.goto() before interacting with JS-dependent components
 * (Radix Select, Popover, Dialog, etc.).
 */
export async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(
		() => {
			const el = document.querySelector('button, [role="combobox"], input, a')
			return el && Object.keys(el).some(k => k.startsWith('__reactFiber'))
		},
		{ timeout: 15000 },
	)
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
