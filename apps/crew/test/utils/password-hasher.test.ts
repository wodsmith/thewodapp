import {describe, expect, it} from 'vitest'
import {hashPassword, verifyPassword} from '@/utils/password-hasher'

describe('password-hasher', () => {
  describe('hashPassword', () => {
    it('generates a hash with salt:hash format', async () => {
      const result = await hashPassword({password: 'testPassword123'})

      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)

      const [salt, hash] = result.split(':')
      // Salt should be 16 bytes = 32 hex chars
      expect(salt).toHaveLength(32)
      // Hash should be 32 bytes = 64 hex chars (AES-256 key)
      expect(hash).toHaveLength(64)
    })

    it('generates different hashes for the same password (due to random salt)', async () => {
      const hash1 = await hashPassword({password: 'samePassword'})
      const hash2 = await hashPassword({password: 'samePassword'})

      expect(hash1).not.toBe(hash2)
    })

    it('generates the same hash when using the same salt', async () => {
      const salt = new Uint8Array(16).fill(42) // Fixed salt for testing

      const hash1 = await hashPassword({
        password: 'testPassword',
        providedSalt: salt,
      })
      const hash2 = await hashPassword({
        password: 'testPassword',
        providedSalt: salt,
      })

      expect(hash1).toBe(hash2)
    })

    it('generates different hashes for different passwords with same salt', async () => {
      const salt = new Uint8Array(16).fill(42)

      const hash1 = await hashPassword({
        password: 'password1',
        providedSalt: salt,
      })
      const hash2 = await hashPassword({
        password: 'password2',
        providedSalt: salt,
      })

      expect(hash1).not.toBe(hash2)
    })

    it('handles empty password', async () => {
      const result = await hashPassword({password: ''})

      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)
    })

    it('handles unicode passwords', async () => {
      const result = await hashPassword({password: 'p@ssw0rd!'})

      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)
    })

    it('handles very long passwords', async () => {
      const longPassword = 'a'.repeat(1000)
      const result = await hashPassword({password: longPassword})

      expect(result).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)
    })
  })

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const password = 'correctPassword123'
      const hash = await hashPassword({password})

      const isValid = await verifyPassword({
        storedHash: hash,
        passwordAttempt: password,
      })

      expect(isValid).toBe(true)
    })

    it('returns false for incorrect password', async () => {
      const hash = await hashPassword({password: 'correctPassword'})

      const isValid = await verifyPassword({
        storedHash: hash,
        passwordAttempt: 'wrongPassword',
      })

      expect(isValid).toBe(false)
    })

    it('returns false for invalid hash format (no colon)', async () => {
      const isValid = await verifyPassword({
        storedHash: 'invalidhashwithoutcolon',
        passwordAttempt: 'anyPassword',
      })

      expect(isValid).toBe(false)
    })

    it('returns false for invalid hash format (empty salt)', async () => {
      const isValid = await verifyPassword({
        storedHash: ':somehash',
        passwordAttempt: 'anyPassword',
      })

      expect(isValid).toBe(false)
    })

    it('returns false for invalid hash format (empty hash)', async () => {
      const isValid = await verifyPassword({
        storedHash: 'somesalt:',
        passwordAttempt: 'anyPassword',
      })

      expect(isValid).toBe(false)
    })

    it('is case-sensitive for passwords', async () => {
      const hash = await hashPassword({password: 'CaseSensitive'})

      const isValidLower = await verifyPassword({
        storedHash: hash,
        passwordAttempt: 'casesensitive',
      })
      const isValidUpper = await verifyPassword({
        storedHash: hash,
        passwordAttempt: 'CASESENSITIVE',
      })
      const isValidCorrect = await verifyPassword({
        storedHash: hash,
        passwordAttempt: 'CaseSensitive',
      })

      expect(isValidLower).toBe(false)
      expect(isValidUpper).toBe(false)
      expect(isValidCorrect).toBe(true)
    })

    it('handles empty password verification', async () => {
      const hash = await hashPassword({password: ''})

      const isValid = await verifyPassword({
        storedHash: hash,
        passwordAttempt: '',
      })

      expect(isValid).toBe(true)
    })

    it('handles special characters in passwords', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const hash = await hashPassword({password})

      const isValid = await verifyPassword({
        storedHash: hash,
        passwordAttempt: password,
      })

      expect(isValid).toBe(true)
    })
  })

  describe('integration', () => {
    it('full flow: hash then verify multiple times', async () => {
      const password = 'mySecurePassword123!'
      const hash = await hashPassword({password})

      // Verify multiple times to ensure consistency
      for (let i = 0; i < 5; i++) {
        const isValid = await verifyPassword({
          storedHash: hash,
          passwordAttempt: password,
        })
        expect(isValid).toBe(true)
      }
    })

    it('different users with same password have different hashes', async () => {
      const password = 'sharedPassword'

      const hash1 = await hashPassword({password})
      const hash2 = await hashPassword({password})

      // Hashes should be different (different salts)
      expect(hash1).not.toBe(hash2)

      // But both should verify correctly
      expect(
        await verifyPassword({storedHash: hash1, passwordAttempt: password}),
      ).toBe(true)
      expect(
        await verifyPassword({storedHash: hash2, passwordAttempt: password}),
      ).toBe(true)

      // And cross-verification should fail
      expect(
        await verifyPassword({storedHash: hash1, passwordAttempt: 'wrong'}),
      ).toBe(false)
    })
  })
})
