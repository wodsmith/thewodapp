import {expect, test} from '@playwright/test'
import {loginAsTestUser, waitForHydration} from './fixtures/auth'

test.describe('Docs drawer', () => {
  // @lat: [[route-docs#Workspace sidebar#Shows seeded docs end to end]]
  test('shows seeded documentation on the organizer dashboard', async ({
    page,
  }) => {
    await loginAsTestUser(page)

    // The dashboard index route (/compete/organizer/_dashboard/) has the
    // seeded "Your first competition" link doc mapped to it.
    await page.goto('/compete/organizer')
    await waitForHydration(page)

    // The floating launcher only renders once published docs are fetched for
    // the current route chain.
    const docsButton = page.getByRole('button', {
      name: 'Open workspace panel',
    })
    await expect(docsButton).toBeVisible({timeout: 15000})

    await docsButton.click()

    // Opening the launcher reveals the workspace panel (a flex aside, not a
    // dialog) with the Documentation tab active.
    const panel = page.getByRole('complementary', {name: 'Workspace'})
    await expect(
      panel.getByRole('heading', {name: 'Documentation'}),
    ).toBeVisible()

    // The seeded "Your first competition" link doc renders as an external
    // anchor pointing at the mapped docs.wodsmith.com URL.
    await expect(
      panel.getByRole('link', {name: 'Your first competition'}),
    ).toHaveAttribute(
      'href',
      'https://docs.wodsmith.com/tutorials/organizers/first-competition',
    )
  })
})
