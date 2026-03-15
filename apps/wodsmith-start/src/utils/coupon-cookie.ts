const STORAGE_KEY = "wod_coupon"
const COUPON_CHANGED_EVENT = "wod_coupon_changed"

export interface CouponCookieData {
  code: string
  competitionSlug: string
  amountOffCents: number
  competitionName: string
}

export function setCouponSession(data: CouponCookieData): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    window.dispatchEvent(new Event(COUPON_CHANGED_EVENT))
  } catch {
    // sessionStorage unavailable (SSR, private browsing edge cases)
  }
}

export function getCouponSession(): CouponCookieData | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    if (!value) return null
    return JSON.parse(value) as CouponCookieData
  } catch {
    return null
  }
}

export function clearCouponSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event(COUPON_CHANGED_EVENT))
  } catch {
    // noop
  }
}

export function onCouponChange(callback: () => void): () => void {
  window.addEventListener(COUPON_CHANGED_EVENT, callback)
  return () => window.removeEventListener(COUPON_CHANGED_EVENT, callback)
}
