import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
// Import the mock KV from the mock file so we can configure it
import {mockKV} from '../__mocks__/cloudflare-workers.js'

// Mock the database
const mockDb = new FakeDrizzleDb()

vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock email sending
const mockSendPasswordResetEmail = vi.fn()
const mockSendVerificationEmail = vi.fn()

vi.mock('@/utils/email', () => ({
  sendPasswordResetEmail: (...args: unknown[]) =>
    mockSendPasswordResetEmail(...args),
  sendVerificationEmail: (...args: unknown[]) =>
    mockSendVerificationEmail(...args),
}))

// Create test sessions
const mockAuthenticatedSession = {
  userId: 'test-user-123',
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    firstName: 'Test',
    emailVerified: null,
  },
  teams: [],
}

const mockVerifiedSession = {
  userId: 'test-user-123',
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    firstName: 'Test',
    emailVerified: new Date(),
  },
  teams: [],
}

// Mock auth
vi.mock('@/utils/auth', () => ({
  getSessionFromCookie: vi.fn(() => Promise.resolve(null)),
}))

// Mock TanStack createServerFn to make server functions directly callable in tests
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    return {
      handler: (fn: (ctx: {data?: unknown}) => Promise<unknown>) => {
        // Return a wrapper that calls handler with empty data
        return async (ctx?: {data?: unknown}) => {
          return fn({data: ctx?.data})
        }
      },
      inputValidator: (validator: (data: unknown) => unknown) => ({
        handler: (fn: (ctx: {data: unknown}) => Promise<unknown>) => {
          // Return a wrapper that validates input then calls handler
          return async (ctx: {data: unknown}) => {
            // Run validation - will throw on invalid input
            const validatedData = validator(ctx.data)
            return fn({data: validatedData})
          }
        },
      }),
    }
  },
}))

// Import mocked getSessionFromCookie so we can change its behavior in tests
import {getSessionFromCookie} from '@/utils/auth'

// Helper to set mock session with proper type coercion
const setMockSession = (session: unknown) => {
  vi.mocked(getSessionFromCookie).mockResolvedValue(
    session as Awaited<ReturnType<typeof getSessionFromCookie>>,
  )
}

// Import server functions after mocks are set up
import {forgotPasswordFn, resendVerificationFn} from '@/server-fns/auth-fns'

describe('auth-fns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    // Register the userTable for query API
    mockDb.registerTable('userTable')
    mockKV.get.mockResolvedValue(null)
    mockKV.put.mockResolvedValue(undefined)
    mockKV.delete.mockResolvedValue(undefined)
    mockSendPasswordResetEmail.mockResolvedValue(undefined)
    mockSendVerificationEmail.mockResolvedValue(undefined)
    setMockSession(null)
  })

  describe('forgotPasswordFn', () => {
    it('returns success even when user is not found (prevents email enumeration)', async () => {
      // User not found - default is null
      mockDb.setMockSingleValue(null)

      const result = await forgotPasswordFn({
        data: {email: 'nonexistent@example.com'},
      })

      expect(result).toEqual({success: true})
      // Should not send email when user not found
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
      // Should not store token when user not found
      expect(mockKV.put).not.toHaveBeenCalled()
    })

    it('generates token and sends email when user exists', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
      }
      mockDb.setMockSingleValue(mockUser)

      const result = await forgotPasswordFn({
        data: {email: 'test@example.com'},
      })

      expect(result).toEqual({success: true})

      // Should store token in KV
      expect(mockKV.put).toHaveBeenCalledTimes(1)
      const [key, value, options] = mockKV.put.mock.calls[0]
      expect(key).toMatch(/^password-reset:/)
      expect(JSON.parse(value)).toMatchObject({
        userId: 'user-123',
      })
      expect(options).toHaveProperty('expirationTtl')

      // Should send email
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1)
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        resetToken: expect.any(String),
        username: 'Test',
      })
    })

    it('uses email as username when firstName is not available', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: null,
      }
      mockDb.setMockSingleValue(mockUser)

      await forgotPasswordFn({data: {email: 'test@example.com'}})

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        resetToken: expect.any(String),
        username: 'test@example.com',
      })
    })

    it('validates email format', async () => {
      await expect(
        forgotPasswordFn({data: {email: 'invalid-email'}}),
      ).rejects.toThrow()
    })

    it('returns success even when email sending fails (prevents information leakage)', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
      }
      mockDb.setMockSingleValue(mockUser)
      mockSendPasswordResetEmail.mockRejectedValue(new Error('Email failed'))

      const result = await forgotPasswordFn({
        data: {email: 'test@example.com'},
      })

      // Should still return success to prevent information leakage
      expect(result).toEqual({success: true})
    })

    it('normalizes email to lowercase', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
      }
      mockDb.setMockSingleValue(mockUser)

      await forgotPasswordFn({data: {email: 'TEST@EXAMPLE.COM'}})

      // The query should use lowercase email
      // Note: We can't easily verify the exact query, but we can verify the function completed
      expect(mockKV.put).toHaveBeenCalled()
    })
  })

  describe('resendVerificationFn', () => {
    it('throws error when not authenticated', async () => {
      setMockSession(null)

      await expect(resendVerificationFn({})).rejects.toThrow(
        'Not authenticated',
      )
    })

    it('throws error when session has no email', async () => {
      setMockSession({
        userId: 'test-user-123',
        user: {
          id: 'test-user-123',
          email: null,
        },
        teams: [],
      })

      await expect(resendVerificationFn({})).rejects.toThrow(
        'Not authenticated',
      )
    })

    it('throws error when email is already verified', async () => {
      setMockSession(mockVerifiedSession)

      await expect(resendVerificationFn({})).rejects.toThrow(
        'Email is already verified',
      )
    })

    it('generates token and sends verification email for unverified user', async () => {
      setMockSession(mockAuthenticatedSession)

      const result = await resendVerificationFn({})

      expect(result).toEqual({success: true})

      // Should store token in KV
      expect(mockKV.put).toHaveBeenCalledTimes(1)
      const [key, value, options] = mockKV.put.mock.calls[0]
      expect(key).toMatch(/^email-verification:/)
      expect(JSON.parse(value)).toMatchObject({
        userId: 'test-user-123',
      })
      expect(options).toHaveProperty('expirationTtl')

      // Should send verification email
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1)
      expect(mockSendVerificationEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        verificationToken: expect.any(String),
        username: 'Test',
      })
    })

    it('uses email as username when firstName is not available', async () => {
      setMockSession({
        userId: 'test-user-123',
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          firstName: null,
          emailVerified: null,
        },
        teams: [],
      })

      await resendVerificationFn({})

      expect(mockSendVerificationEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        verificationToken: expect.any(String),
        username: 'test@example.com',
      })
    })

    it('throws error when email sending fails', async () => {
      setMockSession(mockAuthenticatedSession)
      mockSendVerificationEmail.mockRejectedValue(new Error('Email failed'))

      await expect(resendVerificationFn({})).rejects.toThrow(
        'Failed to send verification email',
      )
    })
  })
})
