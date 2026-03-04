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

// Mock entitlements
const mockHasFeature = vi.fn()
vi.mock('@/server/entitlements', () => ({
  hasFeature: (...args: unknown[]) => mockHasFeature(...args),
}))

// Mock coupon validation
const mockValidateCoupon = vi.fn()
vi.mock('@/server/coupons', () => ({
  validateCoupon: (...args: unknown[]) => mockValidateCoupon(...args),
}))

// Mock auth
const mockRequireVerifiedEmail = vi.fn()
vi.mock('@/utils/auth', () => ({
  requireVerifiedEmail: () => mockRequireVerifiedEmail(),
}))

// Mock TanStack createServerFn
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: any) => fn,
    inputValidator: () => ({
      handler: (fn: any) => fn,
    }),
  }),
  createServerOnlyFn: (fn: any) => fn,
}))

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  env: {APP_URL: 'https://test.wodsmith.com'},
}))

import {
  createCouponFn,
  listCouponsFn,
  getCouponByCodeFn,
  deactivateCouponFn,
  validateCouponForCheckoutFn,
} from '@/server-fns/coupon-fns'

// Cast server functions to callable form
const createCoupon = createCouponFn as unknown as (args: {data: any}) => Promise<any>
const listCoupons = listCouponsFn as unknown as (args: {data: any}) => Promise<any>
const getCouponByCode = getCouponByCodeFn as unknown as (args: {data: any}) => Promise<any>
const deactivateCoupon = deactivateCouponFn as unknown as (args: {data: any}) => Promise<any>
const validateCouponForCheckout = validateCouponForCheckoutFn as unknown as (args: {data: any}) => Promise<any>

// Fixtures
const adminSession = {
  userId: 'user-admin',
  user: {id: 'user-admin', email: 'admin@test.com'},
  teams: [{id: 'team-1', role: {id: 'admin'}}],
}

const ownerSession = {
  userId: 'user-owner',
  user: {id: 'user-owner', email: 'owner@test.com'},
  teams: [{id: 'team-1', role: {id: 'owner'}}],
}

const memberSession = {
  userId: 'user-member',
  user: {id: 'user-member', email: 'member@test.com'},
  teams: [{id: 'team-1', role: {id: 'member'}}],
}

const regularSession = {
  userId: 'user-regular',
  user: {id: 'user-regular', email: 'user@test.com'},
  teams: [],
}

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
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

describe('coupon-fns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.reset()
    mockDb.registerTable('productCouponsTable')
    mockDb.registerTable('competitionsTable')
    mockRequireVerifiedEmail.mockResolvedValue(adminSession)
    mockHasFeature.mockResolvedValue(true)
  })

  describe('createCouponFn', () => {
    it('creates a coupon when admin with entitlement', async () => {
      // Competition exists and belongs to team
      mockDb.queueMockSingleValues([
        {id: 'comp-123', organizingTeamId: 'team-1'}, // competition lookup
        baseCoupon, // created coupon return
      ])

      const result = await createCoupon({
        data: {
          competitionId: 'comp-123',
          teamId: 'team-1',
          amountOffCents: 2000,
          code: 'SAVE20',
        },
      })

      expect(result).toEqual(baseCoupon)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('allows owner role to create coupons', async () => {
      mockRequireVerifiedEmail.mockResolvedValue(ownerSession)
      mockDb.queueMockSingleValues([
        {id: 'comp-123', organizingTeamId: 'team-1'},
        baseCoupon,
      ])

      const result = await createCoupon({
        data: {
          competitionId: 'comp-123',
          teamId: 'team-1',
          amountOffCents: 2000,
        },
      })

      expect(result).toEqual(baseCoupon)
    })

    it('rejects non-admin/owner users', async () => {
      mockRequireVerifiedEmail.mockResolvedValue(memberSession)

      await expect(
        createCoupon({
          data: {
            competitionId: 'comp-123',
            teamId: 'team-1',
            amountOffCents: 2000,
          },
        }),
      ).rejects.toThrow('Unauthorized')
    })

    it('rejects when team lacks PRODUCT_COUPONS entitlement', async () => {
      mockHasFeature.mockResolvedValue(false)

      await expect(
        createCoupon({
          data: {
            competitionId: 'comp-123',
            teamId: 'team-1',
            amountOffCents: 2000,
          },
        }),
      ).rejects.toThrow('product coupons feature')
    })

    it('rejects when competition not found or wrong team', async () => {
      mockDb.setMockSingleValue(null) // no competition

      await expect(
        createCoupon({
          data: {
            competitionId: 'comp-nonexistent',
            teamId: 'team-1',
            amountOffCents: 2000,
          },
        }),
      ).rejects.toThrow('Competition not found')
    })
  })

  describe('listCouponsFn', () => {
    it('returns coupons for admin', async () => {
      const coupons = [baseCoupon, {...baseCoupon, id: 'coupon-2', code: 'SAVE50'}]
      mockDb.setMockReturnValue(coupons)
      mockDb.registerTable('productCouponsTable')
      mockDb.query.productCouponsTable!.findMany.mockResolvedValueOnce(coupons)

      const result = await listCoupons({
        data: {competitionId: 'comp-123', teamId: 'team-1'},
      })

      expect(result).toEqual(coupons)
    })

    it('rejects non-admin users', async () => {
      mockRequireVerifiedEmail.mockResolvedValue(memberSession)

      await expect(
        listCoupons({
          data: {competitionId: 'comp-123', teamId: 'team-1'},
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('getCouponByCodeFn', () => {
    it('returns coupon with competition info when valid', async () => {
      const competition = {id: 'comp-123', name: 'Test Comp'}
      mockDb.queueMockSingleValues([baseCoupon, competition])

      const result = await getCouponByCode({data: {code: 'SAVE20'}})

      expect(result).toEqual({
        coupon: baseCoupon,
        competition,
        invalid: false,
        reason: null,
      })
    })

    it('returns null when coupon not found', async () => {
      mockDb.setMockSingleValue(null)

      const result = await getCouponByCode({data: {code: 'NOPE'}})

      expect(result).toBeNull()
    })

    it('returns invalid when coupon is inactive', async () => {
      mockDb.setMockSingleValue({...baseCoupon, isActive: 0})

      const result = await getCouponByCode({data: {code: 'SAVE20'}})

      expect(result?.invalid).toBe(true)
      expect(result?.reason).toContain('no longer active')
    })

    it('returns invalid when coupon is expired', async () => {
      mockDb.setMockSingleValue({
        ...baseCoupon,
        expiresAt: new Date('2020-01-01'),
      })

      const result = await getCouponByCode({data: {code: 'SAVE20'}})

      expect(result?.invalid).toBe(true)
      expect(result?.reason).toContain('expired')
    })

    it('returns invalid when max redemptions reached', async () => {
      mockDb.setMockSingleValue({
        ...baseCoupon,
        maxRedemptions: 10,
        currentRedemptions: 10,
      })

      const result = await getCouponByCode({data: {code: 'SAVE20'}})

      expect(result?.invalid).toBe(true)
      expect(result?.reason).toContain('maximum number of uses')
    })

    it('valid when under max redemptions', async () => {
      const competition = {id: 'comp-123', name: 'Test Comp'}
      mockDb.queueMockSingleValues([
        {...baseCoupon, maxRedemptions: 10, currentRedemptions: 9},
        competition,
      ])

      const result = await getCouponByCode({data: {code: 'SAVE20'}})

      expect(result?.invalid).toBe(false)
    })
  })

  describe('deactivateCouponFn', () => {
    it('deactivates a coupon that belongs to the team', async () => {
      mockDb.setMockSingleValue(baseCoupon)

      const result = await deactivateCoupon({
        data: {couponId: 'coupon-1', teamId: 'team-1'},
      })

      expect(result).toEqual({success: true})
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('rejects when coupon not found for team', async () => {
      mockDb.setMockSingleValue(null)

      await expect(
        deactivateCoupon({
          data: {couponId: 'coupon-nope', teamId: 'team-1'},
        }),
      ).rejects.toThrow('Coupon not found')
    })

    it('rejects non-admin users', async () => {
      mockRequireVerifiedEmail.mockResolvedValue(memberSession)

      await expect(
        deactivateCoupon({
          data: {couponId: 'coupon-1', teamId: 'team-1'},
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('validateCouponForCheckoutFn', () => {
    it('returns valid with coupon details when coupon is valid', async () => {
      mockValidateCoupon.mockResolvedValueOnce(baseCoupon)

      const result = await validateCouponForCheckout({
        data: {code: 'SAVE20', competitionId: 'comp-123'},
      })

      expect(result).toEqual({
        valid: true,
        coupon: baseCoupon,
        amountOffCents: 2000,
      })
    })

    it('returns invalid when coupon validation fails', async () => {
      mockValidateCoupon.mockResolvedValueOnce(null)

      const result = await validateCouponForCheckout({
        data: {code: 'INVALID', competitionId: 'comp-123'},
      })

      expect(result).toEqual({
        valid: false,
        coupon: null,
        amountOffCents: 0,
      })
    })
  })
})
