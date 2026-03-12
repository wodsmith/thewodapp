import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  type CouponCookieData,
  clearCouponSession,
  getCouponSession,
  onCouponChange,
} from "@/utils/coupon-cookie"

export function CouponBanner() {
  const [coupon, setCoupon] = useState<CouponCookieData | null>(null)

  useEffect(() => {
    setCoupon(getCouponSession())
    return onCouponChange(() => setCoupon(getCouponSession()))
  }, [])

  if (!coupon) return null

  function handleDismiss() {
    clearCouponSession()
    setCoupon(null)
  }

  const discountLabel = `$${(coupon.amountOffCents / 100).toFixed(2)} off`

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg dark:border-emerald-800 dark:bg-emerald-950">
        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1 text-sm text-emerald-800 dark:text-emerald-200">
          <span className="font-semibold">{discountLabel}</span> coupon active
          for{" "}
          <Link
            to="/compete/$slug"
            params={{ slug: coupon.competitionSlug }}
            className="font-medium underline underline-offset-2 hover:text-emerald-900 dark:hover:text-emerald-100"
          >
            {coupon.competitionName}
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:hover:text-emerald-100"
          onClick={handleDismiss}
          aria-label="Dismiss coupon"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
