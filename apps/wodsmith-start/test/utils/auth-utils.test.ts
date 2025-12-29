import {describe, expect, it} from 'vitest'
import {getResetTokenKey, getVerificationTokenKey} from '@/utils/auth-utils'

describe('auth-utils', () => {
  describe('getResetTokenKey', () => {
    it('generates correct key format for password reset tokens', () => {
      const token = 'abc123'
      const key = getResetTokenKey(token)

      expect(key).toBe('password-reset:abc123')
    })

    it('handles empty token', () => {
      const key = getResetTokenKey('')

      expect(key).toBe('password-reset:')
    })

    it('handles tokens with special characters', () => {
      const token = 'token-with_special.chars'
      const key = getResetTokenKey(token)

      expect(key).toBe('password-reset:token-with_special.chars')
    })

    it('handles long tokens (CUID2 format)', () => {
      // CUID2 tokens are typically 24-32 characters
      const token = 'clh3am8hi0000356o6k8p9qrs'
      const key = getResetTokenKey(token)

      expect(key).toBe('password-reset:clh3am8hi0000356o6k8p9qrs')
    })
  })

  describe('getVerificationTokenKey', () => {
    it('generates correct key format for email verification tokens', () => {
      const token = 'xyz789'
      const key = getVerificationTokenKey(token)

      expect(key).toBe('email-verification:xyz789')
    })

    it('handles empty token', () => {
      const key = getVerificationTokenKey('')

      expect(key).toBe('email-verification:')
    })

    it('handles tokens with special characters', () => {
      const token = 'token-with_special.chars'
      const key = getVerificationTokenKey(token)

      expect(key).toBe('email-verification:token-with_special.chars')
    })

    it('handles long tokens (CUID2 format)', () => {
      const token = 'clh3am8hi0000356o6k8p9qrs'
      const key = getVerificationTokenKey(token)

      expect(key).toBe('email-verification:clh3am8hi0000356o6k8p9qrs')
    })
  })

  describe('key uniqueness', () => {
    it('generates different keys for reset vs verification with same token', () => {
      const token = 'sameToken123'

      const resetKey = getResetTokenKey(token)
      const verificationKey = getVerificationTokenKey(token)

      expect(resetKey).not.toBe(verificationKey)
      expect(resetKey).toBe('password-reset:sameToken123')
      expect(verificationKey).toBe('email-verification:sameToken123')
    })
  })
})
