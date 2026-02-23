import {expect, test} from '@playwright/test'
import {loginAsTestUser, waitForHydration} from './fixtures/auth'
import {TEST_DATA} from './fixtures/test-data'

test.describe('Workouts', () => {
  test.beforeEach(async ({page}) => {
    await loginAsTestUser(page)
  })

  test('should display workouts and navigate to detail', async ({page}) => {
    await page.goto('/workouts')
    await waitForHydration(page)

    // Heading text is uppercase "WORKOUTS" — exact match to avoid matching
    // "Scheduled Workouts" and "No workouts scheduled for today"
    await expect(page.getByRole('heading', {name: 'WORKOUTS', exact: true})).toBeVisible({
      timeout: 30000,
    })

    // Wait for workout links to appear
    await page.waitForSelector('a[href*="/workouts/"]', {timeout: 15000})

    // Verify seeded workouts are visible — the link text is the workout name
    await expect(
      page.getByRole('link', {name: TEST_DATA.workouts.fran.name}).first(),
    ).toBeVisible({timeout: 15000})
    await expect(
      page.getByRole('link', {name: TEST_DATA.workouts.murph.name}).first(),
    ).toBeVisible({timeout: 15000})
    await expect(
      page.getByRole('link', {name: TEST_DATA.workouts.cindy.name}).first(),
    ).toBeVisible({timeout: 15000})

    // Click Fran and verify detail page
    await page
      .getByRole('link', {name: TEST_DATA.workouts.fran.name})
      .first()
      .click()

    await expect(page).toHaveURL(/\/workouts\//)
    await expect(
      page.getByRole('heading', {name: TEST_DATA.workouts.fran.name}),
    ).toBeVisible({timeout: 10000})
  })

  test('should create a new workout', async ({page}) => {
    const uniqueName = `E2E Test Workout ${Date.now()}`

    await page.goto('/workouts/new')
    await waitForHydration(page)

    // Heading is "CREATE WORKOUT"
    await expect(
      page.getByRole('heading', {name: 'CREATE WORKOUT'}),
    ).toBeVisible({timeout: 15000})

    // Fill name — Label text is "Workout Name"
    await page.getByLabel('Workout Name').fill(uniqueName)

    // Fill description
    await page.getByLabel('Description').fill('E2E test workout description')

    // Select scheme — Radix Select with placeholder "Select a scheme"
    // Use keyboard interaction: Radix Select opens on Enter/Space and supports type-ahead
    const schemeTrigger = page.locator('button[role="combobox"]').filter({hasText: /select a scheme/i})
    await schemeTrigger.scrollIntoViewIfNeeded()
    await schemeTrigger.focus()
    await schemeTrigger.press('Enter')
    // Wait for listbox portal to mount, then click option
    await page.locator('[role="listbox"]').waitFor({state: 'visible', timeout: 5000})
    await page.locator('[role="option"]').filter({hasText: 'For Time'}).first().click()

    // Submit
    await page.getByRole('button', {name: 'Create Workout'}).click()

    // Should redirect to workout detail page
    await page.waitForURL(/\/workouts\/(?!new)/, {timeout: 15000})

    // Detail page heading shows the workout name
    await expect(page.getByRole('heading', {name: uniqueName})).toBeVisible({
      timeout: 10000,
    })
  })
})
