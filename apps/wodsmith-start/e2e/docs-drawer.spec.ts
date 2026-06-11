import {expect, test} from '@playwright/test'
import {loginAsTestUser, waitForHydration} from './fixtures/auth'

// @lat: [[route-docs#Docs drawer#Shows seeded docs end to end]]
test.describe('Docs drawer', () => {
  test('shows seeded documentation on the organizer dashboard', async ({
    page,
  }) => {
    await loginAsTestUser(page)

    // The dashboard index route (/compete/organizer/_dashboard/) has the
    // seeded "Your first competition" link doc mapped to it.
    await page.goto('/compete/organizer')
    await waitForHydration(page)

    // The floating button only renders once published docs are fetched for
    // the current route chain.
    const docsButton = page.getByRole('button', {
      name: 'Open page documentation',
    })
    await expect(docsButton).toBeVisible({timeout: 15000})

    await docsButton.click()

    const sheet = page.getByRole('dialog')
    await expect(
      sheet.getByRole('heading', {name: 'Documentation'}),
    ).toBeVisible()
    await expect(sheet.getByText('Your first competition')).toBeVisible()

    // Link docs render an external article button with the mapped URL.
    await expect(sheet.getByRole('link', {name: /read article/i})).toHaveAttribute(
      'href',
      'https://docs.wodsmith.com/tutorials/organizers/first-competition',
    )
  })
})
