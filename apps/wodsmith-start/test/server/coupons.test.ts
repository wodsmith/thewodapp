import {beforeEach, describe, expect, it, vi} from 'vitest'
import {FakeDrizzleDb} from '@repo/test-utils'
import type {ProductCoupon} from '@/db/schema'

// Mock database
const mockDb = new FakeDrizzleDb()
vi.mock('@/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

// Mock logging
vi.mock('@/lib/logging', () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}))

// Mock Stripe
const mockStripeCouponsDel = vi.fn()
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    coupons: {
      del: (...args: unknown[]) => mockStripeCouponsDel(...args),
    },
  })),
}))

import {validateCoupon, recordRedemption, cleanupStripeCoupon} from '@/server/coupons'
import {logInfo, logWarning} from '@/lib/logging'

// Test fixtures
const baseCoupon: ProductCoupon = {
  id: 'coupon-1',
  code: 'SAVE20',
  type: 'competition',
  productId: 'comp-123',
  teamId: 'team-1',
  createdBy: 'user-admin',
  amountOffCents: 2000,
  maxRedemptions: null,
  currentRedemptions: 0,
  expiresAt: null,
  isActive: 1,
  updateCounter: 0,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

describe('server/coupons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockDb.registerTable('productCouponsTable')
  })

  describe('validateCoupon', () => {
    it('returns coupon when valid', async () => {
      mockDb.setMockSingleValue(baseCoupon)

      const result = await validateCoupon('SAVE20', 'comp-123')

      expect(result).toEqual(baseCoupon)
      expect(logInfo).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Coupon validated successfully'}),
      )
    })

    it('returns null when no matching coupon found', async () => {
      mockDb.setMockSingleValue(null)

      const result = await validateCoupon('INVALID', 'comp-123')

      expect(result).toBeNull()
      expect(logInfo).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Coupon validation failed'}),
      )
    })

    it('is case-insensitive (lowercases input)', async () => {
      mockDb.setMockSingleValue(baseCoupon)

      const result = await validateCoupon('save20', 'comp-123')

      expect(result).toEqual(baseCoupon)
    })
  })

  describe('recordRedemption', () => {
    it('inserts redemption record and increments counter', async () => {
      await recordRedemption({
        couponId: 'coupon-1',
        userId: 'user-1',
        purchaseId: 'purchase-1',
        competitionId: 'comp-123',
        amountOffCents: 2000,
        stripeCouponId: 'wod-coupon-1-purchase-1',
      })

      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(mockDb.update).toHaveBeenCalledTimes(1)
      expect(logInfo).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Coupon redemption recorded'}),
      )
    })

    it('handles null purchaseId for free registrations', async () => {
      await recordRedemption({
        couponId: 'coupon-1',
        userId: 'user-1',
        purchaseId: null,
        competitionId: 'comp-123',
        amountOffCents: 5000,
      })

      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(mockDb.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanupStripeCoupon', () => {
    it('deletes the Stripe coupon', async () => {
      mockStripeCouponsDel.mockResolvedValueOnce({deleted: true})

      await cleanupStripeCoupon('wod-coupon-1-purchase-1')

      expect(mockStripeCouponsDel).toHaveBeenCalledWith('wod-coupon-1-purchase-1')
      expect(logInfo).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Stripe coupon cleaned up'}),
      )
    })

    it('logs warning but does not throw on failure', async () => {
      mockStripeCouponsDel.mockRejectedValueOnce(new Error('Stripe error'))

      await expect(
        cleanupStripeCoupon('wod-coupon-1-purchase-1'),
      ).resolves.not.toThrow()

      expect(logWarning).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Failed to cleanup Stripe coupon'}),
      )
    })
  })
})
