import { expect, test } from "@playwright/test"
import { waitForHydration } from "./fixtures/auth"
import { TEST_DATA } from "./fixtures/test-data"

const demo = TEST_DATA.crewDemo

test.describe("Crew volunteer demo flow", () => {
	test("shows a public schedule token and records a response", async ({
		page,
	}) => {
		await page.goto(`/e/${demo.slug}/schedule/${demo.volunteerToken}`)
		await waitForHydration(page)

		await expect(
			page.getByRole("heading", { name: TEST_DATA.competition.name }),
		).toBeVisible({ timeout: 15000 })
		await expect(page.getByText(demo.volunteerName)).toBeVisible()
		await expect(page.getByText(demo.volunteerEmail)).toBeVisible()
		await expect(page.getByText("Preferred roles")).toBeVisible()
		await expect(page.getByText("Judge").first()).toBeVisible()

		const assignment = page
			.locator("article")
			.filter({ hasText: demo.volunteerShiftName })
			.first()
		await expect(assignment).toBeVisible()
		await expect(assignment.getByText("Pending")).toBeVisible()

		await assignment.getByRole("button", { name: "Confirm" }).click()

		await expect(
			assignment.getByText("Confirmed. We'll remind you before your shift."),
		).toBeVisible({ timeout: 15000 })
	})
})
