import {expect, test} from '@playwright/test'
import {loginAsTestUser, waitForHydration} from './fixtures/auth'

test.describe('Competition Organizer', () => {
  // This test creates a competition, sets up divisions, and creates an event — needs extra time in CI
  test.setTimeout(60_000)

  test('should create competition, add division, and add event', async ({
    page,
  }) => {
    await loginAsTestUser(page)

    const uniqueName = `E2E Comp ${Date.now()}`
    const slug = `e2e-comp-${Date.now()}`

    // Navigate to create competition page
    await page.goto('/compete/organizer/new')
    await waitForHydration(page)
    await expect(
      page.getByText('Create Competition', {exact: true}).first(),
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
    // Use getByRole('textbox') to avoid matching Router DevTools buttons containing "slug" in aria-labels
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
    await page.getByLabel('Competition Date').fill(dateStr)

    // Submit
    await page.getByRole('button', {name: 'Create Competition'}).click()

    // Wait for navigation back to organizer dashboard
    await page.waitForURL(/\/compete\/organizer/, {timeout: 15000})

    // Find the newly created competition and navigate to its manage page
    await expect(page.getByText(uniqueName)).toBeVisible({timeout: 10000})
    // The competition name is plain text — click the "Manage" (pencil) link in the same row
    const compCard = page.locator('div').filter({hasText: uniqueName}).getByRole('link', {name: 'Manage'})
    await compCard.click()

    // Wait for navigation to competition detail page and extract the competition ID from URL
    await page.waitForURL(/\/compete\/organizer\//, {timeout: 15000})
    await waitForHydration(page)
    const compDetailUrl = page.url().replace(/\/$/, '') // trim trailing slash

    // Navigate to divisions page using absolute URL (avoids stale URL issues)
    const divisionsLink = page.getByRole('link', {name: /divisions/i})
    const divisionsVisible = await divisionsLink.waitFor({state: 'visible', timeout: 3000}).then(() => true).catch(() => false)
    if (divisionsVisible) {
      await divisionsLink.click()
    } else {
      await page.goto(`${compDetailUrl}/divisions`)
    }
    await waitForHydration(page)

    // Set up divisions — click "Start Fresh" for default Open + Scaled
    const startFresh = page.getByRole('button', {name: /start fresh/i})
    const startFreshVisible = await startFresh.waitFor({state: 'visible', timeout: 5000}).then(() => true).catch(() => false)
    if (startFreshVisible) {
      await startFresh.click()
      // Wait for divisions to appear
      await expect(page.getByText(/open/i)).toBeVisible({timeout: 10000})
    }

    // Navigate to events page using absolute URL
    const eventsLink = page.getByRole('link', {name: /events/i})
    const eventsVisible = await eventsLink.waitFor({state: 'visible', timeout: 3000}).then(() => true).catch(() => false)
    if (eventsVisible) {
      await eventsLink.click()
    } else {
      await page.goto(`${compDetailUrl}/events`)
    }
    await waitForHydration(page)

    // Create an event
    const createEventBtn = page.getByRole('button', {name: /create.*event/i}).first()
    await expect(createEventBtn).toBeVisible({timeout: 10000})
    await createEventBtn.click()

    // Fill event dialog — wait for dialog to appear after React state update
    await expect(page.getByRole('dialog')).toBeVisible({timeout: 10000})
    await page.getByLabel('Event Name').fill('Event 1 - Fran')

    // Submit event creation
    const submitEventBtn = page
      .getByRole('dialog')
      .getByRole('button', {name: /create event/i})
    await submitEventBtn.click()

    // Verify event appears
    await expect(page.getByText('Event 1 - Fran')).toBeVisible({timeout: 10000})
  })
})
