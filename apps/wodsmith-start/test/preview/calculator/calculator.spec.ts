import { expect, test } from "@playwright/test"

// @lat: [[calculators#Calculator Tests#Browser keyboard and mobile flow]]
test("native unit and bar radios work with Tab, arrows and Space on mobile", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/calculator")
  const target = page.getByRole("spinbutton", { name: /target weight/i })
  await target.focus()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("radio", { name: "LB", exact: true }),
  ).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await expect(
    page.getByRole("radio", { name: "KG", exact: true }),
  ).toBeChecked()
  await expect(target).toHaveValue("61.23492")
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("radio", { name: "20 kg", exact: true }),
  ).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Space")
  await expect(
    page.getByRole("radio", { name: "15 kg", exact: true }),
  ).toBeChecked()
  await target.fill("100")
  await target.press("Enter")
  await expect(
    page.getByRole("status", { name: "Loaded weight" }),
  ).toContainText("100.0 KG")
  await expect(
    page.getByRole("heading", { name: "Set 1: 40.0 kg" }),
  ).toBeVisible()
  await page.getByRole("radio", { name: "LB", exact: true }).click()
  await expect(target).toHaveValue("220.462442")
  await page.goBack()
  await expect(target).toHaveValue("100")
  await expect(
    page.getByRole("radio", { name: "KG", exact: true }),
  ).toBeChecked()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})

test("percentage calculator has a persistent labelled input and Enter submits", async ({
  page,
}) => {
  await page.goto("/calculator/spreadsheet")
  const max = page.getByRole("spinbutton", { name: "1 Rep Max (kg/lb)" })
  await max.fill("125.5")
  await max.press("Enter")
  await expect(page.getByRole("row", { name: "50% 62.75" })).toBeVisible()
})
