import {type MockInstance, afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {CouponCookieData} from '@/utils/coupon-cookie'

import {
  setCouponSession,
  getCouponSession,
  clearCouponSession,
  onCouponChange,
} from '@/utils/coupon-cookie'

const testCoupon: CouponCookieData = {
  code: 'SAVE20',
  competitionSlug: 'winter-throwdown',
  amountOffCents: 2000,
  competitionName: 'Winter Throwdown 2025',
}

describe('coupon-cookie', () => {
  let dispatchEventSpy: MockInstance
  let addEventListenerSpy: MockInstance
  let removeEventListenerSpy: MockInstance

  beforeEach(() => {
    sessionStorage.clear()
    dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setCouponSession', () => {
    it('stores coupon data in sessionStorage', () => {
      setCouponSession(testCoupon)

      const stored = sessionStorage.getItem('wod_coupon')
      expect(stored).toBe(JSON.stringify(testCoupon))
    })

    it('dispatches change event', () => {
      setCouponSession(testCoupon)

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({type: 'wod_coupon_changed'}),
      )
    })
  })

  describe('getCouponSession', () => {
    it('returns parsed coupon data', () => {
      sessionStorage.setItem('wod_coupon', JSON.stringify(testCoupon))

      const result = getCouponSession()

      expect(result).toEqual(testCoupon)
    })

    it('returns null when no data stored', () => {
      const result = getCouponSession()

      expect(result).toBeNull()
    })

    it('returns null on parse error', () => {
      sessionStorage.setItem('wod_coupon', 'invalid json{{{')

      const result = getCouponSession()

      expect(result).toBeNull()
    })
  })

  describe('clearCouponSession', () => {
    it('removes coupon from sessionStorage', () => {
      sessionStorage.setItem('wod_coupon', JSON.stringify(testCoupon))

      clearCouponSession()

      expect(sessionStorage.getItem('wod_coupon')).toBeNull()
    })

    it('dispatches change event', () => {
      clearCouponSession()

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({type: 'wod_coupon_changed'}),
      )
    })
  })

  describe('onCouponChange', () => {
    it('registers an event listener', () => {
      const callback = vi.fn()

      onCouponChange(callback)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'wod_coupon_changed',
        callback,
      )
    })

    it('returns cleanup function that removes listener', () => {
      const callback = vi.fn()

      const cleanup = onCouponChange(callback)
      cleanup()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'wod_coupon_changed',
        callback,
      )
    })
  })
})
