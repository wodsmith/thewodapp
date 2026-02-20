import {expect, test} from '@playwright/test'
import {
  ADMIN_USER,
  TEST_USER,
  isAuthenticated,
  login,
  loginAsTestUser,
  logout,
} from './fixtures/auth'

/**
 * Authentication E2E Tests
 *
 * Tests authentication flows using seeded test data from seed-e2e.sql.
 * The database is automatically seeded via globalSetup before tests run.
 *
 * SKIPPED: Tests need to be updated for wodsmith-start UI differences.
 * TODO: Update selectors and expected text to match wodsmith-start.
 */

test.describe('Authentication', () => {
  test('should show login page', async ({page}) => {
    await page.goto('/sign-in')

    // Verify page loaded
    await expect(page).toHaveURL(/\/sign-in/)

    // Verify form elements are visible
    await expect(page.getByRole('heading', {name: /sign in/i})).toBeVisible()
    await expect(page.getByPlaceholder(/email/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
    await expect(
      page.getByRole('button', {name: /sign in/i}),
    ).toBeVisible()
  })

  test('should redirect unauthenticated users to login', async ({page}) => {
    // Visit protected route without authentication
    await page.goto('/workouts')

    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/sign-in/)

    // Should show login form
    await expect(page.getByRole('heading', {name: /sign in/i})).toBeVisible()
  })

  test('should login with valid test user credentials', async ({page}) => {
    // Use the test user from seeded data
    await login(page, {
      email: TEST_USER.email,
      password: TEST_USER.password,
    })

    // Should redirect to workouts or dashboard after successful login
    await expect(page).toHaveURL(/\/(workouts|dashboard)/)

    // Verify we're authenticated
    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)
  })

  test('should login with admin user credentials', async ({page}) => {
    await login(page, {
      email: ADMIN_USER.email,
      password: ADMIN_USER.password,
    })

    // Should redirect after successful login
    await expect(page).toHaveURL(/\/(workouts|dashboard)/)

    // Verify we're authenticated
    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)
  })

  test('should show error for invalid credentials', async ({page}) => {
    await page.goto('/sign-in')

    // Fill in the login form with wrong password
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email)
    await page.getByPlaceholder(/password/i).fill('wrongpassword123')

    // Submit the form
    await page.getByRole('button', {name: /sign in/i}).click()

    // Should stay on sign-in page
    await expect(page).toHaveURL(/\/sign-in/)

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({
      timeout: 5000,
    })
  })

  test('should show error for non-existent user', async ({page}) => {
    await page.goto('/sign-in')

    // Fill in the login form with non-existent email
    await page.getByPlaceholder(/email/i).fill('nonexistent@example.com')
    await page.getByPlaceholder(/password/i).fill('somepassword')

    // Submit the form
    await page.getByRole('button', {name: /sign in/i}).click()

    // Should stay on sign-in page
    await expect(page).toHaveURL(/\/sign-in/)

    // Should show error message
    await expect(
      page.getByText(/invalid|incorrect|not found|wrong/i),
    ).toBeVisible({timeout: 5000})
  })

  test('should logout successfully', async ({page}) => {
    // First, login as test user
    await loginAsTestUser(page)

    // Verify we're on authenticated page
    await expect(page).toHaveURL(/\/(workouts|dashboard)/)

    // Logout
    await logout(page)

    // The app redirects to /sign-in after logout (see logout-button.tsx)
    // Then verify we're logged out by trying to access a protected route
    await expect(page).toHaveURL(/\/sign-in/)

    // Verify we're logged out by trying to access protected route
    await page.goto('/workouts')
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test('should persist session across page navigation', async ({page}) => {
    // Login
    await loginAsTestUser(page)
    await expect(page).toHaveURL(/\/(workouts|dashboard)/)

    // Navigate to another protected page
    await page.goto('/workouts')
    await expect(page).toHaveURL(/\/workouts/)

    // Should still be authenticated
    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)
  })
})
