/**
 * Dashboard page object (Admin page serves as main dashboard)
 * Encapsulates dashboard navigation and common interactions
 */

import { expect, type Page } from "@playwright/test"

export class DashboardPage {
	constructor(private readonly page: Page) {}

	// Navigation selectors
	readonly userMenu = () => this.page.locator('[data-testid="user-menu"]')
	readonly navigation = () => this.page.locator("nav")
	readonly workoutsLink = () => this.page.getByRole("link", { name: /workouts/i })
	readonly adminLink = () => this.page.getByRole("link", { name: /admin/i })
	readonly teamsLink = () => this.page.getByRole("link", { name: /teams/i })
	readonly settingsLink = () =>
		this.page.getByRole("link", { name: /settings/i })

	// Dashboard-specific selectors (for /admin page)
	readonly dashboardTitle = () =>
		this.page.getByRole("heading", { name: /admin dashboard/i })
	readonly quickActionsCard = () =>
		this.page.getByRole("heading", { name: /quick actions/i })
	readonly statsSection = () =>
		this.page.getByRole("heading", { name: /quick stats/i })

	/**
	 * Navigate to dashboard (admin page)
	 */
	async goto(): Promise<void> {
		await this.page.goto("/admin")
	}

	/**
	 * Navigate to workouts page
	 */
	async goToWorkouts(): Promise<void> {
		await this.workoutsLink().click()
		await this.page.waitForURL("/workouts", { timeout: 5000 })
	}

	/**
	 * Navigate to teams management
	 */
	async goToTeams(): Promise<void> {
		await this.teamsLink().click()
		await this.page.waitForURL(/\/admin\/teams/, { timeout: 5000 })
	}

	/**
	 * Navigate to settings
	 */
	async goToSettings(): Promise<void> {
		await this.settingsLink().click()
		await this.page.waitForURL(/\/settings/, { timeout: 5000 })
	}

	/**
	 * Assert that we're on the dashboard page
	 */
	async assertOnDashboard(): Promise<void> {
		// Wait for page to load
		await this.page.waitForURL("/admin", { timeout: 5000 })

		// Verify dashboard title is visible
		await expect(this.dashboardTitle()).toBeVisible()

		// Verify quick actions section exists
		await expect(this.quickActionsCard()).toBeVisible()

		// Verify user menu is visible (authenticated state)
		await expect(this.userMenu()).toBeVisible()
	}

	/**
	 * Open user menu dropdown
	 */
	async openUserMenu(): Promise<void> {
		await this.userMenu().click()
		// Wait for menu to be visible
		await this.page.waitForSelector('[role="menu"]', { timeout: 2000 })
	}

	/**
	 * Logout from user menu
	 */
	async logout(): Promise<void> {
		await this.openUserMenu()
		const logoutButton = this.page.getByRole("menuitem", { name: /logout/i })
		await logoutButton.click()
		// Wait for redirect to sign-in
		await this.page.waitForURL("/sign-in", { timeout: 5000 })
	}

	/**
	 * Get visible navigation links
	 * Useful for asserting which navigation items are available to current user
	 */
	async getNavigationLinks(): Promise<string[]> {
		const links = await this.navigation().locator("a").allTextContents()
		return links.filter((text) => text.trim().length > 0)
	}

	/**
	 * Assert that specific navigation link is visible
	 * @param linkName - Name of the link to check
	 */
	async assertNavigationLinkVisible(linkName: string): Promise<void> {
		const link = this.page.getByRole("link", { name: new RegExp(linkName, "i") })
		await expect(link).toBeVisible()
	}

	/**
	 * Assert that specific navigation link is NOT visible
	 * @param linkName - Name of the link to check
	 */
	async assertNavigationLinkHidden(linkName: string): Promise<void> {
		const link = this.page.getByRole("link", { name: new RegExp(linkName, "i") })
		await expect(link).not.toBeVisible()
	}

	/**
	 * Wait for dashboard to finish loading
	 * Useful after navigation or page reload
	 */
	async waitForLoad(): Promise<void> {
		// Wait for main content to be visible
		await expect(this.dashboardTitle()).toBeVisible()
		// Wait for any loading spinners to disappear
		await this.page.waitForLoadState("networkidle")
	}
}
