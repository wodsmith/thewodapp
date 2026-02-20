import {expect, test} from '@playwright/test'
import {
  TEST_USER,
  isAuthenticated,
  login,
  loginAsTestUser,
  logout,
} from './fixtures/auth'

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({page}) => {
    await page.goto('/workouts')
    await expect(page).toHaveURL(/\/sign-in/)
    // CardTitle renders as <div>, not a heading element — check for the sign-in button instead
    await expect(page.getByRole('button', {name: 'Sign In'})).toBeVisible()
  })

  test('should login with valid test user credentials', async ({page}) => {
    await login(page, {
      email: TEST_USER.email,
      password: TEST_USER.password,
    })

    const authenticated = await isAuthenticated(page)
    expect(authenticated).toBe(true)
  })

  test('should logout successfully', async ({page}) => {
    await loginAsTestUser(page)

    await logout(page)

    await expect(page).toHaveURL(/\/sign-in/)

    await page.goto('/workouts')
    await expect(page).toHaveURL(/\/sign-in/)
  })
})
