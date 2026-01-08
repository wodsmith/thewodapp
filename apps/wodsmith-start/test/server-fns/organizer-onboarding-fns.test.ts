import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest'
import {z} from 'zod'
import {createTestSession} from '@repo/test-utils/factories'
import {
  submitOrganizerRequestFn,
  getOrganizerRequestStatusFn,
  getOrganizerRequest,
  hasPendingOrganizerRequest,
  isApprovedOrganizer,
} from '@/server-fns/organizer-onboarding-fns'
import {TEAM_PERMISSIONS} from '@/db/schema'
import type {SessionWithMeta} from '@repo/test-utils/factories'

// Define schemas for testing validation separately
// These mirror the schemas in the server functions file
const submitOrganizerRequestSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  reason: z
    .string()
    .min(10, 'Please provide more detail about why you want to organize')
    .max(2000, 'Reason is too long'),
  captchaToken: z.string().optional(),
})

const getOrganizerRequestStatusSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let handlerFn: any
    return {
      inputValidator: () => ({
        handler: (fn: any) => {
          handlerFn = fn
          return handlerFn
        },
      }),
      handler: (fn: any) => {
        handlerFn = fn
        return handlerFn
      },
    }
  },
}))

// Mock dependencies
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(),
}))

vi.mock('@/utils/validate-captcha', () => ({
  validateTurnstileToken: vi.fn(),
}))

vi.mock('@/db', () => ({
  getDb: vi.fn(() => ({
    query: {
      organizerRequestTable: {
        findFirst: vi.fn(),
      },
      teamMembershipTable: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  })),
}))

vi.mock('@/server/organizer-onboarding', () => ({
  grantTeamFeature: vi.fn(),
  setTeamLimitOverride: vi.fn(),
}))

// Mock KV session functions - updateAllSessionsOfUser is called after organizer request submission
vi.mock('@/utils/kv-session', () => ({
  updateAllSessionsOfUser: vi.fn().mockResolvedValue(undefined),
}))

const mockSession: SessionWithMeta = createTestSession({
  userId: 'user-123',
  teamId: 'team-123',
  teamSlug: 'test-team',
  teamRole: 'owner',
  permissions: [
    TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
    TEAM_PERMISSIONS.ACCESS_DASHBOARD,
  ],
})

beforeEach(async () => {
  vi.clearAllMocks()
  const {getSessionFromCookie} = await import('@/utils/auth')
  const {validateTurnstileToken} = await import('@/utils/validate-captcha')

  vi.mocked(getSessionFromCookie).mockResolvedValue(mockSession)
  vi.mocked(validateTurnstileToken).mockResolvedValue(true)

  // Setup default DB mock
  const {getDb} = await import('@/db')
  const mockReturning = vi.fn().mockResolvedValue([
    {
      id: 'request-123',
      teamId: 'team-123',
      userId: 'user-123',
      reason: 'Want to organize competitions',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
  vi.mocked(getDb).mockReturnValue({
    query: {
      organizerRequestTable: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      teamMembershipTable: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockReturning,
      })),
    })),
  } as any)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('organizer-onboarding-fns', () => {
  describe('submitOrganizerRequestFn', () => {
    const validInput = {
      teamId: 'team-123',
      reason: 'I want to organize competitions for my gym',
      captchaToken: 'valid-captcha-token',
    }

    it('should successfully submit an organizer request with valid input', async () => {
      const result = await submitOrganizerRequestFn({data: validInput})

      expect(result).toBeDefined()
      expect(result?.success).toBe(true)
      expect(result?.data.id).toBe('request-123')
    })

    it('should validate captcha token if provided', async () => {
      const {validateTurnstileToken} = await import('@/utils/validate-captcha')

      await submitOrganizerRequestFn({data: validInput})

      expect(validateTurnstileToken).toHaveBeenCalledWith('valid-captcha-token')
    })

    it('should reject request with invalid captcha token', async () => {
      const {validateTurnstileToken} = await import('@/utils/validate-captcha')
      vi.mocked(validateTurnstileToken).mockResolvedValue(false)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow('Invalid captcha')
    })

    it('should skip captcha validation if token not provided', async () => {
      const {validateTurnstileToken} = await import('@/utils/validate-captcha')
      const inputWithoutCaptcha = {
        teamId: 'team-123',
        reason: 'I want to organize competitions for my gym',
      }

      await submitOrganizerRequestFn({data: inputWithoutCaptcha})

      expect(validateTurnstileToken).not.toHaveBeenCalled()
    })

    it('should reject request when user is not authenticated', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValue(null)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow('You must be logged in')
    })

    it('should reject request when session has no user', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValue({
        ...mockSession,
        user: null,
      } as any)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow('You must be logged in')
    })

    it('should reject request when user lacks EDIT_TEAM_SETTINGS permission', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      const sessionWithoutPermission = createTestSession({
        userId: 'user-123',
        teamId: 'team-123',
        permissions: [TEAM_PERMISSIONS.ACCESS_DASHBOARD],
      })
      vi.mocked(getSessionFromCookie).mockResolvedValue(
        sessionWithoutPermission,
      )

      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow("don't have permission")
    })

    // Note: Schema validation tests use Zod directly since our mock bypasses inputValidator
    it('should validate reason field - too short (schema validation)', () => {
      const result = submitOrganizerRequestSchema.safeParse({
        ...validInput,
        reason: 'Short',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('more detail')
      }
    })

    it('should validate reason field - too long (schema validation)', () => {
      const longReason = 'a'.repeat(2001)
      const result = submitOrganizerRequestSchema.safeParse({
        ...validInput,
        reason: longReason,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('too long')
      }
    })

    it('should validate teamId is required (schema validation)', () => {
      const result = submitOrganizerRequestSchema.safeParse({
        ...validInput,
        teamId: '',
      })
      expect(result.success).toBe(false)
    })

    it('should handle error from submitOrganizerRequest server function', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error('Database error')),
          })),
        })),
      } as any)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow('Database error')
    })

    it('should not call submitOrganizerRequest if permission check fails', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      const {getDb} = await import('@/db')

      const sessionWithoutPermission = createTestSession({
        userId: 'user-123',
        teamId: 'team-123',
        permissions: [],
      })
      vi.mocked(getSessionFromCookie).mockResolvedValue(
        sessionWithoutPermission,
      )

      const mockInsert = vi.fn()
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: mockInsert,
      } as any)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow()
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('should not call submitOrganizerRequest if captcha validation fails', async () => {
      const {validateTurnstileToken} = await import('@/utils/validate-captcha')
      const {getDb} = await import('@/db')

      vi.mocked(validateTurnstileToken).mockResolvedValue(false)

      const mockInsert = vi.fn()
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: mockInsert,
      } as any)

      await expect(
        submitOrganizerRequestFn({data: validInput}),
      ).rejects.toThrow()
      expect(mockInsert).not.toHaveBeenCalled()
    })
  })

  describe('getOrganizerRequestStatusFn', () => {
    const validInput = {
      teamId: 'team-123',
    }

    beforeEach(async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'request-123',
              teamId: 'team-123',
              userId: 'user-123',
              reason: 'Want to organize competitions',
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)
    })

    it('should successfully get organizer request status', async () => {
      const result = await getOrganizerRequestStatusFn({data: validInput})

      expect(result).toBeDefined()
      expect(result?.success).toBe(true)
      expect(result?.data.request?.id).toBe('request-123')
    })

    it('should reject request when user is not authenticated', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValue(null)

      await expect(
        getOrganizerRequestStatusFn({data: validInput}),
      ).rejects.toThrow('You must be logged in')
    })

    it('should reject request when session has no user', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      vi.mocked(getSessionFromCookie).mockResolvedValue({
        ...mockSession,
        user: null,
      } as any)

      await expect(
        getOrganizerRequestStatusFn({data: validInput}),
      ).rejects.toThrow('You must be logged in')
    })

    it('should reject request when user lacks ACCESS_DASHBOARD permission', async () => {
      const {getSessionFromCookie} = await import('@/utils/auth')
      const sessionWithoutPermission = createTestSession({
        userId: 'user-123',
        teamId: 'team-123',
        permissions: [],
      })
      vi.mocked(getSessionFromCookie).mockResolvedValue(
        sessionWithoutPermission,
      )

      await expect(
        getOrganizerRequestStatusFn({data: validInput}),
      ).rejects.toThrow("don't have permission")
    })

    it('should return hasNoRequest true when there is no request', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      const result = await getOrganizerRequestStatusFn({data: validInput})

      expect(result?.data.hasNoRequest).toBe(true)
      expect(result?.data.request).toBeNull()
    })

    it('should return hasNoRequest false when there is a request', async () => {
      const result = await getOrganizerRequestStatusFn({data: validInput})

      expect(result?.data.hasNoRequest).toBe(false)
    })

    it('should validate teamId is required (schema validation)', () => {
      const result = getOrganizerRequestStatusSchema.safeParse({
        teamId: '',
      })
      expect(result.success).toBe(false)
    })

    it('should return all status flags in data object', async () => {
      const result = await getOrganizerRequestStatusFn({data: validInput})

      expect(result?.data).toHaveProperty('request')
      expect(result?.data).toHaveProperty('isPending')
      expect(result?.data).toHaveProperty('isApproved')
      expect(result?.data).toHaveProperty('hasNoRequest')
    })
  })

  describe('submitOrganizerRequestFn (server logic)', () => {
    it('should throw if pending request already exists', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'existing-request',
              status: 'pending',
            }),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      await expect(
        submitOrganizerRequestFn({
          data: {
            teamId: 'team-123',
            reason: 'I want to organize competitions for my gym',
          },
        }),
      ).rejects.toThrow('pending organizer request already exists')
    })

    it('should throw if team is already approved', async () => {
      const {getDb} = await import('@/db')
      let findFirstCallCount = 0
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockImplementation(() => {
              findFirstCallCount++
              // First call checks for pending (returns null)
              // Second call checks for approved (returns approved request)
              if (findFirstCallCount === 1) return null
              return {id: 'approved-request', status: 'approved'}
            }),
          },
          teamMembershipTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      await expect(
        submitOrganizerRequestFn({
          data: {
            teamId: 'team-123',
            reason: 'I want to organize competitions for my gym',
          },
        }),
      ).rejects.toThrow('already approved as an organizer')
    })
  })

  describe('getOrganizerRequest (server logic)', () => {
    it('should return null when no request exists', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      const result = await getOrganizerRequest({data: {teamId: 'team-123'}})

      expect(result).toBeNull()
    })

    it('should return the request when it exists', async () => {
      const mockRequest = {
        id: 'request-123',
        teamId: 'team-123',
        status: 'pending',
      }
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(mockRequest),
          },
        },
      } as any)

      const result = await getOrganizerRequest({data: {teamId: 'team-123'}})

      expect(result).toEqual(mockRequest)
    })
  })

  describe('hasPendingOrganizerRequest (server logic)', () => {
    it('should return false when no pending request exists', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      const result = await hasPendingOrganizerRequest({
        data: {teamId: 'team-123'},
      })

      expect(result).toBe(false)
    })

    it('should return true when pending request exists', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'request-123',
              status: 'pending',
            }),
          },
        },
      } as any)

      const result = await hasPendingOrganizerRequest({
        data: {teamId: 'team-123'},
      })

      expect(result).toBe(true)
    })
  })

  describe('isApprovedOrganizer (server logic)', () => {
    it('should return false when no approved request exists', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      } as any)

      const result = await isApprovedOrganizer({data: {teamId: 'team-123'}})

      expect(result).toBe(false)
    })

    it('should return true when approved request exists', async () => {
      const {getDb} = await import('@/db')
      vi.mocked(getDb).mockReturnValue({
        query: {
          organizerRequestTable: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'request-123',
              status: 'approved',
            }),
          },
        },
      } as any)

      const result = await isApprovedOrganizer({data: {teamId: 'team-123'}})

      expect(result).toBe(true)
    })
  })
})
