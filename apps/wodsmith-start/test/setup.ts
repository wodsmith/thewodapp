import {webcrypto} from 'node:crypto'
import {expect, vi} from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers)

// Polyfill Web Crypto API for Node.js/jsdom environment
// This is needed for password hashing tests that use crypto.subtle
// jsdom provides crypto.getRandomValues but not crypto.subtle
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  })
}

// Mock DOM methods used by Radix UI components
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.hasPointerCapture = vi.fn()
Element.prototype.setPointerCapture = vi.fn()
Element.prototype.releasePointerCapture = vi.fn()

// Mock the D1 client used by Drizzle
const mockD1Client = {
  prepare: () => mockD1Client,
  bind: () => mockD1Client,
  run: () => Promise.resolve({success: true}),
  all: () =>
    Promise.resolve({
      success: true,
      results: [{id: 'test_team_id', name: 'Test Team', slug: 'test-team'}],
    }),
  get: () => Promise.resolve({success: true}),
  raw: () => Promise.resolve([]),
  returning: () =>
    Promise.resolve([
      {id: 'test_team_id', name: 'Test Team', slug: 'test-team'},
    ]),
}

// Create a table mock with findFirst and findMany
const createTableMock = () => ({
  findFirst: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
})

// Create query mock with all tables used by db.query.tableName pattern
const createQueryMock = () => ({
  // Core tables
  workouts: createTableMock(),
  teamTable: createTableMock(),
  teamMembershipTable: createTableMock(),
  userTable: createTableMock(),
  planTable: createTableMock(),
  featureTable: createTableMock(),
  limitTable: createTableMock(),
  // Competition tables
  competitionsTable: createTableMock(),
  competitionRegistrationsTable: createTableMock(),
  competitionRegistrationQuestionsTable: createTableMock(),
  competitionJudgeRotationsTable: createTableMock(),
  competitionHeatsTable: createTableMock(),
  // Organizer tables
  organizerRequestTable: createTableMock(),
  // Sponsor tables
  sponsorsTable: createTableMock(),
  sponsorGroupsTable: createTableMock(),
  // Waiver tables
  waiversTable: createTableMock(),
  waiverSignaturesTable: createTableMock(),
  // Judging tables
  eventJudgingSheetsTable: createTableMock(),
  judgeAssignmentVersionsTable: createTableMock(),
  // Video/submission tables
  videoSubmissionsTable: createTableMock(),
  // Resource tables
  eventResourcesTable: createTableMock(),
  // Address tables
  addressesTable: createTableMock(),
  // Commerce tables
  commerceProductTable: createTableMock(),
  commercePurchaseTable: createTableMock(),
  // Entitlement tables
  entitlementTable: createTableMock(),
  teamFeatureEntitlementTable: createTableMock(),
  teamLimitEntitlementTable: createTableMock(),
  teamEntitlementOverrideTable: createTableMock(),
  // Scheduling tables
  scheduledWorkoutInstancesTable: createTableMock(),
  // Notification tables
  notificationReservationsTable: createTableMock(),
})

// Mock the db object that is null in test environment
// The mockDb needs to be thenable so that when you await the query chain, it returns an array
export const createChainableMock = () => {
  const mock: Record<string, unknown> = {
    // Make it thenable so await works at any point in the chain
    then: (resolve: (value: unknown[]) => void) => {
      resolve([])
      return Promise.resolve([])
    },
    // Query chain methods
    select: vi.fn(() => createChainableMock()),
    from: vi.fn(() => createChainableMock()),
    leftJoin: vi.fn(() => createChainableMock()),
    innerJoin: vi.fn(() => createChainableMock()),
    where: vi.fn(() => createChainableMock()),
    limit: vi.fn(() => createChainableMock()),
    orderBy: vi.fn(() => createChainableMock()),
    offset: vi.fn(() => createChainableMock()),
    groupBy: vi.fn(() => createChainableMock()),
    // Insert/update chain
    insert: vi.fn(() => createChainableMock()),
    values: vi.fn(() => createChainableMock()),
    returning: vi.fn().mockResolvedValue([{id: 'test_id', name: 'Test'}]),
    onDuplicateKeyUpdate: vi.fn(() => createChainableMock()),
    // Update chain
    update: vi.fn(() => createChainableMock()),
    set: vi.fn(() => createChainableMock()),
    // Delete
    delete: vi.fn().mockResolvedValue({changes: 0}),
    // Other methods
    get: vi.fn().mockResolvedValue(null),
    // MySQL replacement for .returning() - use onDuplicateKeyUpdate instead
    onDuplicateKeyUpdate: vi.fn(() => createChainableMock()),
    // Query API (drizzle relational queries)
    query: createQueryMock(),
  }
  return mock
}

const mockDb = createChainableMock()

vi.mock('@/db', () => ({
  db: null,
  getDb: vi.fn(() => mockDb),
}))
