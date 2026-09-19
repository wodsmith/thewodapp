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

})
