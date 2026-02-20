import {expect, test} from '@playwright/test'
import {loginAsTestUser} from './fixtures/auth'
import {TEST_DATA} from './fixtures/test-data'

test.describe('Competition Registration', () => {
  test('should register for a competition', async ({page}) => {
    await loginAsTestUser(page)

    const comp = TEST_DATA.competition

    // Navigate to public competition page
    await page.goto(`/compete/${comp.slug}`, {waitUntil: 'networkidle'})

    // Verify competition page loaded
    await expect(
      page.getByRole('heading', {name: comp.name}),
    ).toBeVisible({timeout: 10000})

    // Click Register Now
    const registerLink = page.getByRole('link', {name: /register now/i})
    await expect(registerLink).toBeVisible({timeout: 5000})
    await registerLink.click()

    // Should be on registration page
    await expect(page).toHaveURL(new RegExp(`/compete/${comp.slug}/register`))
    await expect(
      page.getByText(/register for/i),
    ).toBeVisible({timeout: 10000})

    // Select a division (combobox trigger)
    const divisionTrigger = page
      .getByRole('combobox')
      .first()
    await divisionTrigger.click()

    // Select Scaled division
    const scaledOption = page.getByRole('option', {name: /scaled/i}).first()
      .or(page.locator('button').filter({hasText: /scaled/i}).first())
    await scaledOption.click()

    // Select affiliate — search for Independent
    const affiliateInput = page.getByPlaceholder(/search.*affiliate/i).first()
    if (await affiliateInput.isVisible({timeout: 3000})) {
      await affiliateInput.fill('Independent')
      // Wait for dropdown and select
      const independentOption = page.getByText(/independent/i).first()
      await independentOption.click()
    }

    // Submit registration
    const submitBtn = page
      .getByRole('button', {name: /complete registration|register/i})
      .first()
    await expect(submitBtn).toBeEnabled({timeout: 5000})
    await submitBtn.click()

    // Verify success — either redirected to success page or see confirmation
    await expect(
      page.getByText(/registered|registration complete/i).first(),
    ).toBeVisible({timeout: 15000})
  })
})
