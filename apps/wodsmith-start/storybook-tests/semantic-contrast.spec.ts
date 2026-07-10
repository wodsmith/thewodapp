import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page, test } from "@playwright/test"

type StorybookIndex = {
  entries: Record<string, { id: string; type: string }>
}

type Theme = "light" | "dark"

const portalStories = {
  "primitives-dialog-and-sheet--confirmation-dialog": openDialog,
  "primitives-dialog-and-sheet--editing-sheet": openSheet,
  "primitives-form--validation-and-selection": openSelect,
  "primitives-menus-and-popovers--action-menu": openMenuPopoverAndTooltip,
} satisfies Record<string, (page: Page, theme: Theme) => Promise<void>>

async function expectZeroContrastViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze()

  expect(results.violations, label).toEqual([])
}

async function expectPortalTheme(
  page: Page,
  surface: Locator,
  theme: Theme,
) {
  await expectSurfaceTheme(page, surface, theme)

  const renderedOutsideCanvas = await surface.evaluate((element) => {
    const storyRoot = document.querySelector(".wodsmith-story-theme")
    return storyRoot !== null && !storyRoot.contains(element)
  })
  expect(renderedOutsideCanvas, "surface must render outside the Canvas wrapper").toBe(
    true,
  )
}

async function expectSurfaceTheme(
  page: Page,
  surface: Locator,
  theme: Theme,
) {
  await expect(surface).toBeVisible()
  await expect(page.locator("html")).toHaveClass(
    theme === "dark" ? /(?:^|\s)dark(?:\s|$)/ : /^(?!.*(?:^|\s)dark(?:\s|$)).*/,
  )
  await expect(page.locator("body")).toHaveClass(
    theme === "dark" ? /(?:^|\s)dark(?:\s|$)/ : /^(?!.*(?:^|\s)dark(?:\s|$)).*/,
  )

  const inheritedTokens = await surface.evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      background: styles.getPropertyValue("--background").trim(),
      foreground: styles.getPropertyValue("--foreground").trim(),
      popover: styles.getPropertyValue("--popover").trim(),
      popoverForeground: styles
        .getPropertyValue("--popover-foreground")
        .trim(),
    }
  })
  const canvasTokens = await page.locator(".wodsmith-story-theme").evaluate(
    (element) => {
      const styles = getComputedStyle(element)
      return {
        background: styles.getPropertyValue("--background").trim(),
        foreground: styles.getPropertyValue("--foreground").trim(),
        popover: styles.getPropertyValue("--popover").trim(),
        popoverForeground: styles
          .getPropertyValue("--popover-foreground")
          .trim(),
      }
    },
  )
  const expectedTokens =
    theme === "dark"
      ? {
          background: "20 14.3% 4.1%",
          foreground: "60 9.1% 97.8%",
          popover: "20 14.3% 4.1%",
          popoverForeground: "60 9.1% 97.8%",
        }
      : {
          background: "0 0% 100%",
          foreground: "20 14.3% 4.1%",
          popover: "0 0% 100%",
          popoverForeground: "20 14.3% 4.1%",
        }

  expect(canvasTokens, "Canvas wrapper must expose the selected theme tokens").toEqual(
    expectedTokens,
  )
  expect(inheritedTokens, "surface must inherit the Canvas theme tokens").toEqual(
    canvasTokens,
  )
}

async function openDialog(page: Page, theme: Theme) {
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Open confirmation" }).click()
  const dialog = page.getByRole("dialog", { name: "Publish competition?" })
  await expectPortalTheme(page, dialog, theme)
  await expectZeroContrastViolations(page, `dialog (${theme})`)
  await page.keyboard.press("Escape")
}

async function openSheet(page: Page, theme: Theme) {
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Edit division" }).click()
  const sheet = page.getByRole("dialog", { name: "Edit Rx division" })
  await expectPortalTheme(page, sheet, theme)
  await expectZeroContrastViolations(page, `sheet (${theme})`)
  await page.keyboard.press("Escape")
}

async function openSelect(page: Page, theme: Theme) {
  await expect(page.getByRole("option")).toHaveCount(0)
  await page.getByRole("combobox", { name: "Division" }).click()
  const option = page.getByRole("option", { name: "Rx" })
  await expectPortalTheme(page, option, theme)
  await expectZeroContrastViolations(page, `select (${theme})`)
  await page.keyboard.press("Escape")
}

async function openMenuPopoverAndTooltip(page: Page, theme: Theme) {
  const eventActions = page.getByRole("button", { name: "Event actions" })
  await eventActions.click()
  const menu = page.getByRole("menu")
  await expectPortalTheme(page, menu, theme)
  await expectZeroContrastViolations(page, `dropdown menu (${theme})`)
  await page.keyboard.press("Escape")

  const popoverTrigger = page.getByRole("button", { name: "Registration note" })
  await popoverTrigger.click()
  const popover = page.getByText(
    "Registration closes 48 hours before the first heat.",
  )
  await expectPortalTheme(page, popover, theme)
  await expectZeroContrastViolations(page, `popover (${theme})`)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Help" }).focus()
  const tooltip = page.getByRole("tooltip", {
    name: "Changes are saved automatically.",
  })
  await expectSurfaceTheme(page, tooltip, theme)
  await expectZeroContrastViolations(page, `tooltip (${theme})`)
}

test("every Canvas story has semantic contrast in class-selected themes", async ({
  page,
  request,
}) => {
  const indexResponse = await request.get("/index.json")
  expect(indexResponse.ok()).toBe(true)
  const index = (await indexResponse.json()) as StorybookIndex
  const storyIds = Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .map((entry) => entry.id)
    .sort()

  expect(storyIds.length, "Storybook index must contain Canvas stories").toBeGreaterThan(
    0,
  )
  expect(
    Object.keys(portalStories).filter((id) => !storyIds.includes(id)),
    "portal coverage points must remain valid story IDs",
  ).toEqual([])

  for (const storyId of storyIds) {
    for (const theme of ["light", "dark"] as const) {
      await test.step(`${storyId} / ${theme}`, async () => {
        await page.emulateMedia({
          colorScheme: theme === "light" ? "dark" : "light",
        })
        await page.goto(
          `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`,
        )

        const canvas = page.locator(
          `.wodsmith-story-theme[data-wodsmith-theme="${theme}"][data-wodsmith-view-mode="story"]`,
        )
        await expect(canvas).toBeVisible()
        await expect(page.locator("html")).toHaveClass(
          theme === "dark"
            ? /(?:^|\s)dark(?:\s|$)/
            : /^(?!.*(?:^|\s)dark(?:\s|$)).*/,
        )
        await expect(page.locator("body")).toHaveClass(
          theme === "dark"
            ? /(?:^|\s)dark(?:\s|$)/
            : /^(?!.*(?:^|\s)dark(?:\s|$)).*/,
        )
        await expectZeroContrastViolations(page, `${storyId} (${theme})`)

        const exercisePortal = portalStories[storyId as keyof typeof portalStories]
        if (exercisePortal) await exercisePortal(page, theme)
      })
    }
  }
})

test("Docs keeps its chrome isolated from the story theme", async ({
  page,
  request,
}) => {
  const indexResponse = await request.get("/index.json")
  const index = (await indexResponse.json()) as StorybookIndex
  const docsId = Object.values(index.entries)
    .filter((entry) => entry.type === "docs")
    .map((entry) => entry.id)
    .sort()[0]

  if (!docsId) throw new Error("Storybook index must contain an autodocs page")

  for (const theme of ["light", "dark"] as const) {
    await page.goto(
      `/iframe.html?id=${docsId}&viewMode=docs&globals=theme:${theme}`,
    )

    await expect(page.locator(".sbdocs-wrapper")).toBeVisible()
    await expect(
      page.locator(
        `.wodsmith-story-theme[data-wodsmith-theme="${theme}"][data-wodsmith-view-mode="docs"]`,
      ).first(),
    ).toBeVisible()
    await expect(page.locator("html")).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
    await expect(page.locator("body")).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  }
})
