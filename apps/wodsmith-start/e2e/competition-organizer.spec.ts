import {expect, test} from '@playwright/test'
import {createConnection} from 'mysql2/promise'
import {loginAsTestUser, waitForHydration} from './fixtures/auth'

test.describe('Competition Organizer', () => {
  // This test creates a competition and sets up divisions.
  test.setTimeout(60_000)

  test('should create competition and add divisions', async ({page}) => {
    const setupConnection = await createConnection(process.env.DATABASE_URL!)
    try {
      await setupConnection.execute(
        `INSERT INTO team_entitlement_overrides
           (id, team_id, type, \`key\`, value, reason, created_at, updated_at, update_counter)
         VALUES (?, ?, 'limit', 'max_published_competitions', '0', ?, NOW(), NOW(), 0)
         ON DUPLICATE KEY UPDATE value = '0', updated_at = NOW()`,
        [
          'e2e_pending_organizer_limit',
          'e2e_test_team',
          'Pending organizer regression',
        ],
      )
    } finally {
      await setupConnection.end()
    }

    await loginAsTestUser(page)

    await page.goto('/compete/organizer')
    await waitForHydration(page)
    await expect(page.getByText('Application pending:')).toBeVisible()

    const uniqueName = `E2E Comp ${Date.now()}`
    const slug = `e2e-comp-${Date.now()}`

    // Navigate to create competition page
    await page.goto('/compete/organizer/new')
    await waitForHydration(page)
    await expect(
      page.getByText('Create competition', {exact: true}).first(),
    ).toBeVisible({timeout: 15000})

    // Fill form
    // Select organizing team
    const teamTrigger = page
      .getByRole('combobox')
      .filter({hasText: /select team/i})
      .first()
    const teamVisible = await teamTrigger.waitFor({state: 'visible', timeout: 2000}).then(() => true).catch(() => false)
    if (teamVisible) {
      await teamTrigger.click()
      await page.getByRole('option', {name: /E2E Test Gym/i}).click()
    }

    await page.getByLabel('Competition Name').fill(uniqueName)

    // Clear and fill slug
    const slugInput = page.getByRole('textbox', {name: 'Slug'})
    await slugInput.clear()
    await slugInput.fill(slug)

    // Select competition type
    const typeTrigger = page
      .getByRole('combobox')
      .filter({hasText: /select competition type/i})
      .first()
    const typeVisible = await typeTrigger.waitFor({state: 'visible', timeout: 2000}).then(() => true).catch(() => false)
    if (typeVisible) {
      await typeTrigger.click()
      await page.getByRole('option', {name: /In-Person/i}).click()
    }

    // Fill start date (30 days from now)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 30)
    const dateStr = startDate.toISOString().slice(0, 10)
    await page.getByLabel('Competition date').fill(dateStr)

    // Submit
    await page.getByRole('button', {name: 'Create competition'}).click()

    // Wait for navigation back to organizer dashboard
    await page.waitForURL(/\/compete\/organizer/, {timeout: 15000})

    // Find the newly created competition
    await expect(page.getByText(uniqueName)).toBeVisible({timeout: 10000})

    // Extract the manage URL from the link with title="Manage" button inside it
    // The list is sorted newest-first, so grab the first manage link that's an organizer detail link
    // (href like /compete/organizer/<ulid>, not /compete/organizer/new or /compete/organizer/series)
    const allManageHrefs = await page.locator('a[href^="/compete/organizer/"] button[title="Manage"]').evaluateAll(
      (buttons) => buttons.map((btn) => (btn.closest('a') as HTMLAnchorElement)?.getAttribute('href')).filter(Boolean)
    )
    // Filter to only competition detail links (exclude /new, /series, /settings paths)
    const compDetailPath = allManageHrefs.find(
      (href) => href && !href.includes('/new') && !href.includes('/series') && !href.includes('/settings')
    )
    expect(compDetailPath).toBeTruthy()

    // Navigate directly to divisions page
    await page.goto(`${compDetailPath}/divisions`)
    await waitForHydration(page)

    // Set up divisions — click "Start fresh" for default Open + Scaled
    const startFresh = page.getByRole('button', {name: /start fresh/i})
    const startFreshVisible = await startFresh.waitFor({state: 'visible', timeout: 5000}).then(() => true).catch(() => false)
    if (startFreshVisible) {
      await startFresh.click()
      // Wait for divisions to appear
      await expect(page.getByText(/open/i)).toBeVisible({timeout: 10000})
    }
  })
})
