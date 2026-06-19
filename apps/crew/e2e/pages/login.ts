/**
 * Login page object
 * Encapsulates login page selectors and interactions using Page Object Model pattern
 */

import { expect, type Page } from "@playwright/test"

export class LoginPage {
	constructor(private readonly page: Page) {}

	// Selectors
	readonly emailInput = () => this.page.locator('input[type="email"]')
	readonly passwordInput = () => this.page.locator('input[type="password"]')
	readonly submitButton = () => this.page.locator('button[type="submit"]')
	readonly errorMessage = () => this.page.locator('[role="alert"]')
	readonly forgotPasswordLink = () => this.page.getByText("Forgot password?")
	readonly signUpLink = () => this.page.getByText("Sign up")

	/**
	 * Navigate to login page
	 */
	async goto(): Promise<void> {
		await this.page.goto("/sign-in")
	}

	/**
	 * Perform login with provided credentials
	 * @param email - User email address
	 * @param password - User password
	 */
	async login(email: string, password: string): Promise<void> {
		await this.emailInput().fill(email)
		await this.passwordInput().fill(password)
		await this.submitButton().click()
	}

	/**
	 * Assert that user is logged in
	 * Checks for redirect to expected post-login page
	 */
	async assertLoggedIn(): Promise<void> {
		// Wait for redirect away from login page
		await this.page.waitForURL("/workouts", { timeout: 5000 })

		// Verify we're on the expected page after login
		expect(this.page.url()).toContain("/workouts")

		// Verify user menu or other authenticated UI elements are visible
		await expect(
			this.page.locator('[data-testid="user-menu"]'),
		).toBeVisible()
	}

	/**
	 * Assert that user is logged out
	 * Checks that we're on the login page and no session exists
	 */
	async assertLoggedOut(): Promise<void> {
		// Should be on login page
		expect(this.page.url()).toContain("/sign-in")

		// Login form should be visible
		await expect(this.emailInput()).toBeVisible()
		await expect(this.passwordInput()).toBeVisible()

		// User menu should not exist
		await expect(
			this.page.locator('[data-testid="user-menu"]'),
		).not.toBeVisible()
	}

	/**
	 * Assert that an error message is displayed
	 * @param expectedMessage - Expected error message text (optional)
	 */
	async assertError(expectedMessage?: string): Promise<void> {
		await expect(this.errorMessage()).toBeVisible()

		if (expectedMessage) {
			await expect(this.errorMessage()).toContainText(expectedMessage)
		}
	}

	/**
	 * Click forgot password link
	 */
	async clickForgotPassword(): Promise<void> {
		await this.forgotPasswordLink().click()
		await this.page.waitForURL("/forgot-password", { timeout: 5000 })
	}

	/**
	 * Click sign up link
	 */
	async clickSignUp(): Promise<void> {
		await this.signUpLink().click()
		await this.page.waitForURL("/sign-up", { timeout: 5000 })
	}
}
