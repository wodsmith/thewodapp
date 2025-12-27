import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest'
import {ZSAError} from '@repo/zsa'
import type {SessionValidationResult} from '@/types'

// Mock dependencies before importing the server functions
vi.mock('@/utils/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/server/organizer-onboarding', () => ({
  getPendingOrganizerRequests: vi.fn(),
  approveOrganizerRequest: vi.fn(),
  rejectOrganizerRequest: vi.fn(),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let handlerFn: any
    return {
      inputValidator: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: (fn: any) => {
          handlerFn = fn
          // Return the handler directly for simple invocation
          return handlerFn
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (fn: any) => {
        handlerFn = fn
        // Return the handler directly for simple invocation
        return handlerFn
      },
    }
  },
}))

// Import after mocks are set up
import {
  getPendingOrganizerRequestsFn,
  approveOrganizerRequestFn,
  rejectOrganizerRequestFn,
} from '@/server-fns/organizer-admin-fns'
import {requireAdmin} from '@/utils/auth'
import {
  getPendingOrganizerRequests,
  approveOrganizerRequest,
  rejectOrganizerRequest,
} from '@/server/organizer-onboarding'

// Mock session for admin user
const mockAdminSession: SessionValidationResult = {
  id: 'session-admin-123',
  userId: 'admin-user-123',
  expiresAt: Date.now() + 86400000,
  createdAt: Date.now(),
  user: {
    id: 'admin-user-123',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    emailVerified: new Date(),
    role: 'admin',
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    currentCredits: 100,
    lastCreditRefreshAt: null,
    initials: 'AU',
  },
  teams: [],
}

const mockPendingRequest = {
  id: 'request-123',
  userId: 'user-123',
  teamId: 'team-123',
  reason: 'Want to run competitions',
  status: 'pending' as const,
  adminNotes: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  updateCounter: 0,
  team: {
    id: 'team-123',
    name: 'Test Team',
    slug: 'test-team',
  },
  user: {
    id: 'user-123',
    firstName: 'Test',
    lastName: 'User',
    email: 'organizer@example.com',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue(mockAdminSession)
  vi.mocked(getPendingOrganizerRequests).mockResolvedValue([])
  vi.mocked(approveOrganizerRequest).mockResolvedValue({
    ...mockPendingRequest,
    status: 'approved',
  })
  vi.mocked(rejectOrganizerRequest).mockResolvedValue({
    ...mockPendingRequest,
    status: 'rejected',
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('organizer admin server functions', () => {
  describe('getPendingOrganizerRequestsFn', () => {
    it('should return pending organizer requests when user is admin', async () => {
      const mockRequests = [mockPendingRequest]
      vi.mocked(getPendingOrganizerRequests).mockResolvedValue(mockRequests)

      // @ts-expect-error - mock function accepts any args
      const result = await getPendingOrganizerRequestsFn({data: {}})

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockRequests)
      expect(requireAdmin).toHaveBeenCalledOnce()
      expect(getPendingOrganizerRequests).toHaveBeenCalledOnce()
    })

    it('should return empty list when there are no pending requests', async () => {
      vi.mocked(getPendingOrganizerRequests).mockResolvedValue([])

      // @ts-expect-error - mock function accepts any args
      const result = await getPendingOrganizerRequestsFn({data: {}})

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should throw error when user is not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new ZSAError('FORBIDDEN', 'Not authorized'),
      )

      // @ts-expect-error - mock function accepts any args
      await expect(getPendingOrganizerRequestsFn({data: {}})).rejects.toThrow(
        ZSAError,
      )
      expect(getPendingOrganizerRequests).not.toHaveBeenCalled()
    })

    it('should handle database errors and convert to INTERNAL_SERVER_ERROR', async () => {
      vi.mocked(getPendingOrganizerRequests).mockRejectedValue(
        new Error('Database connection failed'),
      )

      await expect(
        // @ts-expect-error - mock function accepts any args
        getPendingOrganizerRequestsFn({data: {}}),
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get pending organizer requests',
      })
    })

    it('should propagate ZSAError from server function', async () => {
      const zsaError = new ZSAError('NOT_FOUND', 'No requests found')
      vi.mocked(getPendingOrganizerRequests).mockRejectedValue(zsaError)

      await expect(
        // @ts-expect-error - mock function accepts any args
        getPendingOrganizerRequestsFn({data: {}}),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'No requests found',
      })
    })

    it('should return multiple pending requests', async () => {
      const mockRequests = [
        mockPendingRequest,
        {
          ...mockPendingRequest,
          id: 'request-124',
          user: {
            ...mockPendingRequest.user,
            email: 'organizer2@example.com',
          },
        },
      ]
      vi.mocked(getPendingOrganizerRequests).mockResolvedValue(mockRequests)

      // @ts-expect-error - mock function accepts any args
      const result = await getPendingOrganizerRequestsFn({data: {}})

      expect(result.data).toHaveLength(2)
      expect(result.data).toEqual(mockRequests)
    })
  })

  describe('approveOrganizerRequestFn', () => {
    it('should approve organizer request with valid input', async () => {
      const mockResult = {...mockPendingRequest, status: 'approved' as const}
      vi.mocked(approveOrganizerRequest).mockResolvedValue(mockResult)

      const result = await approveOrganizerRequestFn({
        data: {
          requestId: 'request-123',
          adminNotes: 'Approved - legitimate organizer',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResult)
      expect(approveOrganizerRequest).toHaveBeenCalledWith({
        requestId: 'request-123',
        adminUserId: 'admin-user-123',
        adminNotes: 'Approved - legitimate organizer',
      })
    })

    it('should approve request without optional adminNotes', async () => {
      const mockResult = {...mockPendingRequest, status: 'approved' as const}
      vi.mocked(approveOrganizerRequest).mockResolvedValue(mockResult)

      const result = await approveOrganizerRequestFn({
        data: {
          requestId: 'request-123',
        },
      })

      expect(result.success).toBe(true)
      expect(approveOrganizerRequest).toHaveBeenCalledWith({
        requestId: 'request-123',
        adminUserId: 'admin-user-123',
        adminNotes: undefined,
      })
    })

    it('should reject approval when user is not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new ZSAError('FORBIDDEN', 'Not authorized'),
      )

      await expect(
        approveOrganizerRequestFn({
          data: {requestId: 'request-123'},
        }),
      ).rejects.toThrow(ZSAError)
      expect(approveOrganizerRequest).not.toHaveBeenCalled()
    })

    it('should handle server function errors', async () => {
      vi.mocked(approveOrganizerRequest).mockRejectedValue(
        new Error('Request not found'),
      )

      await expect(
        approveOrganizerRequestFn({
          data: {requestId: 'nonexistent-123'},
        }),
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Request not found',
      })
    })

    it('should propagate ZSAError from server function', async () => {
      const zsaError = new ZSAError('NOT_FOUND', 'Request not found')
      vi.mocked(approveOrganizerRequest).mockRejectedValue(zsaError)

      await expect(
        approveOrganizerRequestFn({
          data: {requestId: 'nonexistent-123'},
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Request not found',
      })
    })

    it('should pass correct admin user ID from session', async () => {
      vi.mocked(approveOrganizerRequest).mockResolvedValue({
        ...mockPendingRequest,
        status: 'approved',
      })

      await approveOrganizerRequestFn({
        data: {requestId: 'request-123'},
      })

      expect(approveOrganizerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-user-123',
        }),
      )
    })
  })

  describe('rejectOrganizerRequestFn', () => {
    it('should reject organizer request with valid input', async () => {
      const mockResult = {...mockPendingRequest, status: 'rejected' as const}
      vi.mocked(rejectOrganizerRequest).mockResolvedValue(mockResult)

      const result = await rejectOrganizerRequestFn({
        data: {
          requestId: 'request-123',
          adminNotes: 'Rejected - insufficient credentials',
          revokeFeature: false,
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResult)
      expect(rejectOrganizerRequest).toHaveBeenCalledWith({
        requestId: 'request-123',
        adminUserId: 'admin-user-123',
        adminNotes: 'Rejected - insufficient credentials',
        revokeFeature: false,
      })
    })

    it('should reject request without optional adminNotes', async () => {
      const mockResult = {...mockPendingRequest, status: 'rejected' as const}
      vi.mocked(rejectOrganizerRequest).mockResolvedValue(mockResult)

      const result = await rejectOrganizerRequestFn({
        data: {
          requestId: 'request-123',
          revokeFeature: false,
        },
      })

      expect(result.success).toBe(true)
      expect(rejectOrganizerRequest).toHaveBeenCalledWith({
        requestId: 'request-123',
        adminUserId: 'admin-user-123',
        adminNotes: undefined,
        revokeFeature: false,
      })
    })

    it('should use default revokeFeature value of false', async () => {
      vi.mocked(rejectOrganizerRequest).mockResolvedValue({
        ...mockPendingRequest,
        status: 'rejected',
      })

      await rejectOrganizerRequestFn({
        data: {requestId: 'request-123'},
      })

      expect(rejectOrganizerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          revokeFeature: false,
        }),
      )
    })

    it('should reject request with revokeFeature=true', async () => {
      vi.mocked(rejectOrganizerRequest).mockResolvedValue({
        ...mockPendingRequest,
        status: 'rejected',
      })

      await rejectOrganizerRequestFn({
        data: {
          requestId: 'request-123',
          revokeFeature: true,
        },
      })

      expect(rejectOrganizerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          revokeFeature: true,
        }),
      )
    })

    it('should reject rejection when user is not admin', async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new ZSAError('FORBIDDEN', 'Not authorized'),
      )

      await expect(
        rejectOrganizerRequestFn({
          data: {requestId: 'request-123'},
        }),
      ).rejects.toThrow(ZSAError)
      expect(rejectOrganizerRequest).not.toHaveBeenCalled()
    })

    it('should handle server function errors', async () => {
      vi.mocked(rejectOrganizerRequest).mockRejectedValue(
        new Error('Request not found'),
      )

      await expect(
        rejectOrganizerRequestFn({
          data: {requestId: 'nonexistent-123'},
        }),
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Request not found',
      })
    })

    it('should propagate ZSAError from server function', async () => {
      const zsaError = new ZSAError('NOT_FOUND', 'Request not found')
      vi.mocked(rejectOrganizerRequest).mockRejectedValue(zsaError)

      await expect(
        rejectOrganizerRequestFn({
          data: {requestId: 'nonexistent-123'},
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Request not found',
      })
    })

    it('should pass correct admin user ID from session', async () => {
      vi.mocked(rejectOrganizerRequest).mockResolvedValue({
        ...mockPendingRequest,
        status: 'rejected',
      })

      await rejectOrganizerRequestFn({
        data: {requestId: 'request-123'},
      })

      expect(rejectOrganizerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-user-123',
        }),
      )
    })

    it('should handle revoke feature flag correctly when set', async () => {
      vi.mocked(rejectOrganizerRequest).mockResolvedValue({
        ...mockPendingRequest,
        status: 'rejected',
      })

      await rejectOrganizerRequestFn({
        data: {
          requestId: 'request-123',
          adminNotes: 'Revoking access due to violation',
          revokeFeature: true,
        },
      })

      expect(rejectOrganizerRequest).toHaveBeenCalledWith({
        requestId: 'request-123',
        adminUserId: 'admin-user-123',
        adminNotes: 'Revoking access due to violation',
        revokeFeature: true,
      })
    })

    it('should handle multiple rejections with different revokeFeature values', async () => {
      vi.mocked(rejectOrganizerRequest).mockResolvedValue({
        ...mockPendingRequest,
        status: 'rejected',
      })

      // First rejection without revoke
      await rejectOrganizerRequestFn({
        data: {
          requestId: 'request-123',
          revokeFeature: false,
        },
      })

      expect(rejectOrganizerRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          revokeFeature: false,
        }),
      )

      // Second rejection with revoke
      await rejectOrganizerRequestFn({
        data: {
          requestId: 'request-124',
          revokeFeature: true,
        },
      })

      expect(rejectOrganizerRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          revokeFeature: true,
        }),
      )
    })
  })

  describe('error handling across all functions', () => {
    it('should log errors to console', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      vi.mocked(getPendingOrganizerRequests).mockRejectedValue(
        new Error('Test error'),
      )

      // @ts-expect-error - mock function accepts any args
      await expect(getPendingOrganizerRequestsFn({data: {}})).rejects.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to get pending organizer requests:',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle unknown error types', async () => {
      vi.mocked(approveOrganizerRequest).mockRejectedValue('String error')

      await expect(
        approveOrganizerRequestFn({
          data: {requestId: 'request-123'},
        }),
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
      })
    })
  })
})
