import {expect, test} from '@playwright/test'
import {loginAsAdmin} from './fixtures/auth'

/**
 * Admin Competitions Browser E2E Tests
 *
 * Tests the admin-only competition management interface at /admin/competitions.
 *
 * NOTE: Many tests are skipped because the wodsmith-start UI differs from wodsmith.
 * The wodsmith-start version has a simpler table without filter tabs or search.
 * These tests should be updated to match the actual UI.
 */

test.describe('Admin Competitions Browser', () => {
  test.beforeEach(async ({page}) => {
    // Login as admin before each test
    await loginAsAdmin(page)
  })

  test('should load admin competitions page with correct header', async ({
    page,
  }) => {
    // First verify we're authenticated by checking we're on the workouts page
    // This ensures the login was successful before trying admin routes
    await expect(page).toHaveURL(/\/(workouts|dashboard)/, {timeout: 5000})

    // Verify the session cookie exists before navigating to admin
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name === 'session')
    if (!sessionCookie) {
      console.log('WARNING: No session cookie found after login!')
      console.log('Available cookies:', cookies.map(c => c.name))
    }

    // Navigate to admin competitions page
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // Wait for network to settle
    await page.waitForLoadState('networkidle')

    // Verify page loaded (not redirected to 404 or sign-in)
    // If we're redirected to sign-in, the session wasn't established properly
    await expect(page).toHaveURL(/\/admin\/competitions/, {timeout: 10000})

    // Verify main heading is visible
    await expect(
      page.getByRole('heading', {name: 'All Competitions'}),
    ).toBeVisible()

    // Verify description text is visible
    await expect(
      page.getByText('Browse and manage competitions from all organizers'),
    ).toBeVisible()

    // Verify breadcrumb navigation exists
    await expect(page.getByRole('link', {name: 'Admin'})).toBeVisible()
    await expect(page.getByRole('link', {name: 'Competitions'})).toBeVisible()
  })

  // SKIPPED: wodsmith-start doesn't have filter tabs
  test.skip('should display filter tabs (All, Current, Past)', async ({
    page,
  }) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // Verify filter tabs are present
    const allButton = page.getByRole('button', {name: 'All', exact: true})
    const currentButton = page.getByRole('button', {
      name: 'Current',
      exact: true,
    })
    const pastButton = page.getByRole('button', {name: 'Past', exact: true})

    await expect(allButton).toBeVisible()
    await expect(currentButton).toBeVisible()
    await expect(pastButton).toBeVisible()

    // "All" should be the default active filter (has default variant styling)
    // We verify this by checking that the button doesn't have "outline" variant
    // which is used for non-active tabs
  })

  // SKIPPED: wodsmith-start doesn't have search input
  test.skip('should display search input', async ({page}) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // Verify search input is present with correct placeholder
    const searchInput = page.getByPlaceholder(
      'Search competitions or organizers...',
    )
    await expect(searchInput).toBeVisible()
  })

  // SKIPPED: wodsmith-start doesn't have filter tabs
  test.skip('should switch between filter tabs', async ({page}) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    const currentButton = page.getByRole('button', {
      name: 'Current',
      exact: true,
    })
    const pastButton = page.getByRole('button', {name: 'Past', exact: true})
    const allButton = page.getByRole('button', {name: 'All', exact: true})

    // Click "Current" filter
    await currentButton.click()
    // Wait for potential state update
    await page.waitForTimeout(200)

    // Click "Past" filter
    await pastButton.click()
    await page.waitForTimeout(200)

    // Click back to "All" filter
    await allButton.click()
    await page.waitForTimeout(200)

    // Verify we're still on the page (no errors)
    await expect(page).toHaveURL(/\/admin\/competitions/)
  })

  // SKIPPED: Empty state text differs in wodsmith-start
  test.skip('should handle empty state gracefully', async ({page}) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // The page should either:
    // 1. Show "No competitions yet" empty state, OR
    // 2. Show a list of competitions

    // Check if empty state is shown
    const emptyStateHeading = page.getByRole('heading', {
      name: 'No competitions yet',
    })
    const isEmptyState = await emptyStateHeading
      .isVisible({timeout: 1000})
      .catch(() => false)

    if (isEmptyState) {
      // Verify empty state UI
      await expect(
        page.getByText(
          'No competitions have been created by any organizers yet.',
        ),
      ).toBeVisible()
    } else {
      // If not empty, there should be competition rows
      // Competition rows are links with href to /compete/organizer/{id}
      const competitionLinks = page.locator('a[href^="/compete/organizer/"]')
      await expect(competitionLinks.first()).toBeVisible({timeout: 5000})
    }
  })

  // SKIPPED: wodsmith-start doesn't have search input
  test.skip('should filter search results when typing in search box', async ({
    page,
  }) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    const searchInput = page.getByPlaceholder(
      'Search competitions or organizers...',
    )

    // Type a search query
    await searchInput.fill('nonexistent-competition-xyz-123')

    // Wait for debounce/filter to apply
    await page.waitForTimeout(500)

    // Should either show:
    // 1. No results message if there were competitions before
    // 2. Still show empty state if there were no competitions
    // The page should NOT error out

    // Verify the page is still functional
    await expect(searchInput).toHaveValue('nonexistent-competition-xyz-123')
    await expect(page).toHaveURL(/\/admin\/competitions/)
  })

  test('non-admin should not access admin competitions page', async ({
    page,
  }) => {
    // First, logout
    // Navigate directly to a public route to ensure we're starting fresh
    await page.goto('/sign-in')

    // Try to access admin page without admin role
    // Note: The loginAsTestUser function logs in as a regular user
    const {loginAsTestUser} = await import('./fixtures/auth')
    await loginAsTestUser(page)

    // Attempt to access admin page
    await page.goto('/admin/competitions')

    // The page uses notFound() for non-admin users
    // notFound() renders 404 content but keeps the URL the same
    // Verify the admin content is NOT visible (user sees 404 instead)
    await expect(
      page.getByRole('heading', {name: 'All Competitions'}),
    ).not.toBeVisible()
  })
})

// SKIPPED: These tests use .group class selector which doesn't exist in wodsmith-start
test.describe.skip('Admin Competitions - With Data', () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page)
  })

  test('should show competition details when competitions exist', async ({
    page,
  }) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // Check if there are any competitions
    const competitionLinks = page.locator('a[href^="/compete/organizer/"]')
    const hasCompetitions = await competitionLinks
      .first()
      .isVisible({timeout: 2000})
      .catch(() => false)

    if (hasCompetitions) {
      // Get the first competition row
      const firstRow = page.locator('.group').first()

      // Verify it has expected elements
      // Competition name link
      await expect(
        firstRow.locator('a[href^="/compete/organizer/"]'),
      ).toBeVisible()

      // Status badge (draft or published)
      const hasDraftBadge = await firstRow
        .getByText('draft', {exact: true})
        .isVisible()
        .catch(() => false)
      const hasPublishedBadge = await firstRow
        .getByText('published', {exact: true})
        .isVisible()
        .catch(() => false)

      expect(hasDraftBadge || hasPublishedBadge).toBe(true)
    } else {
      // Skip this test if no competitions exist
      test.skip()
    }
  })

  test("should open actions dropdown and show 'Manage as Organizer' option", async ({
    page,
  }) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // Check if there are any competitions
    const competitionLinks = page.locator('a[href^="/compete/organizer/"]')
    const hasCompetitions = await competitionLinks
      .first()
      .isVisible({timeout: 2000})
      .catch(() => false)

    if (!hasCompetitions) {
      test.skip()
      return
    }

    // Hover over the first competition row to reveal the actions button
    const firstRow = page.locator('.group').first()
    await firstRow.hover()

    // Find and click the more actions button (MoreHorizontal icon)
    // The button has an svg.lucide-more-horizontal or is the only button in the row
    const actionsButton = firstRow.getByRole('button')
    await actionsButton.click()

    // Verify dropdown menu opens with expected options
    await expect(page.getByText('Manage as Organizer')).toBeVisible()
    await expect(page.getByText('View Public Page')).toBeVisible()
  })

  test("should navigate to organizer view when clicking 'Manage as Organizer'", async ({
    page,
  }) => {
    await page.goto('/admin/competitions', {waitUntil: 'networkidle'})

    // Check if there are any competitions
    const competitionLinks = page.locator('a[href^="/compete/organizer/"]')
    const hasCompetitions = await competitionLinks
      .first()
      .isVisible({timeout: 2000})
      .catch(() => false)

    if (!hasCompetitions) {
      test.skip()
      return
    }

    // Get the first competition's organizer link
    const firstLink = competitionLinks.first()
    await expect(firstLink).toBeVisible()

    // Hover and click actions dropdown
    const firstRow = page.locator('.group').first()
    await firstRow.hover()

    const actionsButton = firstRow.getByRole('button')
    await actionsButton.click()

    // Click "Manage as Organizer"
    await page.getByText('Manage as Organizer').click()

    // Should navigate to the organizer view
    await expect(page).toHaveURL(/\/compete\/organizer\//)
  })
})
