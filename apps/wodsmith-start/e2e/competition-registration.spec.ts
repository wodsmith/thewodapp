import {expect, test} from '@playwright/test'
import {loginAsTestUser, waitForHydration} from './fixtures/auth'
import {TEST_DATA} from './fixtures/test-data'

test.describe('Competition Registration', () => {
  test('should register for a competition', async ({page}) => {
    await loginAsTestUser(page)

    const comp = TEST_DATA.competition

    // Navigate to public competition page
    await page.goto(`/compete/${comp.slug}`)
    await waitForHydration(page)

    // Verify competition page loaded
    await expect(
      page.getByRole('heading', {name: comp.name}),
    ).toBeVisible({timeout: 15000})

    // Click Register Now
    const registerLink = page.getByRole('link', {name: /register now/i})
    await expect(registerLink).toBeVisible({timeout: 10000})
    await registerLink.click()

    // Should be on registration page
    await expect(page).toHaveURL(/\/compete\/e2e-throwdown\/register/)
    await waitForHydration(page)
    await expect(
      page.getByText(/register for/i).first(),
    ).toBeVisible({timeout: 15000})

    // Select a division — Popover-based combobox with plain <button> options
    const divisionTrigger = page
      .getByRole('combobox')
      .first()
    await divisionTrigger.click()

    // Division options render as <button> elements inside a Radix Popover
    const scaledBtn = page.locator('[data-radix-popper-content-wrapper] button')
      .filter({hasText: /Scaled/i}).first()
    await expect(scaledBtn).toBeVisible({timeout: 5000})
    await scaledBtn.click()

    // Select affiliate — affiliateName is required
    // The affiliate combobox is a Popover trigger (second combobox on the page)
    const affiliateTrigger = page.getByRole('combobox').filter({hasText: /search.*affiliate|select.*affiliate/i}).first()
      .or(page.getByRole('combobox').nth(1))
    await affiliateTrigger.click()
    // "Independent" is always shown at the top of the affiliate popover
    const independentBtn = page.locator('[data-radix-popper-content-wrapper] button')
      .filter({hasText: /Independent/i}).first()
    await expect(independentBtn).toBeVisible({timeout: 5000})
    await independentBtn.click()

    // Fill in required registration questions (added by seed data)
    // Each question is in a div.space-y-2 with a <Label> + input/select.
    // Use the label to find the parent container, then interact with its control.

    // T-Shirt Size (select)
    const tshirtContainer = page.locator('label', {hasText: 'T-Shirt Size'}).locator('..')
    await tshirtContainer.getByRole('combobox').click()
    await page.getByRole('option', {name: 'L', exact: true}).click()

    // Experience Level (select)
    const experienceContainer = page.locator('label', {hasText: 'Experience Level'}).locator('..')
    await experienceContainer.getByRole('combobox').click()
    await page.getByRole('option', {name: 'Intermediate'}).click()

    // Emergency Contact Phone (text input)
    const emergencyContainer = page.locator('label', {hasText: 'Emergency Contact'}).locator('..')
    await emergencyContainer.getByRole('textbox').fill('555-1234')

    // Submit registration
    const submitBtn = page
      .getByRole('button', {name: /complete registration|register/i})
      .first()
    await expect(submitBtn).toBeEnabled({timeout: 5000})
    await submitBtn.click()

    // Verify success — check for URL change to registered/success page
    // or visible confirmation text (not hidden elements)
    await expect(page).toHaveURL(/\/compete\/e2e-throwdown\/(registered|register\/success)/, {
      timeout: 15000,
    })
  })
})
