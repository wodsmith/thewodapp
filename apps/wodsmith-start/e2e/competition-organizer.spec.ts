import {expect, test} from '@playwright/test'
import {loginAsTestUser} from './fixtures/auth'

test.describe('Competition Organizer', () => {
  test('should create competition, add division, and add event', async ({
    page,
  }) => {
    await loginAsTestUser(page)

    const uniqueName = `E2E Comp ${Date.now()}`
    const slug = `e2e-comp-${Date.now()}`

    // Navigate to create competition page
    await page.goto('/compete/organizer/new', {waitUntil: 'networkidle'})
    await expect(
      page.getByRole('heading', {name: 'Create Competition'}),
    ).toBeVisible({timeout: 10000})

    // Fill form
    // Select organizing team
    const teamTrigger = page
      .getByRole('combobox')
      .filter({hasText: /select team/i})
      .first()
    if (await teamTrigger.isVisible({timeout: 2000})) {
      await teamTrigger.click()
      await page.getByRole('option', {name: /E2E Test Gym/i}).click()
    }

    await page.getByLabel('Competition Name').fill(uniqueName)

    // Clear and fill slug
    const slugInput = page.getByLabel('Slug')
    await slugInput.clear()
    await slugInput.fill(slug)

    // Select competition type
    const typeTrigger = page
      .getByRole('combobox')
      .filter({hasText: /select competition type/i})
      .first()
    if (await typeTrigger.isVisible({timeout: 2000})) {
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

    // Find the newly created competition and navigate to it
    await expect(page.getByText(uniqueName)).toBeVisible({timeout: 10000})
    await page.getByText(uniqueName).click()

    // Navigate to divisions page
    await page.waitForURL(/\/compete\/organizer\//, {timeout: 10000})
    const divisionsLink = page.getByRole('link', {name: /divisions/i})
    if (await divisionsLink.isVisible({timeout: 3000})) {
      await divisionsLink.click()
    } else {
      // Navigate directly via URL pattern
      const url = page.url()
      await page.goto(`${url}/divisions`)
    }

    // Set up divisions — click "Start Fresh" for default Open + Scaled
    const startFresh = page.getByRole('button', {name: /start fresh/i})
    if (await startFresh.isVisible({timeout: 5000})) {
      await startFresh.click()
      // Wait for divisions to appear
      await expect(page.getByText(/open/i)).toBeVisible({timeout: 10000})
    }

    // Navigate to events page
    const eventsLink = page.getByRole('link', {name: /events/i})
    if (await eventsLink.isVisible({timeout: 3000})) {
      await eventsLink.click()
    }

    // Create an event
    const createEventBtn = page.getByRole('button', {name: /create.*event/i}).first()
    await expect(createEventBtn).toBeVisible({timeout: 5000})
    await createEventBtn.click()

    // Fill event dialog
    await expect(page.getByRole('dialog')).toBeVisible()
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
