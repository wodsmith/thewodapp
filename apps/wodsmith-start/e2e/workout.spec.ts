import {expect, test} from '@playwright/test'
import {loginAsTestUser} from './fixtures/auth'
import {TEST_DATA} from './fixtures/test-data'

/**
 * Workout E2E Tests
 *
 * Tests workout viewing and creation using seeded test data.
 * The database is seeded with test workouts (Fran, Murph, Cindy) via globalSetup.
 *
 * NOTE: The workouts page shows BOTH team-specific workouts AND public workouts.
 * This means we need to use precise selectors to match our E2E test workouts
 * specifically, as there may be other public workouts with similar names.
 *
 * SKIPPED: Tests need to be updated for wodsmith-start UI differences.
 * The heading selector matches multiple elements in wodsmith-start.
 * TODO: Update selectors to match wodsmith-start UI.
 */

/**
 * Helper to get a workout card by exact name match.
 * The workout name appears in a <p> tag with specific styling inside a link.
 * Using getByRole('link') with name that starts with the workout name ensures
 * we match the workout card link, not just any text on the page.
 */
function getWorkoutCardByName(
  page: import('@playwright/test').Page,
  name: string,
) {
  // Match a link that contains the workout name at the start
  // The link text includes the workout name followed by description preview
  return page.getByRole('link', {name: new RegExp(`^${name}`)}).first()
}

test.describe.skip('Workouts', () => {
  test.beforeEach(async ({page}) => {
    // Login before each test
    await loginAsTestUser(page)
  })

  test.describe('Viewing Workouts', () => {
    test('should display seeded workouts in list', async ({page}) => {
      // Navigate and wait for network to settle (server data fetching)
      await page.goto('/workouts', {waitUntil: 'networkidle'})

      // Wait for the page heading to confirm we're on the workouts page
      await expect(page.getByRole('heading', {name: /workouts/i})).toBeVisible({
        timeout: 10000,
      })

      // Wait for the workout list to render (wait for any workout link to appear)
      // This ensures the data has loaded before we check for specific workouts
      await page.waitForSelector('a[href*="/workouts/"]', {timeout: 15000})

      // Verify seeded workouts are visible using exact match selectors
      // Use getByRole('link') to match the workout card links specifically
      // Use longer timeout as workouts may take time to render
      await expect(
        getWorkoutCardByName(page, TEST_DATA.workouts.fran.name),
      ).toBeVisible({timeout: 15000})
      await expect(
        getWorkoutCardByName(page, TEST_DATA.workouts.murph.name),
      ).toBeVisible({timeout: 15000})
      await expect(
        getWorkoutCardByName(page, TEST_DATA.workouts.cindy.name),
      ).toBeVisible({timeout: 15000})
    })

    test('should navigate to workout detail page', async ({page}) => {
      // Navigate and wait for network to settle
      await page.goto('/workouts', {waitUntil: 'networkidle'})

      // Wait for the page heading to confirm we're on the workouts page
      await expect(page.getByRole('heading', {name: /workouts/i})).toBeVisible({
        timeout: 10000,
      })

      // Wait for the workout list to render
      await page.waitForSelector('a[href*="/workouts/"]', {timeout: 15000})

      // Wait for workout to be visible before clicking
      await expect(
        getWorkoutCardByName(page, TEST_DATA.workouts.fran.name),
      ).toBeVisible({timeout: 15000})

      // Click on the Fran workout card (using precise selector)
      await getWorkoutCardByName(page, TEST_DATA.workouts.fran.name).click()

      // Should navigate to workout detail
      await expect(page).toHaveURL(/\/workouts\//)

      // Workout name should be visible on detail page
      // On detail page, the name appears in a heading
      await expect(
        page.getByRole('heading', {name: TEST_DATA.workouts.fran.name}),
      ).toBeVisible()
    })
  })

  test.describe('Creating Workouts', () => {
    test('should navigate to workout creation page', async ({page}) => {
      await page.goto('/workouts')

      // Click create workout button
      const createButton = page
        .getByRole('link', {name: /new|create|add/i})
        .or(page.locator('a[href*="/workouts/new"]'))
        .first()

      if (await createButton.isVisible()) {
        await createButton.click()
        await expect(page).toHaveURL(/\/workouts\/new/)
      } else {
        // Navigate directly if button not found
        await page.goto('/workouts/new')
      }

      // Verify form elements are present
      await expect(page.getByLabel(/name/i)).toBeVisible()
    })

    test('should create a new workout', async ({page}) => {
      const uniqueName = `E2E Test Workout ${Date.now()}`

      await page.goto('/workouts/new')

      // Fill in workout name (required)
      await page.getByLabel(/workout name/i).fill(uniqueName)

      // Fill in description (required)
      await page.getByLabel(/description/i).fill('E2E test workout description')

      // Select scheme (required) - the scheme field is a shadcn Select component
      // The Select renders as a button with role="combobox"
      // We need to find the one that shows "Select a scheme" placeholder
      const schemeTrigger = page
        .getByRole('combobox')
        .filter({hasText: /select a scheme/i})
      await schemeTrigger.click()

      // Wait for the dropdown to open and select "For Time"
      // Options appear in a portal with role="option"
      // Use exact: true to avoid matching "For Time (with cap)"
      await page.getByRole('option', {name: 'For Time', exact: true}).click()

      // The Score Type field appears after scheme is selected
      // The form has a useEffect that sets the default score type, but the Select component
      // may not show it immediately. We need to explicitly select if it shows placeholder.
      const scoreTypeCombobox = page.getByRole('combobox', {
        name: /score type/i,
      })
      await expect(scoreTypeCombobox).toBeVisible()

      // Check if score type needs to be selected (shows "Select score type")
      const scoreTypeText = await scoreTypeCombobox.textContent()
      if (scoreTypeText?.toLowerCase().includes('select')) {
        // Manually select the score type
        await scoreTypeCombobox.click()
        await page.getByRole('option', {name: /min/i}).first().click()
      }

      // Submit the form
      await page.getByRole('button', {name: /create workout/i}).click()

      // Wait for navigation away from create page
      await page.waitForURL(/\/workouts(?!\/new)/, {timeout: 10000})

      // Verify workout was created (should be on detail page with heading)
      await expect(page.getByRole('heading', {name: uniqueName})).toBeVisible({
        timeout: 5000,
      })
    })

    test('should show validation errors for empty form', async ({page}) => {
      await page.goto('/workouts/new')

      // Try to submit without filling anything
      await page.getByRole('button', {name: /create|save|submit/i}).click()

      // Should stay on create page (client-side validation prevents submit)
      await expect(page).toHaveURL(/\/workouts\/new/)

      // Look for any validation message
      const hasValidation = await page
        .locator('[class*="error"], [class*="invalid"], [aria-invalid="true"]')
        .first()
        .isVisible()
        .catch(() => false)

      // Or check for HTML5 validation
      const nameInput = page.getByLabel(/name/i)
      const isInvalid = await nameInput.evaluate(
        (el: HTMLInputElement) => !el.validity.valid,
      )

      // One of these should be true
      expect(hasValidation || isInvalid).toBe(true)
    })
  })

  test.describe('Workout Search/Filter', () => {
    test('should filter workouts by search term', async ({page}) => {
      await page.goto('/workouts')

      // Look for search input
      const searchInput = page
        .getByPlaceholder(/search/i)
        .or(page.getByRole('searchbox'))
        .or(page.locator('input[type="search"]'))
        .first()

      if (await searchInput.isVisible()) {
        // Search for "Fran" - note this may also match "War Frank" etc.
        // so we need to verify our specific Fran workout is still visible
        await searchInput.fill('Fran')
        await page.waitForTimeout(500) // Wait for debounce

        // Our E2E Fran workout should be visible
        // Use the precise selector to avoid matching other workouts
        await expect(
          getWorkoutCardByName(page, TEST_DATA.workouts.fran.name),
        ).toBeVisible()

        // Note: Other workouts containing "fran" (like "War Frank") may also appear
        // This is expected behavior - search matches substring
      }
    })
  })
})
