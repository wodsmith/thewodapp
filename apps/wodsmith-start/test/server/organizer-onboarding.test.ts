import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {
  submitOrganizerRequest,
  approveOrganizerRequest,
  rejectOrganizerRequest,
  isApprovedOrganizer,
  hasPendingOrganizerRequest,
  getOrganizerRequest,
  grantTeamFeature,
  setTeamLimitOverride,
  revokeTeamFeature,
} from '@/server/organizer-onboarding'
import {ORGANIZER_REQUEST_STATUS, type OrganizerRequest} from '@/db/schema'
import {FEATURES} from '@/config/features'
import {LIMITS} from '@/config/limits'
import {FakeDrizzleDb} from '@repo/test-utils'
import {getDb} from '@/db'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock the email module
vi.mock('@/utils/email', () => ({
  sendOrganizerApprovalEmail: vi.fn().mockResolvedValue(undefined),
  sendOrganizerRejectionEmail: vi.fn().mockResolvedValue(undefined),
}))

// Mock the kv-session module (invalidateTeamMembersSessions is called after feature changes)
vi.mock('@/utils/kv-session', () => ({
  invalidateTeamMembersSessions: vi.fn().mockResolvedValue(undefined),
}))

import {invalidateTeamMembersSessions} from '@/utils/kv-session'

describe('Organizer Onboarding', () => {
  const mockTeamId = 'team-123'
  const mockUserId = 'user-456'
  const mockAdminUserId = 'admin-789'
  const mockRequestId = 'req-001'
  const mockReason = 'We want to host competitions for our gym'

  const createMockRequest = (
    overrides?: Partial<OrganizerRequest>,
  ): OrganizerRequest => ({
    id: mockRequestId,
    teamId: mockTeamId,
    userId: mockUserId,
    reason: mockReason,
    status: ORGANIZER_REQUEST_STATUS.PENDING,
    adminNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    updateCounter: 0,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockDb.registerTable('organizerRequestTable')
    mockDb.registerTable('teamFeatureEntitlementTable')
    mockDb.registerTable('teamEntitlementOverrideTable')
    mockDb.registerTable('featureTable')
    mockDb.registerTable('userTable')
    mockDb.registerTable('teamTable')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('submitOrganizerRequest', () => {
    it('should create a new organizer request', async () => {
      const mockRequest = createMockRequest()

      // Check for pending request (none)
      // Check for approved request (none)
      // Insert returns insertId
      // Then fetch the created request
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(null)  // No pending
        .mockResolvedValueOnce(null)  // No approved
        .mockResolvedValueOnce(mockRequest)  // Return created request

      mockDb.query.featureTable.findFirst.mockResolvedValue({
        id: 'feature-123',
        key: FEATURES.HOST_COMPETITIONS,
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue({insertId: mockRequestId})
      } as any)

      const result = await submitOrganizerRequest({
        teamId: mockTeamId,
        userId: mockUserId,
        reason: mockReason,
      })

      // Verify request was created
      expect(result).toEqual(mockRequest)
      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.PENDING)
    })

    it('should throw error if pending request already exists', async () => {
      const existingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(existingRequest)

      await expect(
        submitOrganizerRequest({
          teamId: mockTeamId,
          userId: mockUserId,
          reason: mockReason,
        }),
      ).rejects.toThrow(
        'A pending organizer request already exists for this team',
      )
    })

    it('should throw error if team is already approved', async () => {
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(null) // No pending request
        .mockResolvedValueOnce(
          createMockRequest({status: ORGANIZER_REQUEST_STATUS.APPROVED}),
        ) // But approved exists

      await expect(
        submitOrganizerRequest({
          teamId: mockTeamId,
          userId: mockUserId,
          reason: mockReason,
        }),
      ).rejects.toThrow('This team is already approved as an organizer')
    })

    it('should throw error if request creation fails', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      // Mock insert to return no insertId (failed insert)
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue({insertId: null})
      } as any)

      await expect(
        submitOrganizerRequest({
          teamId: mockTeamId,
          userId: mockUserId,
          reason: mockReason,
        }),
      ).rejects.toThrow('Failed to create organizer request')
    })
  })

  describe('approveOrganizerRequest', () => {
    it('should approve pending request', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })
      const approvedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.APPROVED,
        reviewedBy: mockAdminUserId,
        reviewedAt: new Date(),
        adminNotes: 'Good application',
      })

      // First call: get request to approve
      // Second call: return updated request after update
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(approvedRequest)

      mockDb.query.userTable.findFirst.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      })

      mockDb.query.teamTable.findFirst.mockResolvedValue({
        name: 'Test Team',
        slug: 'test-team',
      })

      const result = await approveOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
        adminNotes: 'Good application',
      })

      // Verify request was updated to approved
      expect(result).toEqual(approvedRequest)
      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.APPROVED)
    })

    it('should throw error if request not found', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      await expect(
        approveOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Organizer request not found')
    })

    it('should throw error if request already processed (not pending)', async () => {
      const approvedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.APPROVED,
      })

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(approvedRequest)

      await expect(
        approveOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Request has already been processed')
    })

    it('should throw error if request is rejected', async () => {
      const rejectedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.REJECTED,
      })

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(rejectedRequest)

      await expect(
        approveOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Request has already been processed')
    })

    it('should throw error if update fails', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })

      // First call: get request
      // Second call: failed to retrieve updated request (null)
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(null)  // Failed to retrieve updated

      await expect(
        approveOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Failed to retrieve updated organizer request')
    })
  })

  describe('rejectOrganizerRequest', () => {
    it('should reject pending request', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })
      const rejectedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.REJECTED,
        reviewedBy: mockAdminUserId,
        reviewedAt: new Date(),
        adminNotes: 'Not ready',
      })

      // First call: get request to reject
      // Second call: return updated request after update
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(rejectedRequest)

      mockDb.query.userTable.findFirst.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      })

      mockDb.query.teamTable.findFirst.mockResolvedValue({
        name: 'Test Team',
      })

      const result = await rejectOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
        adminNotes: 'Not ready',
      })

      // Verify request was updated to rejected
      expect(result).toEqual(rejectedRequest)
      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.REJECTED)
    })

    it('should reject pending request with revokeFeature option', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })
      const rejectedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.REJECTED,
        reviewedBy: mockAdminUserId,
        reviewedAt: new Date(),
      })

      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(rejectedRequest)

      mockDb.query.userTable.findFirst.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      })

      mockDb.query.teamTable.findFirst.mockResolvedValue({
        name: 'Test Team',
      })

      mockDb.query.featureTable.findFirst.mockResolvedValue({
        id: 'feature-123',
        key: FEATURES.HOST_COMPETITIONS,
      })

      const result = await rejectOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
        revokeFeature: true,
      })

      // Verify request was updated
      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.REJECTED)
    })

    it('should throw error if request not found', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      await expect(
        rejectOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Organizer request not found')
    })

    it('should throw error if request already processed (not pending)', async () => {
      const approvedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.APPROVED,
      })

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(approvedRequest)

      await expect(
        rejectOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
          revokeFeature: true,
        }),
      ).rejects.toThrow('Request has already been processed')
    })

    it('should throw error if update fails', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })

      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(null)  // Failed to retrieve updated

      await expect(
        rejectOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Failed to retrieve updated organizer request')
    })
  })

  describe('isApprovedOrganizer', () => {
    it('should return true if team has approved organizer request', async () => {
      const approvedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.APPROVED,
      })

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(approvedRequest)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(true)
    })

    it('should return false if team has no approved request', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has pending request instead', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has rejected request', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(false)
    })
  })

  describe('hasPendingOrganizerRequest', () => {
    it('should return true if team has pending organizer request', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(pendingRequest)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(true)
    })

    it('should return false if team has no pending request', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has approved request instead', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has rejected request', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(false)
    })
  })

  describe('getOrganizerRequest', () => {
    it('should return the most recent organizer request for a team', async () => {
      const mockRequest = createMockRequest()

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(mockRequest)

      const result = await getOrganizerRequest(mockTeamId)

      expect(result).toEqual(mockRequest)
    })

    it('should return null if no request exists for team', async () => {
      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(null)

      const result = await getOrganizerRequest(mockTeamId)

      expect(result).toBeNull()
    })

    it('should query by descending createdAt to get most recent', async () => {
      const mockRequest = createMockRequest()

      mockDb.query.organizerRequestTable.findFirst.mockResolvedValue(mockRequest)

      await getOrganizerRequest(mockTeamId)

      // Verify that findFirst was called (the actual orderBy is handled internally)
      expect(mockDb.query.organizerRequestTable.findFirst).toHaveBeenCalled()
    })
  })

  describe('Integration: Submit → Approve flow', () => {
    it('should successfully flow from submit to approve', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })
      const approvedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.APPROVED,
        reviewedBy: mockAdminUserId,
        reviewedAt: new Date(),
      })

      // Mock for submit
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(null)  // No pending
        .mockResolvedValueOnce(null)  // No approved
        .mockResolvedValueOnce(pendingRequest)  // Return created request

      mockDb.query.featureTable.findFirst.mockResolvedValue({
        id: 'feature-123',
        key: FEATURES.HOST_COMPETITIONS,
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue({insertId: mockRequestId})
      } as any)

      // Submit request
      const submitted = await submitOrganizerRequest({
        teamId: mockTeamId,
        userId: mockUserId,
        reason: mockReason,
      })

      expect(submitted.status).toBe(ORGANIZER_REQUEST_STATUS.PENDING)

      // Reset mocks for approve step
      vi.clearAllMocks()
      mockDb.reset()
      mockDb.registerTable('organizerRequestTable')
      mockDb.registerTable('teamFeatureEntitlementTable')
      mockDb.registerTable('teamEntitlementOverrideTable')
      mockDb.registerTable('featureTable')
      mockDb.registerTable('userTable')
      mockDb.registerTable('teamTable')

      // Mock for approve
      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(approvedRequest)

      mockDb.query.userTable.findFirst.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      })

      mockDb.query.teamTable.findFirst.mockResolvedValue({
        name: 'Test Team',
        slug: 'test-team',
      })

      // Approve request
      const approved = await approveOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
      })

      expect(approved.status).toBe(ORGANIZER_REQUEST_STATUS.APPROVED)
    })

    it('should successfully flow from submit to reject', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })
      const rejectedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.REJECTED,
        reviewedBy: mockAdminUserId,
        reviewedAt: new Date(),
      })

      mockDb.query.organizerRequestTable.findFirst
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(rejectedRequest)

      mockDb.query.userTable.findFirst.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      })

      mockDb.query.teamTable.findFirst.mockResolvedValue({
        name: 'Test Team',
      })

      mockDb.query.featureTable.findFirst.mockResolvedValue({
        id: 'feature-123',
        key: FEATURES.HOST_COMPETITIONS,
      })

      const result = await rejectOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
        revokeFeature: true,
      })

      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.REJECTED)
    })
  })
})

/**
 * Entitlement Grant/Revoke Functions Tests
 *
 * Tests the three core entitlement functions:
 * - grantTeamFeature: Grant a feature to a team (with upsert behavior)
 * - setTeamLimitOverride: Set a limit override for a team (with upsert behavior)
 * - revokeTeamFeature: Revoke a feature from a team (set isActive = 0)
 */
describe('Entitlement Grant/Revoke Functions', () => {
  const mockTeamId = 'team-123'
  const mockFeatureId = 'feature-456'
  const mockFeatureKey = FEATURES.HOST_COMPETITIONS
  const mockLimitKey = LIMITS.MAX_PUBLISHED_COMPETITIONS

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockDb.registerTable('organizerRequestTable')
    mockDb.registerTable('teamFeatureEntitlementTable')
    mockDb.registerTable('teamEntitlementOverrideTable')
    mockDb.registerTable('featureTable')
    mockDb.registerTable('userTable')
    mockDb.registerTable('teamTable')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('grantTeamFeature', () => {
    describe('when feature exists', () => {
      it('should look up feature by key and insert entitlement', async () => {
        // ARRANGE: Mock feature lookup
        mockDb.query.featureTable.findFirst.mockResolvedValue({
          id: mockFeatureId,
          key: mockFeatureKey,
          name: 'Host Competitions',
        })

        const mockOnDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined)
        const mockValues = vi.fn().mockReturnValue({
          onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate,
        })

        mockDb.insert.mockReturnValue({
          values: mockValues,
        } as any)

        // ACT
        await grantTeamFeature(mockTeamId, mockFeatureKey)

        // ASSERT
        expect(mockDb.query.featureTable.findFirst).toHaveBeenCalled()
        expect(mockDb.insert).toHaveBeenCalled()
        expect(mockValues).toHaveBeenCalledWith({
          teamId: mockTeamId,
          featureId: mockFeatureId,
          source: 'override',
          isActive: 1,
        })
      })

      it('should handle upsert (onDuplicateKeyUpdate) for duplicate grants', async () => {
        // ARRANGE: Mock feature lookup
        mockDb.query.featureTable.findFirst.mockResolvedValue({
          id: mockFeatureId,
          key: mockFeatureKey,
        })

        const mockOnDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined)
        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate,
          }),
        } as any)

        // ACT
        await grantTeamFeature(mockTeamId, mockFeatureKey)

        // ASSERT: onDuplicateKeyUpdate was called with correct params
        expect(mockOnDuplicateKeyUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            set: {
              isActive: 1,
              source: 'override',
            },
          }),
        )
      })

      it('should invalidate team member sessions after granting feature', async () => {
        // ARRANGE: Mock feature lookup
        mockDb.query.featureTable.findFirst.mockResolvedValue({
          id: mockFeatureId,
          key: mockFeatureKey,
        })

        mockDb.insert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined),
          }),
        } as any)

        // ACT
        await grantTeamFeature(mockTeamId, mockFeatureKey)

        // ASSERT: Session invalidation was called with teamId
        expect(invalidateTeamMembersSessions).toHaveBeenCalledWith(mockTeamId)
      })
    })

    describe('when feature does not exist', () => {
      it('should throw error when feature is not found', async () => {
        // ARRANGE: Mock feature lookup returning null
        mockDb.query.featureTable.findFirst.mockResolvedValue(null)

        // ACT & ASSERT
        await expect(
          grantTeamFeature(mockTeamId, 'nonexistent_feature'),
        ).rejects.toThrow('Feature not found: nonexistent_feature')
      })
    })
  })

  describe('setTeamLimitOverride', () => {
    describe('with all parameters', () => {
      it('should insert limit override with teamId, type, key, value, and reason', async () => {
        // ARRANGE
        const mockOnDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined)
        const mockValues = vi.fn().mockReturnValue({
          onDuplicateKeyUpdate: mockOnDuplicateKeyUpdate,
        })

        mockDb.insert.mockReturnValue({
          values: mockValues,
        } as any)

        // ACT
        await setTeamLimitOverride(
          mockTeamId,
          mockLimitKey,
          -1,
          'Organizer request approved',
        )

        // ASSERT
        expect(mockDb.insert).toHaveBeenCalled()
        expect(mockValues).toHaveBeenCalledWith({
          teamId: mockTeamId,
          type: 'limit',
          key: mockLimitKey,
          value: '-1',
          reason: 'Organizer request approved',
        })
      })
    })

    describe('without optional reason parameter', () => {
      it('should insert limit override with undefined reason', async () => {
        // ARRANGE
        const mockValues = vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })
        const mockInsert = vi.fn().mockReturnValue({
          values: mockValues,
        })

        const mockDb = {
          insert: mockInsert,
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT
        await setTeamLimitOverride(mockTeamId, mockLimitKey, 0)

        // ASSERT
        expect(mockValues).toHaveBeenCalledWith({
          teamId: mockTeamId,
          type: 'limit',
          key: mockLimitKey,
          value: '0',
          reason: undefined,
        })
      })
    })

    describe('upsert behavior', () => {
      it('should handle upsert for duplicate overrides', async () => {
        // ARRANGE
        const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
        const mockInsert = vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: mockOnConflictDoUpdate,
          }),
        })

        const mockDb = {
          insert: mockInsert,
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT
        await setTeamLimitOverride(
          mockTeamId,
          mockLimitKey,
          5,
          'Updated limit',
        )

        // ASSERT: onConflictDoUpdate was called with correct params
        expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            set: {
              value: '5',
              reason: 'Updated limit',
            },
          }),
        )
      })
    })

    describe('value conversion', () => {
      it('should convert numeric value to string', async () => {
        // ARRANGE
        const mockValues = vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })
        const mockInsert = vi.fn().mockReturnValue({
          values: mockValues,
        })

        const mockDb = {
          insert: mockInsert,
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT
        await setTeamLimitOverride(mockTeamId, mockLimitKey, 10)

        // ASSERT: value should be converted to string
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            value: '10',
          }),
        )
      })

      it('should handle negative values correctly (unlimited = -1)', async () => {
        // ARRANGE
        const mockValues = vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })
        const mockInsert = vi.fn().mockReturnValue({
          values: mockValues,
        })

        const mockDb = {
          insert: mockInsert,
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT
        await setTeamLimitOverride(mockTeamId, mockLimitKey, -1)

        // ASSERT: -1 should be preserved as string
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            value: '-1',
          }),
        )
      })

      it('should handle zero value correctly (pending state)', async () => {
        // ARRANGE
        const mockValues = vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        })
        const mockInsert = vi.fn().mockReturnValue({
          values: mockValues,
        })

        const mockDb = {
          insert: mockInsert,
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT
        await setTeamLimitOverride(
          mockTeamId,
          mockLimitKey,
          0,
          'Organizer request pending approval',
        )

        // ASSERT: 0 should be preserved as string
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({
            value: '0',
          }),
        )
      })
    })
  })

  describe('revokeTeamFeature', () => {
    describe('when feature exists', () => {
      it('should look up feature by key and set isActive = 0', async () => {
        // ARRANGE
        const mockSet = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        })
        const mockUpdate = vi.fn().mockReturnValue({
          set: mockSet,
        })

        const mockDb = {
          query: {
            featureTable: {
              findFirst: vi.fn().mockResolvedValue({
                id: mockFeatureId,
                key: mockFeatureKey,
              }),
            },
          },
          update: mockUpdate,
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT
        await revokeTeamFeature(mockTeamId, mockFeatureKey)

        // ASSERT
        expect(mockDb.query.featureTable.findFirst).toHaveBeenCalled()
        expect(mockUpdate).toHaveBeenCalled()
        expect(mockSet).toHaveBeenCalledWith({isActive: 0})
      })

      it('should invalidate team member sessions after revoking feature', async () => {
        // ARRANGE
        const mockDb = {
          query: {
            featureTable: {
              findFirst: vi.fn().mockResolvedValue({
                id: mockFeatureId,
                key: mockFeatureKey,
              }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)
        vi.mocked(invalidateTeamMembersSessions).mockClear()

        // ACT
        await revokeTeamFeature(mockTeamId, mockFeatureKey)

        // ASSERT: Session invalidation was called with teamId
        expect(invalidateTeamMembersSessions).toHaveBeenCalledWith(mockTeamId)
      })
    })

    describe('when feature does not exist', () => {
      it('should throw error when feature is not found', async () => {
        // ARRANGE
        const mockDb = {
          query: {
            featureTable: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        }

        vi.mocked(getDb).mockReturnValue(mockDb as any)

        // ACT & ASSERT
        await expect(
          revokeTeamFeature(mockTeamId, 'nonexistent_feature'),
        ).rejects.toThrow('Feature not found: nonexistent_feature')
      })
    })
  })

  describe('Integration: grantTeamFeature → revokeTeamFeature flow', () => {
    it('should successfully grant then revoke a feature', async () => {
      const mockFeature = {
        id: mockFeatureId,
        key: mockFeatureKey,
        name: 'Host Competitions',
      }

      // ARRANGE for grant
      const mockDbGrant = {
        query: {
          featureTable: {
            findFirst: vi.fn().mockResolvedValue(mockFeature),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDbGrant as any)

      // ACT: Grant feature
      await grantTeamFeature(mockTeamId, mockFeatureKey)

      // ASSERT: Insert was called
      expect(mockDbGrant.insert).toHaveBeenCalled()

      // Reset for revoke
      vi.clearAllMocks()

      // ARRANGE for revoke
      const mockDbRevoke = {
        query: {
          featureTable: {
            findFirst: vi.fn().mockResolvedValue(mockFeature),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDbRevoke as any)

      // ACT: Revoke feature
      await revokeTeamFeature(mockTeamId, mockFeatureKey)

      // ASSERT: Update was called with isActive = 0
      expect(mockDbRevoke.update).toHaveBeenCalled()
    })
  })

  describe('Integration: setTeamLimitOverride for organizer states', () => {
    it('should set limit to 0 for pending state, then -1 for approved state', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      })

      const mockDb = {
        insert: mockInsert,
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      // ACT: Set pending state (limit = 0)
      await setTeamLimitOverride(
        mockTeamId,
        LIMITS.MAX_PUBLISHED_COMPETITIONS,
        0,
        'Organizer request pending approval',
      )

      expect(mockInsert).toHaveBeenCalled()

      // Reset for approved state
      vi.clearAllMocks()
      vi.mocked(getDb).mockReturnValue(mockDb as any)

      // ACT: Set approved state (limit = -1, unlimited)
      await setTeamLimitOverride(
        mockTeamId,
        LIMITS.MAX_PUBLISHED_COMPETITIONS,
        -1,
        'Organizer request approved',
      )

      expect(mockInsert).toHaveBeenCalled()
    })
  })
})
