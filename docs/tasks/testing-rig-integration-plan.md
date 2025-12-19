# Testing Rig Integration Plan

> Extracted from analysis of [badass-courses/gremlin](https://github.com/badass-courses/gremlin) monorepo

## Executive Summary

This document outlines a plan to enhance wodsmith's testing infrastructure by adopting patterns from the Gremlin monorepo, which implements a sophisticated, multi-layered testing system combining:

- **Vitest 4.0** for unit/integration testing with workspace coordination
- **Playwright** for E2E testing with intelligent sharding
- **Custom test utilities** (fakes, spies, parameterized adapters)
- **Turbo-powered CI/CD** with parallel execution

---

## Current State Assessment

### What Wodsmith Has

| Component | Status |
|-----------|--------|
| Vitest | 3.2.3 with jsdom |
| Test files | 40+ in `apps/wodsmith/test/` |
| Testing Library | React, jest-dom, user-event |
| D1/Drizzle mocking | Basic chainable mock |
| Playwright E2E | Not configured |
| Workspace orchestration | None |
| Shared test utilities | None (inline in app) |
| CI test pipeline | None |

### What Gremlin Has (Target State)

| Component | Implementation |
|-----------|----------------|
| Vitest | 4.0.16 with workspace config |
| Test utilities | Shared `@badass/test-utils` package |
| Fakes | In-memory DB, KV implementations |
| Factories | Test data generators |
| Playwright | Sharded E2E with blob reporting |
| CI/CD | Parallel jobs, Turbo caching, report merging |

---

## Phase 1: Foundation - Test Utilities Package

### 1.1 Create `packages/test-utils`

```
packages/
└── test-utils/
    ├── package.json
    ├── tsconfig.json
    ├── index.ts           # Main exports
    ├── vitest-base.ts     # Shared Vitest config
    ├── fakes/
    │   ├── index.ts
    │   ├── fake-db.ts     # In-memory D1/Drizzle mock
    │   └── fake-kv.ts     # In-memory KV mock
    ├── factories/
    │   ├── index.ts
    │   ├── user.ts        # User test data factory
    │   ├── team.ts        # Team test data factory
    │   └── workout.ts     # Workout test data factory
    └── helpers/
        ├── index.ts
        ├── spy.ts         # createSpy() utility
        └── delay.ts       # async delay helper
```

### 1.2 Package Configuration

```json
{
  "name": "@wodsmith/test-utils",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.ts",
    "./vitest": "./vitest-base.ts",
    "./fakes": "./fakes/index.ts",
    "./factories": "./factories/index.ts"
  },
  "peerDependencies": {
    "vitest": "^3.0.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  }
}
```

### 1.3 Shared Vitest Base Config

```typescript
// packages/test-utils/vitest-base.ts
import { defineConfig } from "vitest/config"

export const baseConfig = defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      enabled: false,
      exclude: ["**/node_modules/**", "**/test/**"]
    },
    include: ["**/*.{test,spec}.{ts,tsx}"]
  }
})

export { mergeConfig } from "vitest/config"
```

### 1.4 FakeDatabase Implementation

Replace current chainable mock with a proper in-memory implementation:

```typescript
// packages/test-utils/fakes/fake-db.ts
export class FakeDatabase<TSchema extends Record<string, unknown>> {
  private tables = new Map<string, Map<string, unknown>>()

  getTable<K extends keyof TSchema>(name: K): Map<string, TSchema[K]> {
    if (!this.tables.has(name as string)) {
      this.tables.set(name as string, new Map())
    }
    return this.tables.get(name as string) as Map<string, TSchema[K]>
  }

  insert<K extends keyof TSchema>(
    table: K,
    data: Omit<TSchema[K], "id"> & { id?: string }
  ): TSchema[K] {
    const id = data.id ?? generateCuid2()
    const record = { ...data, id } as TSchema[K]
    this.getTable(table).set(id, record)
    return record
  }

  findById<K extends keyof TSchema>(table: K, id: string): TSchema[K] | null {
    return this.getTable(table).get(id) ?? null
  }

  findMany<K extends keyof TSchema>(
    table: K,
    predicate?: (item: TSchema[K]) => boolean
  ): TSchema[K][] {
    const items = Array.from(this.getTable(table).values())
    return predicate ? items.filter(predicate) : items
  }

  update<K extends keyof TSchema>(
    table: K,
    id: string,
    data: Partial<TSchema[K]>
  ): TSchema[K] | null {
    const existing = this.findById(table, id)
    if (!existing) return null
    const updated = { ...existing, ...data, updatedAt: new Date() }
    this.getTable(table).set(id, updated)
    return updated
  }

  delete(table: string, id: string): boolean {
    return this.tables.get(table)?.delete(id) ?? false
  }

  reset(): void {
    this.tables.clear()
  }
}
```

### 1.5 Test Factories

```typescript
// packages/test-utils/factories/team.ts
import { createId } from "@paralleldrive/cuid2"

export interface TeamFactory {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export function createTeam(overrides?: Partial<TeamFactory>): TeamFactory {
  const id = createId()
  return {
    id,
    name: `Test Team ${id.slice(0, 4)}`,
    slug: `test-team-${id.slice(0, 4)}`,
    ownerId: createId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
```

---

## Phase 2: Vitest Workspace Configuration

### 2.1 Root Workspace Config

```typescript
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
  "apps/*/vitest.config.{ts,mjs}",
  "packages/*/vitest.config.{ts,mjs}"
])
```

### 2.2 Update App Config

```typescript
// apps/wodsmith/vitest.config.ts
import { mergeConfig } from "vitest/config"
import { baseConfig } from "@wodsmith/test-utils/vitest"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import { resolve } from "node:path"

export default mergeConfig(baseConfig, {
  test: {
    name: "wodsmith",
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["./test/**/*.test.{ts,tsx}"]
  },
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": resolve(__dirname, "./test/__mocks__/server-only.js"),
      "@": resolve(__dirname, "./src")
    }
  }
})
```

---

## Phase 3: Playwright E2E Setup

### 3.1 Install Dependencies

```bash
pnpm add -D @playwright/test --filter wodsmith
```

### 3.2 Playwright Configuration

```typescript
// apps/wodsmith/playwright.config.ts
import { defineConfig, devices } from "@playwright/test"

const isCI = !!process.env.CI
const baseURL = "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? "50%" : undefined,

  reporter: isCI
    ? [
        ["blob"],
        ["github"],
        ["list"]
      ]
    : [["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],

  webServer: {
    command: isCI ? "pnpm start" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000
  }
})
```

### 3.3 E2E Directory Structure

```
apps/wodsmith/
└── e2e/
    ├── fixtures/
    │   ├── auth.ts        # Authentication helpers
    │   └── test-data.ts   # Seeded test data
    ├── pages/
    │   ├── login.ts       # Login page object
    │   └── dashboard.ts   # Dashboard page object
    ├── auth.spec.ts       # Authentication flows
    ├── workout.spec.ts    # Workout management
    └── programming.spec.ts # Programming tracks
```

---

## Phase 4: CI/CD Integration

### 4.1 CI Workflow

```yaml
# .github/workflows/ci.yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
  FORCE_COLOR: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build
      - uses: actions/cache/save@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}

  test:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test
        env:
          NODE_ENV: test

  typecheck:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo type-check

  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
```

### 4.2 E2E Workflow

```yaml
# .github/workflows/e2e.yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize]

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2]
        shardTotal: [2]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=wodsmith
      - run: npx playwright install chromium
      - run: pnpm --filter wodsmith exec playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: blob-report-${{ matrix.shardIndex }}
          path: apps/wodsmith/blob-report/
          retention-days: 1

  merge-reports:
    needs: e2e
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

---

## Phase 5: Turbo Configuration Updates

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "test/**",
        "tests/**",
        "__tests__/**",
        "vitest.config.*",
        "tsconfig.json"
      ],
      "outputs": ["coverage/**"]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "e2e": {
      "dependsOn": ["build"],
      "inputs": [
        "e2e/**",
        "src/**",
        "playwright.config.ts"
      ],
      "outputs": ["playwright-report/**", "test-results/**"]
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Create `packages/test-utils` with fakes/factories | Medium | High |
| **P0** | Add Vitest workspace config | Low | Medium |
| **P1** | Setup Playwright with basic smoke tests | Medium | High |
| **P1** | Add CI workflow for unit tests | Low | High |
| **P2** | Add E2E CI workflow with sharding | Medium | Medium |
| **P2** | Migrate existing mocks to fake implementations | High | Medium |
| **P3** | Add coverage reporting | Low | Low |

---

## Files to Create/Modify

### New Files

1. `packages/test-utils/package.json`
2. `packages/test-utils/tsconfig.json`
3. `packages/test-utils/index.ts`
4. `packages/test-utils/vitest-base.ts`
5. `packages/test-utils/fakes/*.ts`
6. `packages/test-utils/factories/*.ts`
7. `packages/test-utils/helpers/*.ts`
8. `vitest.workspace.ts`
9. `apps/wodsmith/playwright.config.ts`
10. `apps/wodsmith/e2e/*.spec.ts`
11. `.github/workflows/ci.yaml`
12. `.github/workflows/e2e.yaml`

### Modified Files

1. `package.json` - Add workspace scripts
2. `turbo.json` - Add test/e2e task configs
3. `apps/wodsmith/vitest.config.mjs` → `vitest.config.ts` (use shared base)
4. `apps/wodsmith/package.json` - Add Playwright, update Vitest
5. `apps/wodsmith/test/setup.ts` - Use new fakes

---

## Key Patterns from Gremlin

### 1. Fakes Over Mocks

Gremlin prefers **fakes** (working implementations with shortcuts) over **mocks** (vi.fn() stubs):

- More realistic testing
- Tests behavior, not implementation details
- Reduces test brittleness
- Shared across test suites

### 2. Parameterized Adapter Tests

Test interface implementations with a single test suite:

```typescript
runContentResourceAdapterTests({
  name: "DrizzleAdapter",
  createAdapter: () => ({
    adapter: new DrizzleAdapter(db),
    cleanup: () => db.reset()
  }),
  skipTests: ["optional-feature"]
})
```

### 3. Effect.ts Integration (Optional)

If we adopt Effect.ts in the future:

```typescript
import { testEffect } from "@wodsmith/test-utils/effect"
import { Effect } from "effect"

testEffect("my effect test", () =>
  Effect.gen(function* () {
    const result = yield* myEffect
    expect(result).toBe(expected)
  })
)
```

---

## References

- [Gremlin Repository](https://github.com/badass-courses/gremlin)
- [Vitest Workspace Documentation](https://vitest.dev/guide/workspace)
- [Playwright Sharding](https://playwright.dev/docs/test-sharding)
- [Turbo Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
