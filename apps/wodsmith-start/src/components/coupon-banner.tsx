import { useEffect, useState } from "react"
import { Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	type CouponCookieData,
	clearCouponCookie,
	getCouponCookie,
} from "@/utils/coupon-cookie"

export function CouponBanner() {
	const [coupon, setCoupon] = useState<CouponCookieData | null>(null)

	useEffect(() => {
		getCouponCookie().then(setCoupon)
	}, [])

	if (!coupon) return null

	function handleDismiss() {
		clearCouponCookie()
		setCoupon(null)
	}

	const discountLabel = `$${(coupon.amountOffCents / 100).toFixed(2)} off`

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
			<div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
				<div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
					<Tag className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
					<span>
						<span className="font-semibold">{discountLabel}</span> coupon
						applied for{" "}
						<a
							href={`/compete/${coupon.competitionSlug}`}
							className="underline underline-offset-2 hover:text-emerald-900 dark:hover:text-emerald-100"
						>
							{coupon.competitionName}
						</a>{" "}
						— applied automatically at checkout
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 shrink-0 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:hover:text-emerald-100"
					onClick={handleDismiss}
					aria-label="Dismiss coupon banner"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
