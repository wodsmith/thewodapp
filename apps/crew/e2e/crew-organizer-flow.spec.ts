// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Day Of Operations Board]]
import { expect, test, type Page } from "@playwright/test"
import { loginAsTestUser, waitForHydration } from "./fixtures/auth"
import { TEST_DATA } from "./fixtures/test-data"

const demo = TEST_DATA.crewDemo

test.describe("Crew organizer demo flow", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsTestUser(page)
	})

	test("shows seeded confirmation and day-of workflow data", async ({
		page,
	}) => {
		await page.goto(`/events/${demo.eventId}/messages`)
		await waitForHydration(page)

		await expect(
			page.getByRole("heading", { name: "Confirmations" }),
		).toBeVisible({ timeout: 15000 })
		await expect(
			page.getByText(`${demo.shiftAssignments} assignments,`),
		).toBeVisible()
		await expectPanelWithNonZeroValue(page, "Sent")
		await expectPanelWithNonZeroValue(page, "Confirmed")
		await expectPanelWithNonZeroValue(page, "Declined")
		await expectPanelWithNonZeroValue(page, "No response")
		await expect(
			page.getByRole("heading", { name: "Event-day outcomes" }),
		).toBeVisible()
		await expect(page.getByText(demo.noShowShiftName)).toBeVisible()

		await page.goto(`/events/${demo.eventId}/day-of`)
		await waitForHydration(page)

		await expect(
			page.getByRole("heading", { name: "Day-of operations" }),
		).toBeVisible({ timeout: 15000 })
		await expectPanelWithNonZeroValue(page, "Open roles")
		await expectPanelWithNonZeroValue(page, "No-show / replaced")
		await expectPanelWithNonZeroValue(page, "Judge lanes open")
		await expectLabeledValue(page, "No-shows", "1")
		await expectLabeledValue(page, "Active judge versions", "3")
		await expectLabeledValue(page, "Shift assignments", String(demo.shiftAssignments))
		await expect(
			page.getByRole("heading", { name: "Assignment actions" }),
		).toBeVisible()
		await expect(
			page.locator("section").filter({
				has: page.getByRole("heading", { name: "Assignment actions" }),
			}).last(),
		).toContainText(demo.shiftAssignmentName)
		await expect(
			page.getByRole("heading", { name: "No-shows and replacements" }),
		).toBeVisible()
	})
})

async function expectPanelWithNonZeroValue(page: Page, label: string) {
	await expect(
		page.getByRole("main").filter({
			hasText: new RegExp(`${escapeRegExp(label)}\\s*[1-9]\\d*`),
		}).first(),
	).toBeVisible()
}

async function expectLabeledValue(page: Page, label: string, value: string) {
	await expect(
		page.locator("div").filter({
			hasText: new RegExp(`${escapeRegExp(label)}\\s*${escapeRegExp(value)}`),
		}).first(),
	).toBeVisible()
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
