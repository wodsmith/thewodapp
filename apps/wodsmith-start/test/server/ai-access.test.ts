/**
 * AI Access Control Unit Tests
 *
 * Tests the ensureAiAccess function and helper utilities
 * for checking AI feature entitlements.
 */
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {FEATURES} from '@/config/features'

// Mock the entitlements module
vi.mock('@/server/entitlements', () => ({
  hasFeature: vi.fn(),
}))

import {hasFeature} from '@/server/entitlements'
import {
  ensureAiAccess,
  createAiAccessDeniedResponse,
  type AiAccessCheck,
} from '@/server/ai-access'

describe('AI Access Control', () => {
  const mockTeamId = 'team-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureAiAccess', () => {
    describe('when team has AI_PROGRAMMING_ASSISTANT feature', () => {
      it('should return allowed: true', async () => {
        // ARRANGE
        vi.mocked(hasFeature).mockResolvedValue(true)

        // ACT
        const result = await ensureAiAccess(mockTeamId)

        // ASSERT
        expect(result).toEqual({allowed: true})
        expect(hasFeature).toHaveBeenCalledWith(
          mockTeamId,
          FEATURES.AI_PROGRAMMING_ASSISTANT,
        )
      })
    })

    describe('when team lacks AI_PROGRAMMING_ASSISTANT feature', () => {
      it('should return allowed: false with error details', async () => {
        // ARRANGE
        vi.mocked(hasFeature).mockResolvedValue(false)

        // ACT
        const result = await ensureAiAccess(mockTeamId)

        // ASSERT
        expect(result).toEqual({
          allowed: false,
          error: 'AI assistant is not available on your current plan',
          status: 403,
        })
        expect(hasFeature).toHaveBeenCalledWith(
          mockTeamId,
          FEATURES.AI_PROGRAMMING_ASSISTANT,
        )
      })
    })

    describe('type narrowing', () => {
      it('should allow type-safe access after checking allowed', async () => {
        // ARRANGE
        vi.mocked(hasFeature).mockResolvedValue(false)

        // ACT
        const result = await ensureAiAccess(mockTeamId)

        // ASSERT - TypeScript should narrow the type based on allowed check
        if (!result.allowed) {
          expect(result.error).toBe(
            'AI assistant is not available on your current plan',
          )
          expect(result.status).toBe(403)
        }
      })
    })
  })

  describe('createAiAccessDeniedResponse', () => {
    it('should create a 403 JSON response with error message', async () => {
      // ARRANGE
      const deniedResult: AiAccessCheck = {
        allowed: false,
        error: 'AI assistant is not available on your current plan',
        status: 403,
      }

      // ACT
      const response = createAiAccessDeniedResponse(deniedResult)

      // ASSERT
      expect(response.status).toBe(403)
      expect(response.headers.get('Content-Type')).toBe('application/json')

      const body = await response.json()
      expect(body).toEqual({
        error: 'AI assistant is not available on your current plan',
      })
    })

    it('should preserve custom error messages', async () => {
      // ARRANGE
      const deniedResult: AiAccessCheck = {
        allowed: false,
        error: 'Custom error message',
        status: 403,
      }

      // ACT
      const response = createAiAccessDeniedResponse(deniedResult)

      // ASSERT
      const body = (await response.json()) as { error: string }
      expect(body.error).toBe('Custom error message')
    })
  })

  describe('integration pattern', () => {
    it('should support the standard API route pattern', async () => {
      // ARRANGE - Simulate the pattern used in API routes
      vi.mocked(hasFeature).mockResolvedValue(false)

      // ACT - This is the pattern used in routes
      const aiAccess = await ensureAiAccess(mockTeamId)

      // ASSERT - Pattern should work correctly
      if (!aiAccess.allowed) {
        const response = createAiAccessDeniedResponse(aiAccess)
        expect(response.status).toBe(403)

        const body = (await response.json()) as { error: string }
        expect(body.error).toBeDefined()
      } else {
        // If allowed, we should be able to proceed
        expect(aiAccess.allowed).toBe(true)
      }
    })

    it('should allow proceeding when access is granted', async () => {
      // ARRANGE
      vi.mocked(hasFeature).mockResolvedValue(true)

      // ACT
      const aiAccess = await ensureAiAccess(mockTeamId)

      // ASSERT - Should be able to proceed without creating error response
      expect(aiAccess.allowed).toBe(true)
      if (aiAccess.allowed) {
        // TypeScript narrows to AiAccessResult here
        // We can proceed with the AI operation
        expect(true).toBe(true) // Placeholder for actual AI operation
      }
    })
  })
})
