import { expect, test, type Page } from "@playwright/test"
import { loginAsTestUser, waitForHydration } from "./fixtures/auth"
import { TEST_DATA } from "./fixtures/test-data"

const demo = TEST_DATA.crewDemo

test.describe("Crew responsive layouts", () => {
	test.use({ viewport: { width: 390, height: 844 } })

	test.beforeEach(async ({ page }) => {
		await loginAsTestUser(page)
	})

	// @lat: [[ui-library#UI Library#Page coverage contract#Crew organizer evidence#Responsive public header]]
	test("keeps public event navigation inside the mobile viewport", async ({
		page,
	}) => {
		for (const route of ["/events", "/events/new"]) {
			await page.goto(route)
			const navigation = page.getByRole("navigation")

			await expect(
				navigation.getByRole("link", { name: "Calculator" }),
			).toBeVisible()
			await expect(
				navigation.getByRole("link", { name: "Events", exact: true }),
			).toBeVisible()
			await expect(
				navigation.getByRole("link", { name: "New event", exact: true }),
			).toBeVisible()
			await expect(
				page.getByRole("button", { name: "Log out" }),
			).toBeInViewport()
			await expectNoDocumentOverflow(page)
		}
	})

	// @lat: [[ui-library#UI Library#Page coverage contract#Crew organizer evidence#Export table containment and print layout]]
	test("keeps packet tabs inside the page while the schedule table scrolls", async ({
		page,
	}) => {
		await page.goto(`/events/${demo.eventId}/exports?tab=schedule`)
		await expect(
			page.getByRole("heading", { name: "Print packet" }),
		).toBeVisible()

		await expectNoDocumentOverflow(page)
		await waitForHydration(page)
		const scheduleScroller = page
			.getByRole("columnheader", { name: "People" })
			.locator("xpath=ancestor::table[1]/parent::*")
		await expect(scheduleScroller).toBeVisible()
		await expect
			.poll(() =>
				scheduleScroller.evaluate(
					(element) => element.scrollWidth > element.clientWidth,
				),
			)
			.toBe(true)

		for (const tab of [
			{ label: "Judges", search: "judges", columnHeader: "Lane" },
			{ label: "Shifts", search: "shifts", columnHeader: "Volunteer" },
		]) {
			const targetTab = page.getByRole("tab", {
				name: new RegExp(tab.label),
			})
			await targetTab.click()
			await expect(targetTab).toHaveAttribute("aria-selected", "true")
			await expect
				.poll(() => new URL(page.url()).searchParams.get("tab"))
				.toBe(tab.search)
			await expect(
				page.getByRole("columnheader", { name: tab.columnHeader }).first(),
			).toBeVisible()
			await expectNoDocumentOverflow(page)
		}

		await page.emulateMedia({ media: "print" })
		await expect
			.poll(() =>
				page
					.locator("table")
					.first()
					.locator(":scope > thead")
					.evaluate((element) => getComputedStyle(element).display),
			)
			.toBe("table-header-group")
		await expect(page.locator("header.fixed")).toBeHidden()
		await expect(
			page
				.getByRole("heading", { name: "Print packet" })
				.locator("xpath=ancestor::div[1]"),
		).toBeHidden()
	})
})

async function expectNoDocumentOverflow(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		)
		.toBe(true)
}
