import { expect, test } from "@playwright/test"
import { loginAsTestUser } from "./fixtures/auth"
import { TEST_DATA } from "./fixtures/test-data"

/**
 * Workout E2E Tests
 *
 * Tests workout viewing and creation using seeded test data.
 * The database is seeded with test workouts (Fran, Murph, Cindy) via globalSetup.
 *
 * NOTE: The workouts page shows BOTH team-specific workouts AND public workouts.
 * This means we need to use precise selectors to match our E2E test workouts
 * specifically, as there may be other public workouts with similar names.
 */

/**
 * Helper to get a workout card by exact name match.
 * The workout name appears in a <p> tag with specific styling inside a link.
 * Using getByRole('link') with name that starts with the workout name ensures
 * we match the workout card link, not just any text on the page.
 */
function getWorkoutCardByName(page: import("@playwright/test").Page, name: string) {
	// Match a link that contains the workout name at the start
	// The link text includes the workout name followed by description preview
	return page.getByRole("link", { name: new RegExp(`^${name}`) }).first()
}

test.describe("Workouts", () => {
	test.beforeEach(async ({ page }) => {
		// Login before each test
		await loginAsTestUser(page)
	})

	test.describe("Viewing Workouts", () => {
		test("should display seeded workouts in list", async ({ page }) => {
			await page.goto("/workouts")

			// Verify seeded workouts are visible using exact match selectors
			// Use getByRole('link') to match the workout card links specifically
			await expect(getWorkoutCardByName(page, TEST_DATA.workouts.fran.name)).toBeVisible()
			await expect(getWorkoutCardByName(page, TEST_DATA.workouts.murph.name)).toBeVisible()
			await expect(getWorkoutCardByName(page, TEST_DATA.workouts.cindy.name)).toBeVisible()
		})

		test("should navigate to workout detail page", async ({ page }) => {
			await page.goto("/workouts")

			// Click on the Fran workout card (using precise selector)
			await getWorkoutCardByName(page, TEST_DATA.workouts.fran.name).click()

			// Should navigate to workout detail
			await expect(page).toHaveURL(/\/workouts\//)

			// Workout name should be visible on detail page
			// On detail page, the name appears in a heading
			await expect(page.getByRole("heading", { name: TEST_DATA.workouts.fran.name })).toBeVisible()
		})
	})

	test.describe("Creating Workouts", () => {
		test("should navigate to workout creation page", async ({ page }) => {
			await page.goto("/workouts")

			// Click create workout button
			const createButton = page.getByRole("link", { name: /new|create|add/i })
				.or(page.locator('a[href*="/workouts/new"]'))
				.first()

			if (await createButton.isVisible()) {
				await createButton.click()
				await expect(page).toHaveURL(/\/workouts\/new/)
			} else {
				// Navigate directly if button not found
				await page.goto("/workouts/new")
			}

			// Verify form elements are present
			await expect(page.getByLabel(/name/i)).toBeVisible()
		})

		test("should create a new workout", async ({ page }) => {
			const uniqueName = `E2E Test Workout ${Date.now()}`

			await page.goto("/workouts/new")

			// Fill in workout data
			await page.getByLabel(/name/i).fill(uniqueName)

			// Look for description field
			const descField = page.getByLabel(/description/i)
			if (await descField.isVisible()) {
				await descField.fill("E2E test workout description")
			}

			// Try to select workout type/scheme if dropdown exists
			const schemeField = page.getByLabel(/type|scheme/i)
			if (await schemeField.isVisible()) {
				await schemeField.click()
				// Try to select first option
				const firstOption = page.getByRole("option").first()
				if (await firstOption.isVisible()) {
					await firstOption.click()
				}
			}

			// Submit the form
			await page.getByRole("button", { name: /create|save|submit/i }).click()

			// Wait for navigation away from create page
			await page.waitForURL(/\/workouts(?!\/new)/, { timeout: 10000 })

			// Verify workout was created (should be visible on list or detail page)
			await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 })
		})

		test("should show validation errors for empty form", async ({ page }) => {
			await page.goto("/workouts/new")

			// Try to submit without filling anything
			await page.getByRole("button", { name: /create|save|submit/i }).click()

			// Should stay on create page (client-side validation prevents submit)
			await expect(page).toHaveURL(/\/workouts\/new/)

			// Look for any validation message
			const hasValidation = await page
				.locator('[class*="error"], [class*="invalid"], [aria-invalid="true"]')
				.first()
				.isVisible()
				.catch(() => false)

			// Or check for HTML5 validation
			const nameInput = page.getByLabel(/name/i)
			const isInvalid = await nameInput.evaluate(
				(el: HTMLInputElement) => !el.validity.valid,
			)

			// One of these should be true
			expect(hasValidation || isInvalid).toBe(true)
		})
	})

	test.describe("Workout Search/Filter", () => {
		test("should filter workouts by search term", async ({ page }) => {
			await page.goto("/workouts")

			// Look for search input
			const searchInput = page.getByPlaceholder(/search/i)
				.or(page.getByRole("searchbox"))
				.or(page.locator('input[type="search"]'))
				.first()

			if (await searchInput.isVisible()) {
				// Search for "Fran" - note this may also match "War Frank" etc.
				// so we need to verify our specific Fran workout is still visible
				await searchInput.fill("Fran")
				await page.waitForTimeout(500) // Wait for debounce

				// Our E2E Fran workout should be visible
				// Use the precise selector to avoid matching other workouts
				await expect(getWorkoutCardByName(page, TEST_DATA.workouts.fran.name)).toBeVisible()

				// Note: Other workouts containing "fran" (like "War Frank") may also appear
				// This is expected behavior - search matches substring
			}
		})
	})
})
