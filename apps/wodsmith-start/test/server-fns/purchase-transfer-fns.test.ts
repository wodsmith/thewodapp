import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import {TEAM_PERMISSIONS} from '@/db/schema'

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

// Mock email
const mockSendPurchaseTransferEmail = vi.fn()
vi.mock('@/utils/email', () => ({
  sendPurchaseTransferEmail: (...args: unknown[]) =>
    mockSendPurchaseTransferEmail(...args),
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
const organizerUserId = 'user-organizer-123'
const sourceUserId = 'user-source-456'
const targetUserId = 'user-target-789'

// Mock sessions
const mockOrganizerSession = {
  userId: organizerUserId,
  user: {
    id: organizerUserId,
    email: 'organizer@example.com',
    role: 'user',
  },
  teams: [
    {
      id: 'team-org-123',
      permissions: [TEAM_PERMISSIONS.MANAGE_COMPETITIONS],
    },
  ],
}

const mockAdminSession = {
  userId: organizerUserId,
  user: {
    id: organizerUserId,
    email: 'admin@example.com',
    role: 'admin',
  },
  teams: [],
}

const mockUnauthorizedSession = {
  userId: 'user-unauth-999',
  user: {
    id: 'user-unauth-999',
    email: 'unauth@example.com',
    role: 'user',
  },
  teams: [
    {
      id: 'team-other-999',
      permissions: [],
    },
  ],
}

// Mock auth - default to organizer
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(mockOrganizerSession)),
  requireVerifiedEmail: vi.fn(() => Promise.resolve(mockOrganizerSession)),
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

import {requireVerifiedEmail} from '@/utils/auth'
import {
  initiatePurchaseTransferFn,
  cancelPurchaseTransferFn,
  getPendingTransfersForCompetitionFn,
} from '@/server-fns/purchase-transfer-fns'

// Type helpers for calling server fns directly
const initiateTransfer = initiatePurchaseTransferFn as unknown as (args: {
  data: {purchaseId: string; targetEmail: string; notes?: string}
}) => Promise<{success: boolean; transferId: string}>

const cancelTransfer = cancelPurchaseTransferFn as unknown as (args: {
  data: {transferId: string}
}) => Promise<{success: boolean}>

const getPendingTransfers =
  getPendingTransfersForCompetitionFn as unknown as (args: {
    data: {competitionId: string}
  }) => Promise<
    Array<{
      id: string
      purchaseId: string
      targetEmail: string
      transferState: string
      expiresAt: Date
    }>
  >

// Helper to set mock session
const setMockSession = (session: unknown) => {
  vi.mocked(requireVerifiedEmail).mockResolvedValue(
    session as Awaited<ReturnType<typeof requireVerifiedEmail>>,
  )
}

// Test data
const testPurchaseId = 'purchase-123'
const testProductId = 'product-456'
const testCompetitionId = 'comp-789'
const testOrgTeamId = 'team-org-123'
const testDivisionId = 'div-001'
const testTransferId = 'ptxfr_transfer-001'

const mockPurchase = {
  id: testPurchaseId,
  userId: sourceUserId,
  productId: testProductId,
  competitionId: testCompetitionId,
  divisionId: testDivisionId,
  status: 'COMPLETED',
}

const mockProduct = {
  id: testProductId,
  type: 'COMPETITION_REGISTRATION',
}

const mockCompetition = {
  id: testCompetitionId,
  organizingTeamId: testOrgTeamId,
  name: 'Summer Throwdown 2026',
}

const mockSourceUser = {
  id: sourceUserId,
  email: 'source@example.com',
  firstName: 'John',
  lastName: 'Doe',
}

const mockRegistration = {
  id: 'reg-123',
  status: 'active',
  divisionId: testDivisionId,
}

const mockTransfer = {
  id: testTransferId,
  purchaseId: testPurchaseId,
  sourceUserId,
  targetEmail: 'target@example.com',
  transferState: 'INITIATED',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  notes: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()

  mockDb.registerTable('commercePurchaseTable')
  mockDb.registerTable('commerceProductTable')
  mockDb.registerTable('competitionsTable')
  mockDb.registerTable('purchaseTransfersTable')
  mockDb.registerTable('userTable')
  mockDb.registerTable('competitionRegistrationsTable')
  mockDb.registerTable('scalingLevelsTable')

  setMockSession(mockOrganizerSession)
})

// ============================================================================
// initiatePurchaseTransferFn
// ============================================================================
describe('initiatePurchaseTransferFn', () => {
  function setupHappyPath() {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null), // no existing transfer
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.userTable = {
      findFirst: vi.fn().mockResolvedValue(mockSourceUser),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(mockRegistration) // source registration
        .mockResolvedValueOnce(null), // no conflicting target registration
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.scalingLevelsTable = {
      findFirst: vi.fn().mockResolvedValue({id: testDivisionId, label: 'RX'}),
      findMany: vi.fn().mockResolvedValue([]),
    }
  }

  it('creates transfer record and sends email on success', async () => {
    setupHappyPath()
    // target user does not exist yet (no account)
    mockDb.query.userTable = {
      findFirst: vi.fn().mockResolvedValue(mockSourceUser),
      findMany: vi.fn().mockResolvedValue([]),
    }

    const result = await initiateTransfer({
      data: {
        purchaseId: testPurchaseId,
        targetEmail: 'newathlete@example.com',
        notes: 'Replacing injured athlete',
      },
    })

    expect(result.success).toBe(true)
    expect(result.transferId).toBeDefined()
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockSendPurchaseTransferEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newathlete@example.com',
        competitionName: 'Summer Throwdown 2026',
      }),
    )
  })

  it('throws when purchase not found', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {purchaseId: 'nonexistent', targetEmail: 'a@b.com'},
      }),
    ).rejects.toThrow('Purchase not found')
  })

  it('throws when purchase is not COMPLETED', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi
        .fn()
        .mockResolvedValue({...mockPurchase, status: 'PENDING'}),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {purchaseId: testPurchaseId, targetEmail: 'a@b.com'},
      }),
    ).rejects.toThrow('Only completed purchases can be transferred')
  })

  it('throws when product not found', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {purchaseId: testPurchaseId, targetEmail: 'a@b.com'},
      }),
    ).rejects.toThrow('Product not found')
  })

  it('throws when user lacks MANAGE_COMPETITIONS permission', async () => {
    setMockSession(mockUnauthorizedSession)

    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {purchaseId: testPurchaseId, targetEmail: 'a@b.com'},
      }),
    ).rejects.toThrow('Missing required permission: manage_competitions')
  })

  it('allows ADMIN role to bypass permission check', async () => {
    setMockSession(mockAdminSession)
    setupHappyPath()

    const result = await initiateTransfer({
      data: {purchaseId: testPurchaseId, targetEmail: 'newathlete@example.com'},
    })

    expect(result.success).toBe(true)
  })

  it('throws when active transfer already exists for this purchase', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue({id: 'existing-transfer'}),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {purchaseId: testPurchaseId, targetEmail: 'a@b.com'},
      }),
    ).rejects.toThrow('A pending transfer already exists')
  })

  it('throws when target email matches source user email', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.userTable = {
      findFirst: vi.fn().mockResolvedValue(mockSourceUser),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {
          purchaseId: testPurchaseId,
          targetEmail: 'source@example.com',
        },
      }),
    ).rejects.toThrow('Cannot transfer a purchase to the current owner')
  })

  it('throws when no active registration found for purchase', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.userTable = {
      findFirst: vi.fn().mockResolvedValue(mockSourceUser),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi.fn().mockResolvedValue(null), // no registration
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {purchaseId: testPurchaseId, targetEmail: 'new@example.com'},
      }),
    ).rejects.toThrow('No active registration found')
  })

  it('throws when target already has active registration in same division', async () => {
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.userTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(mockSourceUser) // source user lookup
        .mockResolvedValueOnce({id: targetUserId}), // target user lookup by email
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(mockRegistration) // source registration
        .mockResolvedValueOnce({id: 'conflict-reg'}), // conflicting target registration
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.scalingLevelsTable = {
      findFirst: vi.fn().mockResolvedValue({id: testDivisionId, label: 'RX'}),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      initiateTransfer({
        data: {
          purchaseId: testPurchaseId,
          targetEmail: 'existing@example.com',
        },
      }),
    ).rejects.toThrow(
      'The target athlete already has an active registration in this division',
    )
  })

  it('allows transfer when target user has no account yet', async () => {
    setupHappyPath()
    // Override: target user lookup returns null (no account)
    mockDb.query.userTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(mockSourceUser) // source user
        .mockResolvedValueOnce(null), // target user (no account)
      findMany: vi.fn().mockResolvedValue([]),
    }

    const result = await initiateTransfer({
      data: {purchaseId: testPurchaseId, targetEmail: 'noone@example.com'},
    })

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// cancelPurchaseTransferFn
// ============================================================================
describe('cancelPurchaseTransferFn', () => {
  function setupCancelHappyPath() {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(mockTransfer),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commercePurchaseTable = {
      findFirst: vi.fn().mockResolvedValue(mockPurchase),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.commerceProductTable = {
      findFirst: vi.fn().mockResolvedValue(mockProduct),
      findMany: vi.fn().mockResolvedValue([]),
    }
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
  }

  it('cancels an INITIATED transfer', async () => {
    setupCancelHappyPath()
    // update returns [{affectedRows: 1}] for successful CAS update
    mockDb.setMockReturnValue([{affectedRows: 1}])

    const result = await cancelTransfer({
      data: {transferId: testTransferId},
    })

    expect(result.success).toBe(true)
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('throws when transfer not found', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      cancelTransfer({data: {transferId: 'nonexistent'}}),
    ).rejects.toThrow('Transfer not found')
  })

  it('throws when transfer is already COMPLETED', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi
        .fn()
        .mockResolvedValue({...mockTransfer, transferState: 'COMPLETED'}),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      cancelTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('Transfer cannot be cancelled')
  })

  it('throws when transfer is already CANCELLED', async () => {
    mockDb.query.purchaseTransfersTable = {
      findFirst: vi
        .fn()
        .mockResolvedValue({...mockTransfer, transferState: 'CANCELLED'}),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      cancelTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('Transfer cannot be cancelled')
  })

  it('throws when user lacks MANAGE_COMPETITIONS permission', async () => {
    setMockSession(mockUnauthorizedSession)
    setupCancelHappyPath()

    await expect(
      cancelTransfer({data: {transferId: testTransferId}}),
    ).rejects.toThrow('Missing required permission: manage_competitions')
  })
})

// ============================================================================
// getPendingTransfersForCompetitionFn
// ============================================================================
describe('getPendingTransfersForCompetitionFn', () => {
  function setupGetPendingAuth() {
    mockDb.query.competitionsTable = {
      findFirst: vi.fn().mockResolvedValue(mockCompetition),
      findMany: vi.fn().mockResolvedValue([]),
    }
  }

  it('returns INITIATED transfers for a competition', async () => {
    setupGetPendingAuth()
    const mockTransfers = [
      {
        id: 'ptxfr_1',
        purchaseId: 'pur-1',
        targetEmail: 'a@b.com',
        transferState: 'INITIATED',
        expiresAt: new Date(),
      },
      {
        id: 'ptxfr_2',
        purchaseId: 'pur-2',
        targetEmail: 'c@d.com',
        transferState: 'INITIATED',
        expiresAt: new Date(),
      },
    ]

    // getPendingTransfersForCompetitionFn uses select().from().innerJoin().where()
    mockDb.setMockReturnValue(mockTransfers)

    const result = await getPendingTransfers({
      data: {competitionId: testCompetitionId},
    })

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('ptxfr_1')
    expect(result[1].id).toBe('ptxfr_2')
  })

  it('returns empty array when no pending transfers', async () => {
    setupGetPendingAuth()
    mockDb.setMockReturnValue([])

    const result = await getPendingTransfers({
      data: {competitionId: testCompetitionId},
    })

    expect(result).toHaveLength(0)
  })
})
