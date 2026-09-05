import { expect, test } from "@playwright/test"
import { loginAsTestUser, waitForHydration } from "./fixtures/auth"

test("organizer reload hydrates after the theme script changes the root class", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await loginAsTestUser(page)
  await page.goto("/compete/organizer")
  await waitForHydration(page)

  const hydrationErrors: string[] = []
  page.on("console", (message) => {
    const text = message.text()
    if (
      message.type() === "error" &&
      (text.includes("hydrated") || text.includes("Minified React error #418"))
    ) {
      hydrationErrors.push(text)
    }
  })
  page.on("pageerror", (error) => {
    if (error.message.includes("Minified React error #418")) {
      hydrationErrors.push(error.message)
    }
  })

  await page.reload()
  await waitForHydration(page)
  await page.waitForTimeout(1_000)

  expect(hydrationErrors).toEqual([])
})
