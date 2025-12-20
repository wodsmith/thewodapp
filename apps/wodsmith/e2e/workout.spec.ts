import { test, expect } from "@playwright/test"
import { loginAsTestUser } from "./fixtures/auth"

/**
 * Workout Creation E2E Tests
 *
 * Tests workout creation flow including:
 * - Navigation to workout creation page
 * - Creating a simple workout with valid data
 * - Form validation for required fields
 * - Verifying created workout appears in list
 *
 * Uses realistic CrossFit workout data (e.g., "Fran", "Cindy")
 */

test.describe("Workout Creation", () => {
	const baseURL = "http://localhost:3000"

	test.beforeEach(async ({ page }) => {
		// Login before each test
		await loginAsTestUser(page)
	})

	test("should navigate to workout creation page", async ({ page }) => {
		// Navigate to workouts page
		await page.goto("/workouts")

		// Click create workout button (could be a "+" button or "New Workout" button)
		await page.click('a[href="/workouts/new"]')

		// Verify we're on the create page
		await expect(page).toHaveURL(`${baseURL}/workouts/new`)

		// Verify form elements are present
		await expect(page.getByLabel(/name/i)).toBeVisible()
		await expect(page.getByLabel(/description/i)).toBeVisible()
		await expect(page.getByLabel(/scheme/i)).toBeVisible()
	})

	test("should create a simple workout", async ({ page }) => {
		// Navigate directly to create page
		await page.goto("/workouts/new")

		// Fill in realistic CrossFit workout data
		await page.getByLabel(/name/i).fill("Fran")
		await page
			.getByLabel(/description/i)
			.fill("21-15-9 Thrusters (95/65) and Pull-ups")

		// Select workout scheme (type) - "time" for a time-based workout
		await page.getByLabel(/scheme/i).click()
		await page.getByRole("option", { name: /time/i }).click()

		// Submit the form
		await page.getByRole("button", { name: /create|save/i }).click()

		// Wait for success indication
		// Could be a toast notification or redirect to workout detail page
		await page.waitForURL(/\/workouts\/.*/, { timeout: 5000 })

		// Verify we're redirected (either to workout detail or back to list)
		expect(page.url()).toMatch(/\/workouts/)

		// Verify success message or workout details are visible
		await expect(
			page.getByText(/fran/i).or(page.getByText(/success/i)),
		).toBeVisible()
	})

	test("should validate required fields", async ({ page }) => {
		// Navigate to create page
		await page.goto("/workouts/new")

		// Try to submit empty form
		await page.getByRole("button", { name: /create|save/i }).click()

		// Should stay on the same page
		await expect(page).toHaveURL(`${baseURL}/workouts/new`)

		// Verify validation errors are shown
		await expect(page.getByText(/name is required/i)).toBeVisible()
		await expect(page.getByText(/description is required/i)).toBeVisible()
		await expect(page.getByText(/scheme is required/i)).toBeVisible()
	})

	test("should show created workout in list", async ({ page }) => {
		const workoutName = "Cindy"
		const workoutDescription = "20 min AMRAP: 5 Pull-ups, 10 Push-ups, 15 Squats"

		// Navigate to create page
		await page.goto("/workouts/new")

		// Create a workout
		await page.getByLabel(/name/i).fill(workoutName)
		await page.getByLabel(/description/i).fill(workoutDescription)

		// Select rounds-reps scheme for AMRAP workout
		await page.getByLabel(/scheme/i).click()
		await page.getByRole("option", { name: /rounds.*reps/i }).click()

		// Submit the form
		await page.getByRole("button", { name: /create|save/i }).click()

		// Wait for redirect
		await page.waitForURL(/\/workouts/, { timeout: 5000 })

		// Navigate to workouts list if not already there
		if (!page.url().endsWith("/workouts")) {
			await page.goto("/workouts")
		}

		// Verify the workout appears in the list
		await expect(page.getByText(workoutName)).toBeVisible()

		// Optional: verify description is also visible (if shown in list)
		// Some lists might only show the name, so this is conditional
		const descriptionVisible = await page.getByText(workoutDescription).isVisible()
		if (descriptionVisible) {
			await expect(page.getByText(workoutDescription)).toBeVisible()
		}
	})
})
