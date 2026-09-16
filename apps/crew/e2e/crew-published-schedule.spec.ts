// @lat: [[crew#Crew Launch Verification]]
import { expect, type Page, test } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import mysql, { type RowDataPacket } from "mysql2/promise"
import { loginAsAdmin, loginAsTestUser, waitForHydration } from "./fixtures/auth"
import { cleanupCrewScheduleTestEvent, requireCrewScheduleTestDatabase } from "./fixtures/crew-schedule-cleanup"
import { TEST_DATA } from "./fixtures/test-data"

const volunteerName = "Casey Launch Volunteer"
const volunteerEmail = "casey-launch@example.com"
const privateNote = "Private organizer note from registration export"
const availability = "Saturday 8:00 AM–12:00 PM; Sunday 1:00 PM–5:00 PM"

test.use({ actionTimeout: 15_000 })
const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
})
test.afterEach(async ({ page }, testInfo) => {
  const path = testInfo.outputPath("browser-errors.json")
  await writeFile(path, JSON.stringify(browserErrors.get(page) ?? [], null, 2))
  await testInfo.attach("browser-errors", { path, contentType: "application/json" })
})
// Synthetic volunteer registration export. Keep the upload independent of the
// implementation's preset so a broken/renamed mapping fails this rehearsal.
const volunteerRegistrationCsv = [
  "Id,First Name,Last Name,Email,Area Code/Country Code,Phone,Age,Birth Date,Gender,Shirt Size,Shorts Size,Shoe Size,Note,Instagram,WhatsApp,Create Date,Shifts,Preference 1,Preference 2,Preference 3",
  ["volunteer-launch-1", "Casey", "Launch Volunteer", volunteerEmail, "1", "5551234567", "31", "1995-01-01", "", "M", "M", "9", privateNote, "", "", "2026-09-01", availability, "Judge", "Check-in", ""].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
].join("\n")

async function gotoHydrated(page: Page, url: string) {
  await page.goto(url)
  await waitForHydration(page)
  await expect(page.getByRole("heading", { name: "Something went wrong", exact: true })).toHaveCount(0)
}

async function uploadVolunteerRegistrationExport(page: Page) {
  await page.getByRole("link", { name: "Import volunteers", exact: true }).click()
  await waitForHydration(page)
  await page.getByLabel("CSV or Excel file", { exact: true }).setInputFiles({
    name: "volunteer-registration-export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(volunteerRegistrationCsv),
  })
  await page.getByRole("button", { name: "Use Volunteer registration export mapping", exact: true }).click()
  await page.getByRole("button", { name: "Build preview", exact: true }).click()
  await expect(page.getByRole("heading", { name: /Preview ready: 1 volunteer/ })).toBeVisible()
  await page.getByRole("button", { name: "Import 1 volunteer", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Your roster is up to date", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Back to roster", exact: true }).click()
  await waitForHydration(page)
  await expect(page.getByRole("table").getByText(volunteerName, { exact: true })).toBeVisible()
}

async function inspectImportedVolunteer(databaseUrl: string, eventId: string) {
  const connection = await mysql.createConnection({ uri: databaseUrl })
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT i.id, i.metadata, i.expires_at, i.accepted_at FROM team_invitations i INNER JOIN competitions c ON c.competition_team_id = i.team_id WHERE c.id = ? AND c.organizing_team_id = ? AND i.email = ?",
      [eventId, "e2e_personal_team_test", volunteerEmail],
    )
    expect(rows).toHaveLength(1)
    return rows[0]!
  } finally {
    await connection.end()
  }
}

async function simulateLegacyDay35Import(databaseUrl: string, eventId: string) {
  const connection = await mysql.createConnection({ uri: databaseUrl })
  try {
    // Scope to this test's event and owner. This models already-imported
    // production volunteers without changing server/browser clocks globally.
    await connection.execute(
      "UPDATE team_invitations i INNER JOIN competitions c ON c.competition_team_id = i.team_id SET i.created_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 35 DAY), i.expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 DAY) WHERE c.id = ? AND c.organizing_team_id = ? AND i.email = ?",
      [eventId, "e2e_personal_team_test", volunteerEmail],
    )
  } finally {
    await connection.end()
  }
}

async function findVolunteer(page: Page, name: string, roleContext?: string) {
  await waitForHydration(page)
  await page.getByLabel("Find your name", { exact: true }).fill(name)
  const results = page.getByRole("button", { name: `View ${name}'s schedule`, exact: true })
  await (roleContext ? results.filter({ hasText: roleContext }) : results).click()
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible()
}

test("imports a volunteer registration export, grants pilot access, and publishes a stable accountless schedule", async ({ page, browser }) => {
  test.setTimeout(180_000)
  const databaseUrl = requireCrewScheduleTestDatabase()
  const eventName = `Fall Throwdown ${crypto.randomUUID().slice(0, 8)}`
  const startDate = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10)
  const endDate = new Date(Date.now() + 46 * 86_400_000).toISOString().slice(0, 10)
  const publicContext = await browser.newContext()
  const publicPage = await publicContext.newPage()
  try {
    await loginAsTestUser(page)
    await gotoHydrated(page, "/events/new")
    await waitForHydration(page)
    await page.getByLabel("Event name", { exact: true }).fill(eventName)
    await page.getByLabel("Start date", { exact: true }).fill(startDate)
    await page.getByLabel("End date", { exact: true }).fill(endDate)
    await page.getByRole("button", { name: "Create Crew event", exact: true }).click()
    await expect(page.getByRole("heading", { name: eventName, exact: true })).toBeVisible()
    const eventPath = new URL(page.url()).pathname.replace(/\/$/, "")
    const eventId = eventPath.split("/").at(-1)!

    await gotoHydrated(page, `${eventPath}/volunteers`)
    await waitForHydration(page)
    await uploadVolunteerRegistrationExport(page)
    const firstImport = await inspectImportedVolunteer(databaseUrl, eventId)
    const firstMetadata = JSON.parse(firstImport.metadata)
    expect(firstMetadata).toMatchObject({ signupName: volunteerName, availabilityNotes: availability, crewImportExternalId: "volunteer-launch-1" })
    expect(firstMetadata.volunteerRoleTypes).toContain("judge")
    // New imports already cover events beyond the former 30-day cutoff.
    expect(new Date(firstImport.expires_at).getTime()).toBeGreaterThan(new Date(`${endDate}T12:00:00Z`).getTime())

    await uploadVolunteerRegistrationExport(page)
    const reimport = await inspectImportedVolunteer(databaseUrl, eventId)
    expect(reimport.id).toBe(firstImport.id)
    expect(reimport.accepted_at).toBeNull()
    await simulateLegacyDay35Import(databaseUrl, eventId)

    await gotoHydrated(page, `${eventPath}/shifts`)
    await waitForHydration(page)
    await page.getByRole("button", { name: "Add shift", exact: true }).click()
    const shiftDialog = page.getByRole("dialog", { name: "Add shift", exact: true })
    await shiftDialog.getByLabel("Shift Name", { exact: true }).fill("Morning judges")
    await shiftDialog.getByRole("combobox", { name: "Role Type", exact: true }).click()
    await page.getByRole("option", { name: "Judge", exact: true }).click()
    await shiftDialog.getByLabel("Start time", { exact: true }).fill("08:00")
    await shiftDialog.getByLabel("End Time", { exact: true }).fill("12:00")
    await shiftDialog.getByLabel("Location (optional)", { exact: true }).fill("North Floor")
    await shiftDialog.getByRole("button", { name: "Create shift", exact: true }).click()
    await expect(shiftDialog).not.toBeVisible()
    await page.getByRole("row").filter({ hasText: "Morning judges" }).click()
    const assignmentDialog = page.getByRole("dialog", { name: "Morning judges", exact: true })
    await assignmentDialog.getByRole("button", { name: `Add ${volunteerName}`, exact: true }).click()
    await expect(assignmentDialog.getByText("1/1 assigned")).toBeVisible()
    await assignmentDialog.getByRole("button", { name: "Close", exact: true }).click()

    await gotoHydrated(page, `${eventPath}/schedule`)
    await expect(page.getByRole("link", { name: "Unlock publishing and printing", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish schedule", exact: true })).toHaveCount(0)
    await gotoHydrated(page, `${eventPath}/exports`)
    await expect(page.getByRole("heading", { name: "Purchase event access", exact: true })).toBeVisible()

    await loginAsAdmin(page)
    await gotoHydrated(page, `/admin/crew/events/${eventId}/billing`)
    await page.getByLabel("Grant reason", { exact: true }).fill("Synthetic browser rehearsal for the first ten pilots")
    await page.getByRole("button", { name: "Grant free event access", exact: true }).click()
    await expect(page.getByText("A pilot grant has already been recorded for this event.")).toBeVisible()
    await loginAsTestUser(page)

    await gotoHydrated(page, `${eventPath}/schedule`)
    await page.getByRole("button", { name: "Publish schedule", exact: true }).click()
    await expect(page.getByLabel("Volunteer schedule link", { exact: true })).toBeVisible()
    const shareUrl = await page.getByLabel("Volunteer schedule link", { exact: true }).inputValue()
    if (process.env.CREW_LAUNCH_SCREENSHOT_DIR) {
      await mkdir(process.env.CREW_LAUNCH_SCREENSHOT_DIR, { recursive: true })
      await findVolunteer(page, volunteerName)
      const closeToast = page.getByRole("button", { name: "Close toast", exact: true })
      for (const button of await closeToast.all()) await button.click()
      await page.screenshot({ path: join(process.env.CREW_LAUNCH_SCREENSHOT_DIR, "crew-organizer-schedule.png"), fullPage: true })
    }
    const response = await publicPage.goto(shareUrl)
    expect(response?.ok()).toBe(true)
    expect(response?.headers()["cache-control"]).toContain("no-store")
    const html = await response!.text()
    expect(html).not.toContain(volunteerEmail)
    expect(html).not.toContain(privateNote)
    await findVolunteer(publicPage, volunteerName)
    await expect(publicPage.getByRole("heading", { name: "Morning judges", exact: true })).toBeVisible()
    await expect(publicPage.getByText("North Floor", { exact: true })).toBeVisible()
    await publicPage.emulateMedia({ media: "print" })
    await expect(publicPage.getByRole("heading", { name: volunteerName, exact: true })).toBeVisible()
    await expect(publicPage.getByRole("heading", { name: "Morning judges", exact: true })).toBeVisible()
    await publicPage.emulateMedia({ media: "screen" })
    if (process.env.CREW_LAUNCH_SCREENSHOT_DIR) {
      await publicPage.setViewportSize({ width: 390, height: 844 })
      await publicPage.screenshot({ path: join(process.env.CREW_LAUNCH_SCREENSHOT_DIR, "crew-volunteer-schedule.png"), fullPage: true })
    }

    await gotoHydrated(page, `${eventPath}/exports`)
    await expect(page.getByRole("heading", { name: "Print packet", exact: true })).toBeVisible()
    await page.emulateMedia({ media: "print" })
    await expect(page.getByRole("cell", { name: "Morning judges", exact: true })).toBeVisible()
    await expect(page.getByRole("cell", { name: volunteerName, exact: true })).toBeVisible()
    await page.emulateMedia({ media: "screen" })

    await gotoHydrated(page, `${eventPath}/shifts`)
    await page.getByRole("button", { name: "Edit Morning judges", exact: true }).click()
    const editDialog = page.getByRole("dialog", { name: "Edit shift", exact: true })
    await editDialog.getByLabel("Shift Name", { exact: true }).fill("Updated morning judges")
    await editDialog.getByRole("button", { name: "Save changes", exact: true }).click()
    await expect(editDialog).not.toBeVisible()
    await publicPage.reload()
    await findVolunteer(publicPage, volunteerName)
    await expect(publicPage.getByRole("heading", { name: "Morning judges", exact: true })).toBeVisible()
    await expect(publicPage.getByRole("heading", { name: "Updated morning judges", exact: true })).toHaveCount(0)

    await gotoHydrated(page, `${eventPath}/schedule`)
    await expect(page.getByRole("heading", { name: "You have unpublished changes", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Publish changes", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Your schedule is published", exact: true })).toBeVisible()
    await expect(page.getByLabel("Volunteer schedule link", { exact: true })).toHaveValue(shareUrl)
    await publicPage.reload()
    await findVolunteer(publicPage, volunteerName)
    await expect(publicPage.getByRole("heading", { name: "Updated morning judges", exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Unpublish", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Your schedule is a draft", exact: true })).toBeVisible()
    await publicPage.reload()
    await expect(publicPage.getByRole("heading", { name: "Schedule not available yet", exact: true })).toBeVisible()
  } finally {
    await publicContext.close()
    await cleanupCrewScheduleTestEvent(databaseUrl, eventName)
  }
})

test("publishes and prints a volunteer's shifts and active judge heat assignments together", async ({ page, browser }) => {
  test.setTimeout(90_000)
  requireCrewScheduleTestDatabase()
  const demo = TEST_DATA.crewDemo
  const publicContext = await browser.newContext()
  const publicPage = await publicContext.newPage()
  try {
    await loginAsTestUser(page)
    await gotoHydrated(page, `/events/${demo.eventId}/schedule`)
    await page.getByRole("button", { name: "Publish schedule", exact: true }).click()
    await expect(page.getByLabel("Volunteer schedule link", { exact: true })).toBeVisible()
    await publicPage.goto(await page.getByLabel("Volunteer schedule link", { exact: true }).inputValue())
    // The seed includes two different people named Grace Martinez. Use the
    // visible role/location context a volunteer uses to choose their own row.
    await findVolunteer(publicPage, demo.volunteerName, "North")
    await expect(publicPage.getByRole("heading", { name: demo.volunteerShiftName, exact: true })).toBeVisible()
    await expect(publicPage.getByText(/Judge · Heat \d+ · Lane \d+/).first()).toBeVisible()
    await publicPage.emulateMedia({ media: "print" })
    await expect(publicPage.getByRole("heading", { name: demo.volunteerShiftName, exact: true })).toBeVisible()
    await expect(publicPage.getByText(/Judge · Heat \d+ · Lane \d+/).first()).toBeVisible()
    await expect(publicPage.getByText(demo.volunteerEmail, { exact: true })).toHaveCount(0)
  } finally {
    await publicContext.close()
    await gotoHydrated(page, `/events/${demo.eventId}/schedule`)
    const unpublish = page.getByRole("button", { name: "Unpublish", exact: true })
    if (await unpublish.isVisible()) await unpublish.click()
  }
})
