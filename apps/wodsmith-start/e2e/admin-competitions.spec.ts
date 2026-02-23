import {expect, test} from '@playwright/test'
import {loginAsAdmin, loginAsTestUser} from './fixtures/auth'

test.describe('Admin Competitions', () => {
  test('should load admin competitions page', async ({page}) => {
    await loginAsAdmin(page)
    await page.goto('/admin/competitions')
    await expect(page.getByRole('heading', {name: 'All Competitions'})).toBeVisible({timeout: 15000})
  })

  test('non-admin should not access admin competitions page', async ({page}) => {
    await loginAsTestUser(page)
    await page.goto('/admin/competitions')
    // Admin layout redirects non-admins to /
    await expect(page.getByRole('heading', {name: 'All Competitions'})).not.toBeVisible()
  })
})
