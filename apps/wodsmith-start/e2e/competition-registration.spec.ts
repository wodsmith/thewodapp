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
      page.getByText(/register for/i),
    ).toBeVisible({timeout: 15000})

    // Select a division — Popover-based combobox with plain <button> options
    const divisionTrigger = page
      .getByRole('combobox')
      .first()
    await divisionTrigger.click()

    // Division options render as <button> elements inside a Popover, not role="option"
    const scaledOption = page.locator('[data-radix-popper-content-wrapper] button, [role="listbox"] button')
      .filter({hasText: /Scaled/i}).first()
      .or(page.getByText('Scaled', {exact: true}).first())
    await expect(scaledOption).toBeVisible({timeout: 5000})
    await scaledOption.click()

    // Select affiliate — search for Independent
    const affiliateInput = page.getByPlaceholder(/search.*affiliate/i).first()
    const affiliateVisible = await affiliateInput.waitFor({state: 'visible', timeout: 3000}).then(() => true).catch(() => false)
    if (affiliateVisible) {
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

    // Verify success — check for URL change to registered/success page
    // or visible confirmation text (not hidden elements)
    await expect(page).toHaveURL(/\/compete\/e2e-throwdown\/(registered|register\/success)/, {
      timeout: 15000,
    })
  })
})
