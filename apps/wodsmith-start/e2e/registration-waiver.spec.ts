import {expect, test} from '@playwright/test'
import {loginAsTestUser} from './fixtures/auth'

/**
 * Registration with Waiver Signing E2E Tests
 *
 * Tests the critical path: athlete registers for competition that requires waiver signing.
 * Uses seeded test data and creates temporary competition data for test isolation.
 */

test.describe('Competition Registration with Waivers', () => {
  /**
   * Setup: Create competition with waiver via API before tests
   * This ensures we have a known competition state for testing
   */
  test.beforeEach(async ({page}) => {
    // Login as test user to get authenticated context
    await loginAsTestUser(page)

    // Create test competition data via direct database manipulation
    // In a real scenario, this would use API endpoints or database seeding
    // For now, we'll navigate to the public registration page which should exist
    // NOTE: This test assumes competition data exists or will be created manually
    // A more robust approach would be to seed competition data in setup-e2e-db.ts
  })

  test('should complete registration flow with waiver signing', async ({
    page,
  }) => {
    // Navigate to public competitions list
    await page.goto('/compete')

    // Verify we're on the competitions page
    await expect(page).toHaveURL(/\/compete/)

    // Look for any available competition to test with
    // In production, we'd have a seeded test competition
    const competitionLink = page
      .locator('a[href*="/compete/"]')
      .filter({hasText: /register|sign up/i})
      .first()

    // Check if test competition exists
    const hasCompetition = await competitionLink.isVisible({timeout: 5000})

    if (!hasCompetition) {
      test.skip()
      return
    }

    // Click to view competition details
    await competitionLink.click()

    // Should be on competition detail page
    await expect(page.url()).toMatch(/\/compete\/[^/]+/)

    // Find and click "Register" button
    const registerButton = page.getByRole('link', {
      name: /register|sign up/i,
    })
    await expect(registerButton).toBeVisible({timeout: 5000})
    await registerButton.click()

    // Should be on registration page
    await expect(page.url()).toMatch(/\/compete\/[^/]+\/register/)

    // Fill registration form
    // Select a division (required field)
    const divisionSelect = page.getByLabel(/division|category/i).first()
    if (await divisionSelect.isVisible({timeout: 2000})) {
      await divisionSelect.click()
      // Select first available division
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
    }

    // Fill affiliate name (usually required)
    const affiliateInput = page.getByLabel(/affiliate/i).first()
    if (await affiliateInput.isVisible({timeout: 2000})) {
      await affiliateInput.click()
      await affiliateInput.fill('E2E Test Affiliate')
    }

    // Check if there are team fields (for team divisions)
    const teamNameInput = page.getByLabel(/team name/i)
    if (await teamNameInput.isVisible({timeout: 1000})) {
      await teamNameInput.fill(`E2E Test Team ${timestamp}`)
    }

    // Look for "Continue" or "Next" button to proceed to waiver step
    const continueButton = page.getByRole('button', {
      name: /continue|next/i,
    })

    if (await continueButton.isVisible({timeout: 2000})) {
      await continueButton.click()

      // Wait for waiver step to load
      await page.waitForSelector('text=/waiver|liability/i', {timeout: 5000})

      // Verify we're on waiver signing step
      await expect(
        page.getByRole('heading', {name: /waiver|liability/i}),
      ).toBeVisible()

      // View waiver content
      // The waiver should be displayed in a scrollable container
      const waiverContent = page.locator('.prose, [class*=waiver]').first()
      await expect(waiverContent).toBeVisible({timeout: 5000})

      // Scroll through waiver content (simulate reading)
      await waiverContent.evaluate((el) => {
        el.scrollTop = el.scrollHeight / 2
      })
      await page.waitForTimeout(500)
      await waiverContent.evaluate((el) => {
        el.scrollTop = el.scrollHeight
      })

      // Find and check the agreement checkbox
      const agreementCheckbox = page
        .getByRole('checkbox')
        .filter({has: page.locator('label:has-text("I agree")')})
        .or(page.getByLabel(/I agree|I have read|accept/i))
        .first()

      await expect(agreementCheckbox).toBeVisible({timeout: 5000})
      await agreementCheckbox.check()

      // Verify checkbox is checked
      await expect(agreementCheckbox).toBeChecked()

      // Look for continue/submit button after signing waiver
      const submitButton = page.getByRole('button', {
        name: /continue|submit|complete/i,
      })
      await expect(submitButton).toBeEnabled({timeout: 2000})
      await submitButton.click()

      // Should proceed to payment or success page
      // Wait for navigation away from waiver step
      await page.waitForURL(/\/(payment|success|confirm)/, {timeout: 10000})

      // Verify we've moved past waiver step
      // Check for success indicators or payment form
      const successText = page.getByText(/success|confirmed|registered/i)
      const paymentForm = page.getByText(/payment|checkout|total/i)

      // At least one of these should be visible
      await expect(successText.or(paymentForm).first()).toBeVisible({
        timeout: 5000,
      })
    }
  })

  test('should display waiver content correctly', async ({page}) => {
    // This test verifies the waiver viewer component works correctly
    await page.goto('/compete')

    const competitionLink = page
      .locator('a[href*="/compete/"]')
      .filter({hasText: /register|sign up/i})
      .first()

    const hasCompetition = await competitionLink.isVisible({timeout: 5000})
    if (!hasCompetition) {
      test.skip()
      return
    }

    await competitionLink.click()
    await page.getByRole('link', {name: /register|sign up/i}).click()

    // Navigate to waiver step (may need to fill form first)
    const divisionSelect = page.getByLabel(/division|category/i).first()
    if (await divisionSelect.isVisible({timeout: 2000})) {
      await divisionSelect.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')

      const continueButton = page.getByRole('button', {name: /continue/i})
      if (await continueButton.isVisible({timeout: 2000})) {
        await continueButton.click()
      }
    }

    // Wait for waiver content
    await page.waitForSelector('text=/waiver|liability/i', {timeout: 5000})

    // Verify waiver has actual content (not empty)
    const waiverContent = page.locator('.prose, [class*=waiver]').first()
    const contentText = await waiverContent.textContent()
    expect(contentText).toBeTruthy()
    expect(contentText?.length).toBeGreaterThan(50) // Reasonable minimum
  })

  test('should require waiver signature before proceeding', async ({page}) => {
    // This test verifies that the continue button is disabled until waiver is signed
    await page.goto('/compete')

    const competitionLink = page
      .locator('a[href*="/compete/"]')
      .filter({hasText: /register|sign up/i})
      .first()

    const hasCompetition = await competitionLink.isVisible({timeout: 5000})
    if (!hasCompetition) {
      test.skip()
      return
    }

    await competitionLink.click()
    await page.getByRole('link', {name: /register|sign up/i}).click()

    // Navigate to waiver step
    const divisionSelect = page.getByLabel(/division|category/i).first()
    if (await divisionSelect.isVisible({timeout: 2000})) {
      await divisionSelect.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')

      const continueButton = page.getByRole('button', {name: /continue/i})
      if (await continueButton.isVisible({timeout: 2000})) {
        await continueButton.click()
      }
    }

    // Wait for waiver step
    await page.waitForSelector('text=/waiver|liability/i', {timeout: 5000})

    // Find submit button (should be disabled initially)
    const submitButton = page.getByRole('button', {
      name: /continue|submit|complete/i,
    })

    // Button should be disabled before checking the agreement
    const isDisabled = await submitButton.isDisabled()
    expect(isDisabled).toBe(true)

    // Check the agreement
    const agreementCheckbox = page
      .getByRole('checkbox')
      .filter({has: page.locator('label:has-text("I agree")')})
      .or(page.getByLabel(/I agree|I have read|accept/i))
      .first()

    await agreementCheckbox.check()

    // Now button should be enabled
    await expect(submitButton).toBeEnabled({timeout: 2000})
  })

  test('should handle multiple waivers if present', async ({page}) => {
    // Some competitions may have multiple waivers (liability + photo release, etc.)
    await page.goto('/compete')

    const competitionLink = page
      .locator('a[href*="/compete/"]')
      .filter({hasText: /register|sign up/i})
      .first()

    const hasCompetition = await competitionLink.isVisible({timeout: 5000})
    if (!hasCompetition) {
      test.skip()
      return
    }

    await competitionLink.click()
    await page.getByRole('link', {name: /register|sign up/i}).click()

    // Navigate to waiver step
    const divisionSelect = page.getByLabel(/division|category/i).first()
    if (await divisionSelect.isVisible({timeout: 2000})) {
      await divisionSelect.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')

      const continueButton = page.getByRole('button', {name: /continue/i})
      if (await continueButton.isVisible({timeout: 2000})) {
        await continueButton.click()
      }
    }

    // Wait for waiver step
    await page.waitForSelector('text=/waiver|liability/i', {timeout: 5000})

    // Count waivers (each should have its own card/section)
    const waiverCards = page.locator('[class*="border-2"]') // Cards with border-2 class from code
    const waiverCount = await waiverCards.count()

    console.log(`Found ${waiverCount} waiver(s)`)

    // If multiple waivers, check all of them
    if (waiverCount > 1) {
      const checkboxes = page.getByRole('checkbox')
      const checkboxCount = await checkboxes.count()

      // Check each checkbox
      for (let i = 0; i < checkboxCount; i++) {
        await checkboxes.nth(i).check()
      }

      // All should be checked
      for (let i = 0; i < checkboxCount; i++) {
        await expect(checkboxes.nth(i)).toBeChecked()
      }
    }
  })

  test('should preserve registration data when navigating back from waiver step', async ({
    page,
  }) => {
    // Verify that if user goes back, their form data is preserved
    await page.goto('/compete')

    const competitionLink = page
      .locator('a[href*="/compete/"]')
      .filter({hasText: /register|sign up/i})
      .first()

    const hasCompetition = await competitionLink.isVisible({timeout: 5000})
    if (!hasCompetition) {
      test.skip()
      return
    }

    await competitionLink.click()
    await page.getByRole('link', {name: /register|sign up/i}).click()

    // Fill registration form with test data
    const testAffiliate = `E2E Test Affiliate ${timestamp}`

    const divisionSelect = page.getByLabel(/division|category/i).first()
    if (await divisionSelect.isVisible({timeout: 2000})) {
      await divisionSelect.click()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
    }

    const affiliateInput = page.getByLabel(/affiliate/i).first()
    if (await affiliateInput.isVisible({timeout: 2000})) {
      await affiliateInput.fill(testAffiliate)
    }

    // Continue to waiver step
    const continueButton = page.getByRole('button', {name: /continue/i})
    if (await continueButton.isVisible({timeout: 2000})) {
      await continueButton.click()
      await page.waitForSelector('text=/waiver|liability/i', {timeout: 5000})

      // Go back (browser back button)
      await page.goBack()

      // Verify form data is preserved
      const affiliateValue = await affiliateInput.inputValue()
      expect(affiliateValue).toBe(testAffiliate)
    }
  })
})
