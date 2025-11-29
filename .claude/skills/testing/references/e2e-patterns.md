# E2E Test Patterns (Playwright)

## Table of Contents

1. [Playwright Config](#playwright-config)
2. [Auth Handling](#auth-handling)
3. [Page Object Model](#page-object-model)
4. [Test Data Setup](#test-data-setup)
5. [CI Integration](#ci-integration)

## Playwright Config

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  fullyParallel: true,

  reporter: [
    ['html', { open: 'never' }],
    process.env.CI ? ['github'] : ['line'],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

## Auth Handling

### Auth State Persistence

Save logged-in state to reuse across tests:

```typescript
// e2e/fixtures/auth.fixture.ts
import { test as base, type Page } from '@playwright/test'

export const TEST_USERS = {
  member: { email: 'e2e-member@test.com', password: 'TestPass123!' },
  admin: { email: 'e2e-admin@test.com', password: 'TestPass123!' },
}

export async function loginAs(page: Page, userType: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userType]

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL('/workouts')
}

// Extended test fixture with auth
export const test = base.extend<{ loginAs: (type: keyof typeof TEST_USERS) => Promise<void> }>({
  loginAs: async ({ page }, use) => {
    await use(async (userType) => {
      await loginAs(page, userType)
    })
  },
})
```

### Global Setup for Auth State

```typescript
// e2e/global-setup.ts
import { chromium } from '@playwright/test'
import { TEST_USERS, loginAs } from './fixtures/auth.fixture'

async function globalSetup() {
  const browser = await chromium.launch()

  for (const [userType] of Object.entries(TEST_USERS)) {
    const context = await browser.newContext()
    const page = await context.newPage()

    await loginAs(page, userType as keyof typeof TEST_USERS)
    await context.storageState({ path: `.auth/${userType}.json` })

    await context.close()
  }

  await browser.close()
}

export default globalSetup
```

### Using Saved Auth State

```typescript
// e2e/tests/workouts/workout-crud.spec.ts
import { test, expect } from '@playwright/test'

test.use({ storageState: '.auth/admin.json' })

test('admin can create workout', async ({ page }) => {
  await page.goto('/workouts')
  // Already logged in as admin
})
```

## Page Object Model

### Auth Page

```typescript
// e2e/pages/auth.page.ts
import { type Page, type Locator, expect } from '@playwright/test'

export class AuthPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly signInButton: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.signInButton = page.getByRole('button', { name: /sign in/i })
  }

  async goto() {
    await this.page.goto('/sign-in')
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.signInButton.click()
  }

  async expectSignedIn() {
    await expect(this.page).toHaveURL('/workouts')
  }
}
```

### Competition Page

```typescript
// e2e/pages/compete.page.ts
import { type Page, type Locator, expect } from '@playwright/test'

export class CompetePage {
  readonly page: Page
  readonly registerButton: Locator

  constructor(page: Page) {
    this.page = page
    this.registerButton = page.getByRole('button', { name: /register/i })
  }

  async goto(competitionSlug: string) {
    await this.page.goto(`/compete/${competitionSlug}`)
  }

  async register(options: { division: string }) {
    await this.registerButton.click()
    await this.page.getByLabel('Division').selectOption(options.division)
    await this.page.getByRole('button', { name: /submit/i }).click()
  }

  async expectRegistrationSuccess() {
    await expect(this.page.getByText(/successfully registered/i)).toBeVisible()
  }
}
```

## Test Data Setup

### SQL Seed File

```sql
-- e2e/fixtures/seed-e2e.sql
-- Create E2E test users (password hash for 'TestPass123!')
INSERT OR REPLACE INTO user (id, email, firstName, lastName, passwordHash, role, emailVerified) VALUES
('usr_e2e_member', 'e2e-member@test.com', 'E2E', 'Member', '$argon2id$v=19$m=65536,t=3,p=4$...', 'user', strftime('%s', 'now')),
('usr_e2e_admin', 'e2e-admin@test.com', 'E2E', 'Admin', '$argon2id$v=19$m=65536,t=3,p=4$...', 'admin', strftime('%s', 'now'));

-- Create E2E test team
INSERT OR REPLACE INTO team (id, name, slug, type, isPersonalTeam) VALUES
('team_e2e', 'E2E Test Team', 'e2e-test-team', 'gym', 0);

-- Team memberships
INSERT OR REPLACE INTO team_membership (id, teamId, userId, roleId, isSystemRole) VALUES
('tmem_e2e_admin', 'team_e2e', 'usr_e2e_admin', 'owner', 1),
('tmem_e2e_member', 'team_e2e', 'usr_e2e_member', 'member', 1);

-- E2E Competition
INSERT OR REPLACE INTO competitions (id, organizingTeamId, slug, name, startDate, endDate, registrationOpensAt, registrationClosesAt) VALUES
('comp_e2e', 'team_e2e', 'e2e-test-comp', 'E2E Test Competition',
 strftime('%s', 'now', '+30 days'), strftime('%s', 'now', '+31 days'),
 strftime('%s', 'now', '-1 day'), strftime('%s', 'now', '+29 days'));
```

### Package.json Scripts

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:headed": "playwright test --headed",
    "e2e:seed": "wrangler d1 execute DB --local --file=./e2e/fixtures/seed-e2e.sql",
    "e2e:reset": "wrangler d1 execute DB --local --command=\"DELETE FROM user WHERE email LIKE 'e2e-%'\""
  }
}
```

## CI Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 23
          cache: pnpm

      - run: pnpm install
      - run: pnpm dlx playwright install --with-deps chromium

      - name: Setup database
        run: |
          pnpm db:migrate:dev
          pnpm e2e:seed

      - name: Build
        run: pnpm build

      - name: Run E2E
        run: |
          pnpm start &
          sleep 10
          pnpm e2e
        env:
          E2E_BASE_URL: http://localhost:3000

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## Best Practices

1. **Use stable selectors**: Prefer `getByRole`, `getByLabel` over CSS selectors
2. **Wait for network**: Use `waitForLoadState('networkidle')` after navigation
3. **Isolate tests**: Each test should be independent
4. **Data cleanup**: Use unique identifiers or cleanup between tests
5. **Flakiness**: Add retries in CI, use explicit waits
