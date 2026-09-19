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

    // @lat: [[training#Workout Library Navigation Test]]
    await expect(page.getByRole('heading', {name: 'Workout library', exact: true})).toBeVisible({
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

  // @lat: [[workout-authoring#Workout Authoring#Library creation browser flow]]
  test('should create a new workout', async ({page}) => {
    test.skip(
      !process.env.TYPESAFE_API_KEY,
      'Workout creation requires the live recognition service',
    )
    test.setTimeout(120_000)
    const uniqueName = `E2E Test Workout ${Date.now()}`

    await page.goto('/workouts/new')
    await waitForHydration(page)

    await expect(
      page.getByRole('heading', {name: 'Create workout'}),
    ).toBeVisible({timeout: 15000})

    // This live recognition test requires TYPESAFE_API_KEY on the test server.
    await page.getByLabel('Describe your workout').fill(`${uniqueName}\nFor time: 30 air squats. Record one completion time.`)
    await expect(page.getByRole('textbox')).toHaveCount(1)
    await expect(page.getByRole('combobox', {name: 'Scheme', exact: true})).toHaveCount(0)

    // Submit
    await page.getByRole('button', {name: 'Create workout'}).click()

    // Should redirect to workout detail page
    await page.waitForURL(/\/workouts\/(?!new)/, {timeout: 75000})

    // Detail page heading shows the workout name
    await expect(page.getByRole('heading', {name: uniqueName})).toBeVisible({
      timeout: 10000,
    })
  })
})
