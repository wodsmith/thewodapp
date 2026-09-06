import { expect, type Locator, type Page, test } from "@playwright/test"
import { loginAsTestUser, waitForHydration } from "./fixtures/auth"
import {
  cleanupCrewScheduleTestEvent,
  requireCrewScheduleTestDatabase,
} from "./fixtures/crew-schedule-cleanup"
import { TEST_DATA } from "./fixtures/test-data"

const eventPath = `/events/${TEST_DATA.crewDemo.eventId}`

async function expectPageFits(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(
    dimensions.content,
    `Horizontal overflow at ${page.url()}`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectDialogFits(page: Page, dialog: Locator, inset = 15) {
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(inset)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width - inset)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true)
  for (const field of await dialog
    .locator(
      'input:not([type="checkbox"]):not([type="radio"]), select, textarea',
    )
    .all()) {
    if (await field.isVisible()) {
      expect(
        await field.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16)
    }
  }
}

async function navigateEvent(page: Page, name: string) {
  await page.getByRole("button", { name: "Open event navigation" }).click()
  await page
    .getByRole("dialog")
    .getByRole("link", { name, exact: true })
    .click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  await expectPageFits(page)
}

// @lat: [[crew#Mobile Layout and Navigation]]
for (const width of [320, 390, 768, 1280]) {
  test(`public and populated organizer layouts fit ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 844 })
    for (const route of ["/", "/calculator", "/sign-in", "/sign-up"]) {
      await page.goto(route)
      await waitForHydration(page)
      await expect(
        page.getByText("Something went wrong", { exact: true }),
      ).toHaveCount(0)
      await expectPageFits(page)
    }
    await loginAsTestUser(page)
    for (const route of [
      "/events",
      "/events/new",
      ...[
        "",
        "/setup",
        "/heats",
        "/staffing",
        "/volunteers",
        "/shifts",
        "/judges",
        "/exports",
        "/billing",
      ].map((path) => eventPath + path),
    ]) {
      await page.goto(route)
      await waitForHydration(page)
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible()
      await expect(
        page.getByText("Something went wrong", { exact: true }),
      ).toHaveCount(0)
      await expectPageFits(page)
    }
  })
}

test("phone navigation restores focus and closes after choosing a destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/")
  await waitForHydration(page)
  const trigger = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  })
  await trigger.click()
  const drawer = page.getByRole("dialog", { name: "WODsmith Crew" })
  await expect(drawer.getByRole("link", { name: "Sign up" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  await trigger.click()
  await drawer.getByRole("link", { name: "Calculator", exact: true }).click()
  await expect(drawer).not.toBeVisible()
  await expect(page).toHaveURL(/\/calculator$/)
  await expectPageFits(page)
  // Role controls remain editable without sideways scrolling.
  const firstRole = page.locator("section[aria-label]").first()
  await firstRole.getByLabel("People per unit").fill("2")
  await expect(firstRole.getByLabel("People per unit")).toHaveValue("2")
  await expectPageFits(page)
})

test("creates and assigns a volunteer schedule on a small phone", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const databaseUrl = requireCrewScheduleTestDatabase()
  const name = `Mobile schedule ${crypto.randomUUID()}`
  await page.setViewportSize({ width: 320, height: 568 })
  await loginAsTestUser(page)
  try {
    await page.goto("/events/new")
    await waitForHydration(page)
    await page.getByLabel("Event name", { exact: true }).fill(name)
    await page.getByRole("button", { name: "Create Crew event" }).click()
    await expect(page.getByRole("heading", { name })).toBeVisible()
    await navigateEvent(page, "Volunteers")
    await page
      .getByRole("button", { name: "Add volunteer", exact: true })
      .click()
    const volunteer = page.getByRole("dialog", {
      name: "Add volunteer",
      exact: true,
    })
    await expectDialogFits(page, volunteer)
    await volunteer
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Mobile Volunteer")
    await volunteer
      .getByRole("checkbox", { name: "Judge", exact: true })
      .check()
    await volunteer
      .getByRole("button", { name: "Add volunteer", exact: true })
      .click()
    await expect(volunteer).not.toBeVisible()
    await expect(
      page.getByRole("article", { name: "Mobile Volunteer" }),
    ).toBeVisible()
    await navigateEvent(page, "Volunteer Shifts")
    await page.getByRole("button", { name: "Add shift", exact: true }).click()
    const shift = page.getByRole("dialog", { name: "Add shift", exact: true })
    await expectDialogFits(page, shift)
    await shift
      .getByRole("textbox", { name: "Shift Name", exact: true })
      .fill("Morning judges")
    await shift.getByRole("combobox", { name: "Role Type" }).click()
    await page.getByRole("option", { name: "Judge", exact: true }).click()
    await shift
      .getByRole("button", { name: "Create shift", exact: true })
      .click()
    await expect(shift).not.toBeVisible()
    await page
      .getByRole("button", {
        name: "Assign volunteers to Morning judges",
        exact: true,
      })
      .click()
    const assignments = page.getByRole("dialog", {
      name: "Morning judges",
      exact: true,
    })
    await expectDialogFits(page, assignments, 0)
    await assignments
      .getByRole("button", { name: "Add Mobile Volunteer", exact: true })
      .click()
    await expect(assignments.getByText("1/1 assigned")).toBeVisible()
    await assignments
      .getByRole("button", { name: "Close", exact: true })
      .click()
    await expect(
      page.getByRole("article", { name: "Morning judges" }),
    ).toContainText("1 / 1")
    await navigateEvent(page, "Export Schedule")
    await expect(
      page.getByRole("heading", { name: "Purchase event access" }),
    ).toBeVisible()
    await expectPageFits(page)
  } finally {
    await cleanupCrewScheduleTestEvent(databaseUrl, name)
  }
})

test("phone exports remain readable and retain the complete print table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAsTestUser(page)
  await page.goto(`${eventPath}/exports`)
  await waitForHydration(page)
  for (const tab of ["Judges", "Shifts", "Master Schedule"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click()
    await expectPageFits(page)
  }
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Master CSV", exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toBe(
    `${TEST_DATA.crewDemo.slug}-master-schedule.csv`,
  )
  await page.emulateMedia({ media: "print" })
  await expect(
    page.getByRole("columnheader", { name: "People", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Time", exact: true }),
  ).toBeVisible()
})
