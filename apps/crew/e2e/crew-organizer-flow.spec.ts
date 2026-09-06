import { expect, test } from "@playwright/test"
import { loginAsTestUser, waitForHydration } from "./fixtures/auth"
import { cleanupCrewScheduleTestEvent, requireCrewScheduleTestDatabase } from "./fixtures/crew-schedule-cleanup"
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

  // @lat: [[crew#Crew Launch Verification]]
  test("creates a volunteer schedule and requires purchase before exporting", async ({ page }) => {
    const databaseUrl = requireCrewScheduleTestDatabase()
    const eventName = `Crew launch ${crypto.randomUUID()}`
    try {
      await page.goto("/events/new")
      await waitForHydration(page)
      await page.getByLabel("Event name", { exact: true }).fill(eventName)
      await page.getByRole("button", { name: "Create Crew event" }).click()
      await expect(page.getByRole("heading", { name: eventName })).toBeVisible()
      const eventPath = new URL(page.url()).pathname.replace(/\/$/, "")
      await expect(page.getByRole("heading", { name: "Import volunteers" })).toBeVisible()
      await page.getByRole("link", { name: "Import volunteers", exact: true }).click()
      await page.getByRole("button", { name: "Add volunteer", exact: true }).click()
      const volunteerDialog = page.getByRole("dialog", { name: "Add volunteer" })
      await volunteerDialog.getByRole("textbox", { name: "Name", exact: true }).fill("Launch Volunteer")
      await volunteerDialog.getByRole("checkbox", { name: "Judge", exact: true }).check()
      await volunteerDialog.getByRole("button", { name: "Add volunteer", exact: true }).click()
      await expect(volunteerDialog).not.toBeVisible()
      await expect(page.getByRole("table").getByText("Launch Volunteer", { exact: true })).toBeVisible()

      await page.getByRole("link", { name: "Volunteer Shifts", exact: true }).click()
      await page.getByRole("button", { name: "Add shift", exact: true }).click()
      const shiftDialog = page.getByRole("dialog", { name: "Add shift" })
      await shiftDialog.getByRole("textbox", { name: "Shift Name", exact: true }).fill("Morning judges")
      await shiftDialog.getByRole("combobox", { name: "Role Type" }).click()
      await page.getByRole("option", { name: "Judge", exact: true }).click()
      await shiftDialog.getByRole("button", { name: "Create shift", exact: true }).click()
      await expect(shiftDialog).not.toBeVisible()
      const shiftRow = page.getByRole("row").filter({ hasText: "Morning judges" })
      await shiftRow.click()
      const assignments = page.getByRole("dialog", { name: "Morning judges" })
      await assignments.getByRole("button", { name: "Add Launch Volunteer", exact: true }).click()
      await expect(assignments.getByText("1/1 assigned")).toBeVisible()
      await assignments.getByRole("button", { name: "Close", exact: true }).click()

      await page.getByRole("link", { name: "Export Schedule", exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${eventPath}/billing$`))
      await expect(page.getByRole("heading", { name: "Purchase event access" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Checkout unavailable" })).toBeDisabled()
      await expect(page.getByRole("button", { name: "Master CSV" })).toHaveCount(0)

      await page.goto(`${eventPath}/billing?crew_checkout=success`)
      await expect(page.getByText(/We are waiting for payment confirmation/)).toBeVisible()
      await page.getByRole("link", { name: "Export Schedule", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Purchase event access" })).toBeVisible()
      await page.goto(`${eventPath}/billing?crew_checkout=canceled`)
      await expect(page.getByText(/Checkout was canceled. Your schedule is saved/)).toBeVisible()
      await page.getByRole("link", { name: "Continue editing your schedule" }).click()
      await expect(page.getByRole("row").filter({ hasText: "Morning judges" })).toContainText("1 / 1")
    } finally {
      await cleanupCrewScheduleTestEvent(databaseUrl, eventName)
    }
  })


  test("exports the schedule for an event with active access", async ({ page }) => {
    await page.goto(`/events/${demo.eventId}/billing`)
    await waitForHydration(page)
    await expect(page.getByRole("heading", { name: "Your event access is active" })).toBeVisible()
    await page.getByRole("link", { name: "Export schedule", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Print packet", exact: true })).toBeVisible()
    await waitForHydration(page)
    const downloaded = page.waitForEvent("download")
    await page.getByRole("button", { name: "Master CSV", exact: true }).click()
    const download = await downloaded
    expect(download.suggestedFilename()).toBe(`${demo.slug}-master-schedule.csv`)
    const stream = await download.createReadStream()
    if (!stream) throw new Error("Schedule download did not provide a readable stream")
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).toString("utf8")).toContain(demo.volunteerName)
  })

})
