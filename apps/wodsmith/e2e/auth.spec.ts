import { test, expect } from "@playwright/test"

/**
 * Authentication E2E Tests
 *
 * Tests authentication flows including login, logout, and redirect behavior.
 * Uses fixtures from e2e/fixtures/ and page objects from e2e/pages/
 */

test.describe("Authentication", () => {
	const baseURL = "http://localhost:3000"
	const validEmail = "test@example.com"
	const validPassword = "password123"
	const invalidPassword = "wrongpassword"

	test("should show login page", async ({ page }) => {
		await page.goto("/login")

		// Verify page loaded
		await expect(page).toHaveURL(`${baseURL}/login`)

		// Verify form elements are visible
		await expect(
			page.getByRole("heading", { name: /sign in/i }),
		).toBeVisible()
		await expect(page.getByLabel(/email/i)).toBeVisible()
		await expect(page.getByLabel(/password/i)).toBeVisible()
		await expect(
			page.getByRole("button", { name: /sign in/i }),
		).toBeVisible()
	})

	test("should redirect unauthenticated users to login", async ({ page }) => {
		// Visit protected route without authentication
		await page.goto("/dashboard")

		// Should redirect to login
		await expect(page).toHaveURL(`${baseURL}/login`)

		// Should show login form
		await expect(
			page.getByRole("heading", { name: /sign in/i }),
		).toBeVisible()
	})

	test("should login with valid credentials", async ({ page }) => {
		await page.goto("/login")

		// Fill in the login form
		await page.getByLabel(/email/i).fill(validEmail)
		await page.getByLabel(/password/i).fill(validPassword)

		// Submit the form
		await page.getByRole("button", { name: /sign in/i }).click()

		// Should redirect to dashboard after successful login
		await expect(page).toHaveURL(`${baseURL}/dashboard`)

		// Verify we're authenticated (dashboard content should be visible)
		await expect(
			page.getByRole("heading", { name: /dashboard/i }),
		).toBeVisible()
	})

	test("should show error for invalid credentials", async ({ page }) => {
		await page.goto("/login")

		// Fill in the login form with wrong password
		await page.getByLabel(/email/i).fill(validEmail)
		await page.getByLabel(/password/i).fill(invalidPassword)

		// Submit the form
		await page.getByRole("button", { name: /sign in/i }).click()

		// Should stay on login page
		await expect(page).toHaveURL(`${baseURL}/login`)

		// Should show error message
		await expect(
			page.getByText(/invalid email or password/i),
		).toBeVisible()
	})

	test("should logout successfully", async ({ page }) => {
		// First, login
		await page.goto("/login")
		await page.getByLabel(/email/i).fill(validEmail)
		await page.getByLabel(/password/i).fill(validPassword)
		await page.getByRole("button", { name: /sign in/i }).click()

		// Wait for redirect to dashboard
		await expect(page).toHaveURL(`${baseURL}/dashboard`)

		// Click logout button
		await page.getByRole("button", { name: /log out|sign out/i }).click()

		// Should redirect to login page
		await expect(page).toHaveURL(`${baseURL}/login`)

		// Verify we're logged out by trying to access dashboard
		await page.goto("/dashboard")
		await expect(page).toHaveURL(`${baseURL}/login`)
	})
})
