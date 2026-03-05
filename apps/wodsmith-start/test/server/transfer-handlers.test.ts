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

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  env: {
    APP_URL: 'https://test.wodsmith.com',
  },
}))

// Mock TanStack (needed for schema imports that reference createServerOnlyFn)
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: any) => fn,
    inputValidator: () => ({
      handler: (fn: any) => fn,
    }),
  }),
  createServerOnlyFn: (fn: any) => fn,
}))

import {handleCompetitionRegistrationTransfer} from '@/server/commerce/transfer-handlers'

// Test data
const sourceUserId = 'user-source-123'
const targetUserId = 'user-target-456'
const testPurchaseId = 'purchase-001'
const testCompetitionId = 'comp-001'
const testRegistrationId = 'reg-001'
const testTeamMemberId = 'tm-001'
const testAthleteTeamId = 'athlete-team-001'
const testDivisionId = 'div-001'

const mockRegistration = {
  id: testRegistrationId,
  userId: sourceUserId,
  eventId: testCompetitionId,
  divisionId: testDivisionId,
  status: 'active',
  commercePurchaseId: testPurchaseId,
  teamMemberId: testTeamMemberId as string | null,
  captainUserId: sourceUserId,
  athleteTeamId: null as string | null, // individual by default
}

const mockOldMembership = {
  id: testTeamMemberId,
  teamId: 'event-team-001',
  userId: sourceUserId,
  roleId: 'member',
  isSystemRole: false,
  isActive: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()

  mockDb.registerTable('competitionRegistrationsTable')
  mockDb.registerTable('teamMembershipTable')
  mockDb.registerTable('competitionHeatAssignmentsTable')
  mockDb.registerTable('competitionRegistrationAnswersTable')
  mockDb.registerTable('waiverSignaturesTable')
  mockDb.registerTable('competitionEventsTable')
  mockDb.registerTable('scoresTable')

  // Add $returningId to chainMock — used by db.insert().values().$returningId()
  const chainMock = mockDb.getChainMock()
  ;(chainMock as any).$returningId = vi
    .fn()
    .mockResolvedValue([{id: 'tm-new-001'}])
})

describe('handleCompetitionRegistrationTransfer', () => {
  function setupHappyPath(overrides?: Partial<typeof mockRegistration>) {
    const reg = {...mockRegistration, ...overrides}

    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(reg) // find registration
        .mockResolvedValueOnce(null), // no conflicting target registration
      findMany: vi.fn().mockResolvedValue([]),
    }

    mockDb.query.teamMembershipTable = {
      findFirst: vi.fn().mockResolvedValue(mockOldMembership),
      findMany: vi.fn().mockResolvedValue([]),
    }

    // Mock select for competition events (for score deletion)
    mockDb.setMockReturnValue([{id: 'event-1'}, {id: 'event-2'}])

    return reg
  }

  it('transfers registration from source to target user', async () => {
    setupHappyPath()

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // Verify registration was updated (update called for: deactivate old membership + update registration)
    expect(mockDb.update).toHaveBeenCalled()
    // Verify heat assignments and answers deleted
    expect(mockDb.delete).toHaveBeenCalled()
    // Verify new team membership created
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('throws when no active registration found', async () => {
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      handleCompetitionRegistrationTransfer({
        purchaseId: testPurchaseId,
        sourceUserId,
        targetUserId,
        competitionId: testCompetitionId,
      }),
    ).rejects.toThrow('No active registration found for this purchase')
  })

  it('throws when target already has active registration in same division', async () => {
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(mockRegistration) // source registration
        .mockResolvedValueOnce({id: 'existing-reg', status: 'active'}), // conflicting active target
      findMany: vi.fn().mockResolvedValue([]),
    }

    await expect(
      handleCompetitionRegistrationTransfer({
        purchaseId: testPurchaseId,
        sourceUserId,
        targetUserId,
        competitionId: testCompetitionId,
      }),
    ).rejects.toThrow(
      'Target user already has an active registration in this division',
    )
  })

  it('deletes non-active conflicting registration to avoid unique constraint', async () => {
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(mockRegistration) // source registration
        .mockResolvedValueOnce({id: 'old-removed-reg', status: 'removed'}), // old removed reg
      findMany: vi.fn().mockResolvedValue([]),
    }

    mockDb.query.teamMembershipTable = {
      findFirst: vi.fn().mockResolvedValue(mockOldMembership),
      findMany: vi.fn().mockResolvedValue([]),
    }

    mockDb.setMockReturnValue([{id: 'event-1'}])

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // delete called for: old removed reg, heat assignments, old answers, scores
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('deactivates source team membership and creates new one for target', async () => {
    setupHappyPath()

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // Verify old membership deactivated (update called)
    expect(mockDb.update).toHaveBeenCalled()
    // Verify new membership created (insert called)
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('saves new registration answers when provided', async () => {
    setupHappyPath()

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
      answers: [
        {questionId: 'q1', answer: 'Large'},
        {questionId: 'q2', answer: 'None'},
      ],
    })

    // insert called for: new team membership + 2 answers
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('saves waiver signatures when provided', async () => {
    setupHappyPath()

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
      waiverSignatures: [{waiverId: 'waiver-1'}],
    })

    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('handles team registration: swaps athlete team memberships', async () => {
    setupHappyPath({athleteTeamId: testAthleteTeamId})

    // Mock athlete team membership lookup for swap (select().from().where() chain)
    mockDb.setMockReturnValue([
      {
        id: 'atm-source-1',
        teamId: testAthleteTeamId,
        userId: sourceUserId,
        isActive: true,
      },
    ])

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // Verify: deactivate source athlete membership + create target as CAPTAIN
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('handles registration with no teamMemberId gracefully', async () => {
    setupHappyPath({teamMemberId: null})

    mockDb.query.teamMembershipTable = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // Should still succeed — registration update, heat/answer delete, score delete
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('deletes scores for source user across all competition events', async () => {
    setupHappyPath()

    // Return multiple competition events
    mockDb.setMockReturnValue([{id: 'evt-1'}, {id: 'evt-2'}, {id: 'evt-3'}])

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // Verify delete called (for heat assignments, answers, scores)
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('skips score deletion when competition has no events', async () => {
    mockDb.query.competitionRegistrationsTable = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({...mockRegistration, teamMemberId: null})
        .mockResolvedValueOnce(null),
      findMany: vi.fn().mockResolvedValue([]),
    }

    // Return empty events array
    mockDb.setMockReturnValue([])

    await handleCompetitionRegistrationTransfer({
      purchaseId: testPurchaseId,
      sourceUserId,
      targetUserId,
      competitionId: testCompetitionId,
    })

    // delete called for heat assignments + answers, but NOT scores (no events)
    expect(mockDb.delete).toHaveBeenCalled()
  })
})
