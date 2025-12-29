import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {
  submitOrganizerRequest,
  approveOrganizerRequest,
  rejectOrganizerRequest,
  isApprovedOrganizer,
  hasPendingOrganizerRequest,
  getOrganizerRequest,
} from '@/server/organizer-onboarding'
import {ORGANIZER_REQUEST_STATUS, type OrganizerRequest} from '@/db/schema'

// Mock the database
vi.mock('@/db', () => ({
  getDb: vi.fn(),
}))

import {getDb} from '@/db'

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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('submitOrganizerRequest', () => {
    it('should create a new organizer request', async () => {
      const mockRequest = createMockRequest()
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockRequest]),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(existingRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi
              .fn()
              .mockResolvedValueOnce(null) // No pending request
              .mockResolvedValueOnce(
                createMockRequest({status: ORGANIZER_REQUEST_STATUS.APPROVED}),
              ), // But approved exists
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      await expect(
        submitOrganizerRequest({
          teamId: mockTeamId,
          userId: mockUserId,
          reason: mockReason,
        }),
      ).rejects.toThrow('This team is already approved as an organizer')
    })

    it('should throw error if request creation fails', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // Empty array = failed insert
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([approvedRequest]),
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(approvedRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(rejectedRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // Empty array = failed update
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      await expect(
        approveOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Failed to update organizer request')
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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([rejectedRequest]),
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([rejectedRequest]),
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await rejectOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
        revokeFeature: true,
      })

      // Verify request was updated
      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.REJECTED)
    })

    it('should throw error if request not found', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(approvedRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // Empty array = failed update
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      await expect(
        rejectOrganizerRequest({
          requestId: mockRequestId,
          adminUserId: mockAdminUserId,
        }),
      ).rejects.toThrow('Failed to update organizer request')
    })
  })

  describe('isApprovedOrganizer', () => {
    it('should return true if team has approved organizer request', async () => {
      const approvedRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.APPROVED,
      })

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(approvedRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(true)
    })

    it('should return false if team has no approved request', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has pending request instead', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null), // findFirst with approved status returns null
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has rejected request', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await isApprovedOrganizer(mockTeamId)

      expect(result).toBe(false)
    })
  })

  describe('hasPendingOrganizerRequest', () => {
    it('should return true if team has pending organizer request', async () => {
      const pendingRequest = createMockRequest({
        status: ORGANIZER_REQUEST_STATUS.PENDING,
      })

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(true)
    })

    it('should return false if team has no pending request', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has approved request instead', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null), // findFirst with pending status returns null
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(false)
    })

    it('should return false if team has rejected request', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await hasPendingOrganizerRequest(mockTeamId)

      expect(result).toBe(false)
    })
  })

  describe('getOrganizerRequest', () => {
    it('should return the most recent organizer request for a team', async () => {
      const mockRequest = createMockRequest()

      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(mockRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await getOrganizerRequest(mockTeamId)

      expect(result).toEqual(mockRequest)
    })

    it('should return null if no request exists for team', async () => {
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

      const result = await getOrganizerRequest(mockTeamId)

      expect(result).toBeNull()
    })

    it('should query by descending createdAt to get most recent', async () => {
      const mockRequest = createMockRequest()
      const mockDb = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(mockRequest),
          },
        },
      }

      vi.mocked(getDb).mockReturnValue(mockDb as any)

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
      const mockDbSubmit = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([pendingRequest]),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDbSubmit as any)

      // Submit request
      const submitted = await submitOrganizerRequest({
        teamId: mockTeamId,
        userId: mockUserId,
        reason: mockReason,
      })

      expect(submitted.status).toBe(ORGANIZER_REQUEST_STATUS.PENDING)

      // Reset mocks for approve step
      vi.clearAllMocks()

      // Mock for approve
      const mockDbApprove = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([approvedRequest]),
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDbApprove as any)

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

      // Mock for reject
      const mockDbReject = {
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(pendingRequest),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([rejectedRequest]),
            }),
          }),
        }),
      }

      vi.mocked(getDb).mockReturnValue(mockDbReject as any)

      const result = await rejectOrganizerRequest({
        requestId: mockRequestId,
        adminUserId: mockAdminUserId,
        revokeFeature: true,
      })

      expect(result.status).toBe(ORGANIZER_REQUEST_STATUS.REJECTED)
    })
  })
})
