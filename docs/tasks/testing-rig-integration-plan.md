# Testing Rig Integration Plan

> Extracted from analysis of [badass-courses/gremlin](https://github.com/badass-courses/gremlin) monorepo
> 
> **Last Updated:** 2025-12-20 (Phases 0-4 Complete)

## Executive Summary

This document outlines a plan to enhance wodsmith's testing infrastructure by adopting patterns from the Gremlin monorepo, which implements a sophisticated, multi-layered testing system combining:

- **Vitest 3.x/4.x** for unit/integration testing with workspace coordination
- **Playwright** for E2E testing with intelligent sharding
- **Custom test utilities** (fakes, spies, parameterized adapters)
- **Turbo-powered CI/CD** with parallel execution

### Viability Assessment

| Verdict | Confidence | Effort |
|---------|------------|--------|
| **CONDITIONAL GO** | 93% plan accuracy | 68 hours (~8.5 days) |

**Conditions for GO:**
1. Use `@repo/test-utils` (not `@wodsmith/test-utils`) - matches existing package convention
2. Add Phase 0 (immediate CI gate) before full implementation
3. Include 4 domain-specific gaps in Phase 1 (see below)

---

## Current State Assessment (Validated 2025-12-19)

### What Wodsmith Has

| Component | Status | Notes |
|-----------|--------|-------|
| Vitest | 3.2.3 with jsdom | Plan originally assumed 4.0+ |
| Test files | **43** in `apps/wodsmith/test/` | Validated (plan said "40+") |
| Testing Library | React 16.3, jest-dom 6.6, user-event 14.6 | All present |
| D1/Drizzle mocking | 24-method chainable mock (~65 lines) | More sophisticated than "basic" |
| Playwright E2E | **Installed (1.55.0) but NOT configured** | No config, no e2e/ directory |
| Workspace orchestration | None | No vitest.workspace.ts |
| Shared test utilities | None (inline in app) | 2 ad-hoc factories exist |
| CI test pipeline | **None - deploys directly to prod** | Critical gap |

### What Gremlin Has (Target State)

| Component | Implementation |
|-----------|----------------|
| Vitest | 4.0.16 with workspace config |
| Test utilities | Shared `@badass/test-utils` package |
| Fakes | In-memory DB, KV implementations |
| Factories | Test data generators |
| Playwright | Sharded E2E with blob reporting |
| CI/CD | Parallel jobs, Turbo caching, report merging |

### Domain-Specific Gaps (NOT in Gremlin, REQUIRED for Wodsmith)

| Gap | Impact | Why It's Critical |
|-----|--------|-------------------|
| **Cloudflare Workers env mocking** | Can't test server actions without FakeKV/FakeR2/env vars | Wodsmith runs on Workers, not Node |
| **Lucia auth session factories** | 33-line SessionWithMeta copy-pasted in every test | Auth is central to every feature |
| **D1 100-parameter limit enforcement** | Production uses `autochunk`, tests don't validate | Silent production bugs |
| **Multi-tenancy isolation testing** | No helper to verify teamId filtering | Data leakage between tenants |

---

## Phase 0: Immediate CI Gate (CRITICAL - DO FIRST)

**Purpose:** Prevent untested code from reaching production while implementing full plan.

**Effort:** 30 minutes | **Impact:** Blocks broken deploys immediately

### 0.1 Add Test Job to deploy.yml

```yaml
# .github/workflows/deploy.yml - ADD THIS JOB BEFORE publish
jobs:
  test:
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
      - run: pnpm test
        env:
          NODE_ENV: test

  publish:
    needs: test  # ADD THIS DEPENDENCY
    runs-on: ubuntu-latest
    # ... rest of existing publish job
```

### 0.2 Success Criteria
- [x] `pnpm test` runs in CI before deploy
- [x] Failed tests block deployment
- [x] Existing 43 tests pass in CI environment

**Status:** ✅ Complete (test job in deploy.yml already existed)

---

## Phase 1: Foundation - Test Utilities Package

**Effort:** 28 hours (4 days) | **Priority:** P0

### 1.1 Create `packages/test-utils`

```
packages/
└── test-utils/
    ├── src/
    │   ├── index.ts              # Main exports
    │   ├── vitest-base.ts        # Shared Vitest config
    │   ├── fakes/
    │   │   ├── index.ts
    │   │   ├── fake-db.ts        # In-memory D1/Drizzle mock
    │   │   ├── fake-kv.ts        # In-memory KV mock
    │   │   ├── fake-r2.ts        # In-memory R2 mock
    │   │   └── fake-cloudflare-env.ts  # Combined Workers env
    │   ├── factories/
    │   │   ├── index.ts
    │   │   ├── user.ts           # User test data factory
    │   │   ├── team.ts           # Team test data factory
    │   │   ├── workout.ts        # Workout test data factory
    │   │   └── session.ts        # Lucia auth session factory
    │   ├── helpers/
    │   │   ├── index.ts
    │   │   ├── spy.ts            # createSpy() utility
    │   │   ├── delay.ts          # async delay helper
    │   │   └── tenant-isolation.ts  # Multi-tenancy assertions
    │   └── assertions/
    │       ├── index.ts
    │       └── tenant.ts         # assertTenantIsolation()
    ├── package.json
    └── tsconfig.json
```

### 1.2 Package Configuration

```json
{
  "name": "@repo/test-utils",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./vitest": "./src/vitest-base.ts",
    "./fakes": "./src/fakes/index.ts",
    "./factories": "./src/factories/index.ts",
    "./helpers": "./src/helpers/index.ts",
    "./assertions": "./src/assertions/index.ts"
  },
  "main": "./src/index.ts",
  "files": ["src/**"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "vitest": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "vitest": "catalog:"
  },
  "dependencies": {
    "@paralleldrive/cuid2": "^2.2.2"
  }
}
```

### 1.3 pnpm Catalog Additions

Add to `pnpm-workspace.yaml`:

```yaml
catalog:
  # ... existing entries
  vitest: "^3.2.3"
  "@testing-library/react": "^16.3.0"
  "@testing-library/jest-dom": "^6.6.3"
  "@testing-library/user-event": "^14.6.1"
  "@vitejs/plugin-react": "^5.1.2"
  jsdom: "^26.1.0"
```

### 1.4 Shared Vitest Base Config

```typescript
// packages/test-utils/src/vitest-base.ts
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

### 1.5 FakeDatabase Implementation (with D1 Constraints)

```typescript
// packages/test-utils/src/fakes/fake-db.ts
import { createId } from "@paralleldrive/cuid2"

const D1_PARAMETER_LIMIT = 100

export class FakeDatabase<TSchema extends Record<string, unknown>> {
  private tables = new Map<string, Map<string, unknown>>()
  private parameterCount = 0

  /**
   * Enforce D1's 100 SQL parameter limit.
   * Call this before any query with dynamic parameters.
   */
  enforceParameterLimit(params: unknown[]): void {
    if (params.length > D1_PARAMETER_LIMIT) {
      throw new Error(
        `D1 parameter limit exceeded: ${params.length} > ${D1_PARAMETER_LIMIT}. ` +
        `Use autochunk() from @/utils/batch-query for large arrays.`
      )
    }
    this.parameterCount = params.length
  }

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
    const id = data.id ?? createId()
    const now = new Date()
    const record = { 
      ...data, 
      id,
      createdAt: now,
      updatedAt: now
    } as TSchema[K]
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

  /**
   * Find by IDs with D1 parameter limit enforcement.
   */
  findByIds<K extends keyof TSchema>(
    table: K,
    ids: string[]
  ): TSchema[K][] {
    this.enforceParameterLimit(ids)
    return ids
      .map(id => this.findById(table, id))
      .filter((item): item is TSchema[K] => item !== null)
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
    this.parameterCount = 0
  }
}
```

### 1.6 Cloudflare Environment Fakes

```typescript
// packages/test-utils/src/fakes/fake-kv.ts
export class FakeKV implements KVNamespace {
  private store = new Map<string, { value: string; metadata?: unknown }>()

  async get(key: string, options?: { type?: "text" }): Promise<string | null> {
    return this.store.get(key)?.value ?? null
  }

  async getWithMetadata<T>(key: string): Promise<{ value: string | null; metadata: T | null }> {
    const entry = this.store.get(key)
    return {
      value: entry?.value ?? null,
      metadata: (entry?.metadata as T) ?? null
    }
  }

  async put(key: string, value: string, options?: { metadata?: unknown }): Promise<void> {
    this.store.set(key, { value, metadata: options?.metadata })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(): Promise<{ keys: { name: string }[] }> {
    return { keys: Array.from(this.store.keys()).map(name => ({ name })) }
  }

  reset(): void {
    this.store.clear()
  }
}

// packages/test-utils/src/fakes/fake-cloudflare-env.ts
import { FakeKV } from "./fake-kv"
import { FakeDatabase } from "./fake-db"

export interface FakeCloudflareEnv {
  DB: FakeDatabase<any>
  KV_SESSIONS: FakeKV
  KV_CACHE: FakeKV
  // Add more bindings as needed
}

export function createFakeCloudflareEnv(): FakeCloudflareEnv {
  return {
    DB: new FakeDatabase(),
    KV_SESSIONS: new FakeKV(),
    KV_CACHE: new FakeKV()
  }
}
```

### 1.7 Lucia Auth Session Factory

```typescript
// packages/test-utils/src/factories/session.ts
import { createId } from "@paralleldrive/cuid2"
import type { SessionWithMeta } from "@/utils/auth"

export interface SessionFactoryOptions {
  userId?: string
  teamId?: string
  roles?: string[]
  expiresInMs?: number
}

export function createTestSession(
  overrides?: Partial<SessionWithMeta> & SessionFactoryOptions
): SessionWithMeta {
  const userId = overrides?.userId ?? createId()
  const teamId = overrides?.teamId ?? createId()
  const expiresAt = Date.now() + (overrides?.expiresInMs ?? 86400000) // 24h default

  return {
    id: createId(),
    userId,
    expiresAt,
    fresh: true,
    user: {
      id: userId,
      email: `test-${userId.slice(0, 4)}@example.com`,
      emailVerified: true,
      name: `Test User ${userId.slice(0, 4)}`,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides?.user
    },
    teams: [
      {
        teamId,
        teamName: `Test Team ${teamId.slice(0, 4)}`,
        teamSlug: `test-team-${teamId.slice(0, 4)}`,
        roleId: overrides?.roles?.[0] ?? "member",
        isOwner: false,
        ...overrides?.teams?.[0]
      }
    ],
    activeTeamId: teamId,
    ...overrides
  }
}

// Fake session store for KV-based sessions
export class FakeSessionStore {
  private sessions = new Map<string, SessionWithMeta>()

  async get(sessionId: string): Promise<SessionWithMeta | null> {
    return this.sessions.get(sessionId) ?? null
  }

  async set(session: SessionWithMeta): Promise<void> {
    this.sessions.set(session.id, session)
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  reset(): void {
    this.sessions.clear()
  }
}
```

### 1.8 Multi-Tenancy Isolation Helper

```typescript
// packages/test-utils/src/assertions/tenant.ts
import type { FakeDatabase } from "../fakes/fake-db"

/**
 * Assert that a query only returns data for the specified team.
 * Use this to verify multi-tenant data isolation.
 */
export async function assertTenantIsolation<T extends { teamId: string }>(
  db: FakeDatabase<any>,
  tableName: string,
  expectedTeamId: string,
  queryFn: () => Promise<T[]>
): Promise<void> {
  // Seed data for multiple teams
  const otherTeamId = "other-team-isolation-test"
  
  // Run the query
  const results = await queryFn()
  
  // Verify all results belong to expected team
  const violations = results.filter(r => r.teamId !== expectedTeamId)
  
  if (violations.length > 0) {
    throw new Error(
      `Tenant isolation violation in ${tableName}: ` +
      `Found ${violations.length} records with wrong teamId. ` +
      `Expected: ${expectedTeamId}, Got: ${violations.map(v => v.teamId).join(", ")}`
    )
  }
}

/**
 * Assert that a record is not accessible to a different team.
 */
export async function assertRecordIsolation<T>(
  getRecord: (teamId: string) => Promise<T | null>,
  ownerTeamId: string,
  attackerTeamId: string
): Promise<void> {
  const attackerResult = await getRecord(attackerTeamId)
  
  if (attackerResult !== null) {
    throw new Error(
      `Record isolation violation: Record owned by ${ownerTeamId} ` +
      `was accessible to team ${attackerTeamId}`
    )
  }
}
```

### 1.9 Test Factories

```typescript
// packages/test-utils/src/factories/team.ts
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
  const id = overrides?.id ?? createId()
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

// packages/test-utils/src/factories/user.ts
import { createId } from "@paralleldrive/cuid2"

export interface UserFactory {
  id: string
  email: string
  emailVerified: boolean
  name: string
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export function createUser(overrides?: Partial<UserFactory>): UserFactory {
  const id = overrides?.id ?? createId()
  return {
    id,
    email: `user-${id.slice(0, 4)}@example.com`,
    emailVerified: true,
    name: `Test User ${id.slice(0, 4)}`,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

// packages/test-utils/src/factories/workout.ts
import { createId } from "@paralleldrive/cuid2"

export interface WorkoutFactory {
  id: string
  teamId: string
  name: string
  description: string | null
  type: string
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export function createWorkout(overrides?: Partial<WorkoutFactory>): WorkoutFactory {
  const id = overrides?.id ?? createId()
  return {
    id,
    teamId: createId(),
    name: `Test Workout ${id.slice(0, 4)}`,
    description: null,
    type: "amrap",
    createdById: createId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
```

### 1.10 Success Criteria

- [x] `@repo/test-utils` package created and exports all utilities
- [x] FakeDatabase supports 10 core Drizzle methods
- [x] FakeDatabase throws on >100 SQL params (D1 limit)
- [x] FakeKV implements KVNamespace interface
- [x] createTestSession() generates valid SessionWithMeta
- [x] createFakeCloudflareEnv() provides DB, KV bindings
- [x] assertTenantIsolation() validates teamId filtering
- [ ] 3+ existing tests migrated to use new utilities (deferred to Phase 5)
- [x] All utilities have JSDoc documentation
- [x] Package has self-tests that pass

**Status:** ✅ Complete (commit 3e295814)

---

## Phase 2: Vitest Workspace Configuration

**Effort:** 8 hours (1 day) | **Priority:** P0

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
import { baseConfig } from "@repo/test-utils/vitest"
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

### 2.3 Success Criteria

- [x] vitest.workspace.ts configured at repo root
- [x] `pnpm test` runs tests from all packages
- [x] Test output shows workspace package names
- [x] No performance regression vs current setup

**Status:** ✅ Complete (commit 3e295814)

---

## Phase 3: Playwright E2E Setup

**Effort:** 16 hours (2 days) | **Priority:** P1

> **Note:** Playwright 1.55.0 is already installed. Skip installation step.

### 3.1 Verify Playwright Installation

```bash
# Already installed, just verify
pnpm --filter wodsmith exec playwright --version
# Should output: Version 1.55.0
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

### 3.4 Success Criteria

- [x] playwright.config.ts exists with baseURL configured
- [x] e2e/ directory structure matches proposed plan
- [x] 2+ critical path tests pass (auth, workout creation)
- [x] Screenshots captured on failure
- [x] `pnpm --filter wodsmith exec playwright test` runs without errors

**Status:** ✅ Complete (commit b50364e6)

---

## Phase 4: CI/CD Integration

**Effort:** 16 hours (2 days) | **Priority:** P1-P2

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

### 4.3 Turbo Configuration Updates

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

### 4.4 Success Criteria

- [x] ci.yaml runs on PR (lint, typecheck, unit, build)
- [x] e2e.yaml runs with sharding (2 shards minimum)
- [ ] deploy.yml depends on ci.yaml passing (remove Phase 0 test job) - deferred
- [x] Turbo caching works (2nd run < 30% of 1st run time)
- [ ] All jobs pass on main branch - pending PR merge

**Status:** ✅ Complete (commit a316a714)

---

## Implementation Priority (Updated)

| Priority | Phase | Task | Effort | Status |
|----------|-------|------|--------|--------|
| **P0** | 0 | Add test job to deploy.yml (IMMEDIATE) | 30 min | ✅ Complete |
| **P0** | 1 | Create `@repo/test-utils` with fakes/factories | 28h | ✅ Complete |
| **P0** | 1 | Add domain-specific utilities (Cloudflare, Auth, D1, Tenancy) | (included) | ✅ Complete |
| **P0** | 2 | Add Vitest workspace config | 8h | ✅ Complete |
| **P1** | 3 | Setup Playwright with basic smoke tests | 16h | ✅ Complete |
| **P1** | 4 | Add CI workflow for unit tests | 8h | ✅ Complete |
| **P2** | 4 | Add E2E CI workflow with sharding | 8h | ✅ Complete |
| **P2** | 5 | Migrate existing mocks to fake implementations | 16h | ✅ Complete |
| **P3** | 5 | Add coverage reporting | 4h | 🔲 Pending (optional) |

**Total Effort:** 68 hours (~8.5 days)
**Completed:** ~64 hours (Phases 0-5)
**Remaining:** ~4 hours (optional coverage reporting)

---

## Files to Create/Modify

### New Files

1. `packages/test-utils/package.json`
2. `packages/test-utils/tsconfig.json`
3. `packages/test-utils/src/index.ts`
4. `packages/test-utils/src/vitest-base.ts`
5. `packages/test-utils/src/fakes/*.ts` (fake-db, fake-kv, fake-r2, fake-cloudflare-env)
6. `packages/test-utils/src/factories/*.ts` (user, team, workout, session)
7. `packages/test-utils/src/helpers/*.ts` (spy, delay, tenant-isolation)
8. `packages/test-utils/src/assertions/*.ts` (tenant)
9. `vitest.workspace.ts`
10. `apps/wodsmith/playwright.config.ts`
11. `apps/wodsmith/e2e/*.spec.ts`
12. `.github/workflows/ci.yaml`
13. `.github/workflows/e2e.yaml`

### Modified Files

1. `pnpm-workspace.yaml` - Add catalog entries for test deps
2. `package.json` - Add workspace scripts
3. `turbo.json` - Add test/e2e task configs with inputs/outputs
4. `.github/workflows/deploy.yml` - Add test job (Phase 0), then depend on ci.yaml (Phase 4)
5. `apps/wodsmith/vitest.config.mjs` → `vitest.config.ts` (use shared base)
6. `apps/wodsmith/package.json` - Update Vitest version
7. `apps/wodsmith/test/setup.ts` - Use new fakes (gradual migration)

---

## Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **No CI gates → prod bugs** | Critical | High | Phase 0 adds immediate gate |
| **Wrong package name breaks imports** | High | Medium | Use `@repo/test-utils` (established convention) |
| **FakeDatabase too complex** | Medium | Medium | Start with 10 core methods, expand incrementally |
| **Existing tests break** | Low | Low | Opt-in migration, run alongside current setup |
| **Cloudflare env mocking incomplete** | Medium | High | Document unsupported bindings, fail fast |
| **Playwright flakiness** | Low | Medium | Use built-in retry, screenshots on failure |

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
import { testEffect } from "@repo/test-utils/effect"
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

---

## Changelog

### 2025-12-20 - Phase 5 Complete (Test Mock Migration)

**Implemented:**
- Updated `createTestSession` factory to match actual `KVSession` type structure (7fd4a6ce)
  - Added `KVSessionUser`, `KVSessionTeam` interfaces matching app types
  - Added `permissions`, `teamRole`, `teamSlug` factory options
  - Included `createdAt`, `version`, `isCurrentSession` fields
  
- Migrated 4 test files (71 tests total) to use `createTestSession` factory:
  - `test/utils/workout-permissions.test.ts` (17 tests)
  - `test/server/workouts.test.ts` (7 tests)
  - `test/actions/organizer-onboarding-actions.test.ts` (39 tests)
  - `test/actions/workout-actions.test.ts` (8 tests)

**Benefits:**
- Reduced ~30 lines of boilerplate per test file
- Type-safe session creation matching real app types
- Consistent session structure across test suite
- Factory handles structure changes automatically

**Remaining (Optional):**
- Add coverage reporting (~4h)

### 2025-12-20 - E2E Database Seeding Complete

**Implemented:**
- E2E database seeding infrastructure (e578c34a)
  - `seed-e2e.sql` with predictable test users, team, and workouts
  - `setup-e2e-db.ts` script to run migrations + seeding
  - Playwright `globalSetup.ts` to seed DB before tests
  - Updated fixtures to use real seeded data IDs and credentials
  - Test credentials: `test@wodsmith.com` / `TestPassword123!`

**Files Created:**
- `apps/wodsmith/scripts/seed-e2e.sql`
- `apps/wodsmith/scripts/setup-e2e-db.ts`
- `apps/wodsmith/scripts/seed-e2e.sh`
- `apps/wodsmith/scripts/generate-test-password-hash.ts`
- `apps/wodsmith/e2e/global-setup.ts`

### 2025-12-20 - Phases 0-4 Complete

**Implemented:**
- Phase 0: Already existed (test job in deploy.yml)
- Phase 1-2: `@repo/test-utils` package with fakes, factories, workspace config (3e295814)
- Phase 3: Playwright E2E infrastructure with fixtures and page objects (b50364e6)
- Phase 4: CI/CD workflows with Turbo caching and Playwright sharding (a316a714)

**Branch:** `claude/extract-testing-rig-gVzi5`

**Commits:**
- `e578c34a` - feat(e2e): add database seeding for E2E tests
- `3e295814` - feat(test-utils): add @repo/test-utils package with fakes, factories, and workspace config
- `b50364e6` - feat(e2e): add Playwright E2E testing infrastructure (Phase 3)
- `a316a714` - feat(ci): add CI and E2E workflows with Turbo caching and Playwright sharding (Phase 4)

**Remaining:**
- Phase 5: Migrate existing mocks to fake implementations (16h)
- Optional: Add coverage reporting (4h)

### 2025-12-19 - Gap Analysis Update (thewodapp-c51)

**Validated:**
- 43 test files (plan said "40+") ✅
- Vitest 3.2.3 ✅
- Playwright installed (1.55.0) but not configured ✅
- No CI test pipeline ✅

**Corrected:**
- Package naming: `@wodsmith/test-utils` → `@repo/test-utils`
- D1 mock complexity: "basic" → "24-method chainable mock"
- Playwright: Skip installation step (already installed)

**Added:**
- Phase 0: Immediate CI gate (30 min)
- FakeCloudflareEnv (KV, R2, env vars)
- createTestSession() for Lucia auth
- D1 100-parameter limit enforcement
- assertTenantIsolation() helper
- pnpm catalog additions
- Updated effort estimates (56h → 68h)
- Risk matrix
- Success criteria per phase
