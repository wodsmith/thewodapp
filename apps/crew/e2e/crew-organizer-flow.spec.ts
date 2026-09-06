import { expect, test } from "@playwright/test"
import { loginAsTestUser, waitForHydration } from "./fixtures/auth"
import { TEST_DATA } from "./fixtures/test-data"

const demo = TEST_DATA.crewDemo

test.describe("Crew organizer scheduling flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  // @lat: [[crew#Scheduling Launch Scope]]
  test("keeps retired communications and event-day pages in scheduling", async ({ page }) => {
    for (const route of ["messages", "day-of"]) {
      await page.goto(`/events/${demo.eventId}/${route}`)
      await waitForHydration(page)
      await expect(page).toHaveURL(new RegExp(`/events/${demo.eventId}/shifts$`))
      await expect(page.getByRole("link", { name: "Confirmations", exact: true })).toHaveCount(0)
      await expect(page.getByRole("link", { name: "Event Day", exact: true })).toHaveCount(0)
      await expect(page.getByRole("link", { name: "Export Schedule", exact: true })).toBeVisible()
    }
  })
})
