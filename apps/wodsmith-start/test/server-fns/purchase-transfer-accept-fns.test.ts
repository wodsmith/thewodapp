import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock logging
vi.mock('@/lib/logging', () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  addRequestContextAttribute: vi.fn(),
  updateRequestContext: vi.fn(),
}))

// Mock transfer handler
const mockHandleCompetitionRegistrationTransfer = vi.fn()
vi.mock('@/server/commerce/transfer-handlers', () => ({
  handleCompetitionRegistrationTransfer: (...args: unknown[]) =>
    mockHandleCompetitionRegistrationTransfer(...args),
}))

// Mock env
vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn(() => 'https://test.wodsmith.com'),
}))

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  env: {
    APP_URL: 'https://test.wodsmith.com',
  },
}))

// Test users
const targetUserId = 'user-target-123'
const sourceUserId = 'user-source-456'

const mockTargetSession = {
  userId: targetUserId,
  user: {
    id: targetUserId,
    email: 'target@example.com',
    role: 'user',
  },
  teams: [],
}

const mockNoSession = null

// Mock auth - default to target user session
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockTargetSession)),
  requireVerifiedEmail: vi.fn(() => Promise.resolve(mockTargetSession)),
}))

// Mock TanStack createServerFn
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: any) => fn,
    inputValidator: () => ({
      handler: (fn: any) => fn,
    }),
  }),
  createServerOnlyFn: (fn: any) => fn,
}))

import {requireVerifiedEmail, getSessionFromCookie} from '@/utils/auth'
import {
  getPendingTransferFn,
  getTransferSessionFn,
  acceptPurchaseTransferFn,
} from '@/server-fns/purchase-transfer-accept-fns'

// Type helpers
const getPendingTransfer = getPendingTransferFn as unknown as (args: {
  data: {transferId: string}
}) => Promise<any>

const getTransferSession = getTransferSessionFn as unknown as (args: {
  data?: undefined
}) => Promise<{userId: string; email: string | null} | null>

const acceptTransfer = acceptPurchaseTransferFn as unknown as (args: {
  data: {
    transferId: string
    answers?: Array<{questionId: string; answer: string}>
    waiverSignatures?: Array<{waiverId: string}>
  }
}) => Promise<{success: boolean; competitionSlug: string | null}>

// Helper to set mock session
const setMockSession = (session: unknown) => {
  vi.mocked(requireVerifiedEmail).mockResolvedValue(
    session as Awaited<ReturnType<typeof requireVerifiedEmail>>,
  )
}

const setMockCookieSession = (session: unknown) => {
  vi.mocked(getSessionFromCookie).mockResolvedValue(
    session as Awaited<ReturnType<typeof getSessionFromCookie>>,
  )
}

// Test data
const testTransferId = 'ptxfr_transfer-001'
const testPurchaseId = 'purchase-123'
const testCompetitionId = 'comp-789'

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)

const mockTransfer = {
  id: testTransferId,
  purchaseId: testPurchaseId,
  sourceUserId,
  targetEmail: 'target@example.com',
  acceptedEmail: null,
  targetUserId: null,
  transferState: 'INITIATED',
  initiatedBy: 'user-organizer-999',
  expiresAt: futureDate,
  completedAt: null,
  cancelledAt: null,
  notes: 'Replacing injured athlete',
}

const mockTransferWithRelations = {
  ...mockTransfer,
  purchase: {
    id: testPurchaseId,
    userId: sourceUserId,
    productId: 'product-456',
    competitionId: testCompetitionId,
    divisionId: 'div-001',
    status: 'COMPLETED',
    product: {
      id: 'product-456',
      type: 'COMPETITION_REGISTRATION',
    },
  },
}

const mockSourceUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'source@example.com',
}

const mockCompetition = {
  id: testCompetitionId,
  name: 'Summer Throwdown 2026',
  slug: 'summer-throwdown-2026',
}

const mockPurchase = {
  id: testPurchaseId,
  userId: sourceUserId,
  productId: 'product-456',
  competitionId: testCompetitionId,
  divisionId: 'div-001',
  status: 'COMPLETED',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()

  mockDb.registerTable('purchaseTransfersTable')
  mockDb.registerTable('commercePurchaseTable')
  mockDb.registerTable('competitionsTable')
  mockDb.registerTable('scalingLevelsTable')
  mockDb.registerTable('competitionRegistrationsTable')
  mockDb.registerTable('userTable')
  mockDb.registerTable('teamTable')
  mockDb.registerTable('teamMembershipTable')
  mockDb.registerTable('teamInvitationTable')

  setMockSession(mockTargetSession)
  setMockCookieSession(mockTargetSession)
})

// ============================================================================
// getPendingTransferFn
// ============================================================================
describe('getPendingTransferFn', () => {
  it('returns null when transfer not found', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    const result = await getPendingTransfer({
      data: {transferId: 'nonexistent'},
    })

    expect(result).toBeNull()
  })

  it('returns transfer details with competition and division', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(mockTransfer),
      findMany: vi.fn().mockResolvedValue([]),
    }

    // source user
    mockDb.setMockReturnValue([mockSourceUser])
    // After the first select (source user), queue subsequent selects
    mockDb.queueMockSingleValues([
      [mockSourceUser], // source user select
      [mockPurchase], // purchase select
      [mockCompetition], // competition select
      [{id: 'div-001', label: 'RX'}], // division select
      [{...mockTransfer, commercePurchaseId: testPurchaseId}], // registration select (no athleteTeamId)
    ])

    const result = await getPendingTransfer({
      data: {transferId: testTransferId},
    })

    expect(result).not.toBeNull()
    expect(result.id).toBe(testTransferId)
    expect(result.transferState).toBe('INITIATED')
    expect(result.targetEmail).toBe('target@example.com')
  })

  it('returns minimal data when purchase has no competitionId', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(mockTransfer),
      findMany: vi.fn().mockResolvedValue([]),
    }

    mockDb.queueMockSingleValues([
      [mockSourceUser], // source user
      [{...mockPurchase, competitionId: null}], // purchase with no competition
    ])

    const result = await getPendingTransfer({
      data: {transferId: testTransferId},
    })

    expect(result).not.toBeNull()
    expect(result.competition).toBeNull()
    expect(result.division).toBeNull()
    expect(result.team).toBeNull()
  })
})

// ============================================================================
// getTransferSessionFn
// ============================================================================
describe('getTransferSessionFn', () => {
  it('returns userId and email when logged in', async () => {
    const result = await getTransferSession({data: undefined})

    expect(result).toEqual({
      userId: targetUserId,
      email: 'target@example.com',
    })
  })

  it('returns null when not logged in', async () => {
    setMockCookieSession(null)

    const result = await getTransferSession({data: undefined})

    expect(result).toBeNull()
  })
})

// ============================================================================
// acceptPurchaseTransferFn
// ============================================================================
describe('acceptPurchaseTransferFn', () => {
  function setupAcceptHappyPath() {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(mockTransferWithRelations),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValue({slug: 'summer-throwdown-2026'}),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockHandleCompetitionRegistrationTransfer.mockResolvedValue(undefined)
  }

  it('accepts transfer and calls handler for COMPETITION_REGISTRATION', async () => {
    setupAcceptHappyPath()

    const result = await acceptTransfer({
      data: {
        transferId: testTransferId,
        answers: [{questionId: 'q1', answer: 'Large'}],
        waiverSignatures: [{waiverId: 'w1'}],
      },
    })

    expect(result.success).toBe(true)
    expect(result.competitionSlug).toBe('summer-throwdown-2026')

    // Verify handler was called with correct args
    expect(mockHandleCompetitionRegistrationTransfer).toHaveBeenCalledWith({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
      answers: [{questionId: 'q1', answer: 'Large'}],
      waiverSignatures: [{waiverId: 'w1'}],
    })

    // Verify transfer was marked COMPLETED
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('throws when transfer not found', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      acceptTransfer({data: {transferId: 'nonexistent'}}),
    ).rejects.toThrow('Transfer not found')
  })

  it('throws when transfer is already COMPLETED', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue({
        ...mockTransferWithRelations,
        transferState: 'COMPLETED',
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      acceptTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('This transfer has already been accepted')
  })

  it('throws when transfer is CANCELLED', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue({
        ...mockTransferWithRelations,
        transferState: 'CANCELLED',
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      acceptTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('This transfer was cancelled by the organizer')
  })

  it('throws when transfer is EXPIRED', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue({
        ...mockTransferWithRelations,
        transferState: 'EXPIRED',
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      acceptTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('This transfer has expired')
  })

  it('throws when transfer has expired by time even if state is INITIATED', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue({
        ...mockTransferWithRelations,
        expiresAt: pastDate,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      acceptTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('This transfer has expired')
  })

  it('accepts without answers and waivers', async () => {
    setupAcceptHappyPath()

    const result = await acceptTransfer({
      data: {transferId: testTransferId},
    })

    expect(result.success).toBe(true)
    expect(mockHandleCompetitionRegistrationTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: undefined,
        waiverSignatures: undefined,
      }),
    )
  })

  it('throws when competitionId missing from purchase', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue({
        ...mockTransferWithRelations,
        purchase: {
          ...mockTransferWithRelations.purchase,
          competitionId: null,
        },
      }),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      acceptTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('Competition ID missing from purchase')
  })
})
