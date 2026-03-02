const COUPON_COOKIE_NAME = "wod_coupon"
const COOKIE_EXPIRY_DAYS = 7

export interface CouponCookieData {
	code: string
	competitionSlug: string
	amountOffCents: number
	competitionName: string
}

export async function setCouponCookie(data: CouponCookieData): Promise<void> {
	const value = encodeURIComponent(JSON.stringify(data))
	const expires = new Date()
	expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS)

	if ("cookieStore" in window) {
		await cookieStore.set({
			name: COUPON_COOKIE_NAME,
			value,
			expires: expires.getTime(),
			path: "/",
			sameSite: "lax",
		})
	} else {
		// biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without Cookie Store API
		document.cookie = `${COUPON_COOKIE_NAME}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
	}
}

export async function getCouponCookie(): Promise<CouponCookieData | null> {
	try {
		let value: string | undefined

		if ("cookieStore" in window) {
			const cookie = await cookieStore.get(COUPON_COOKIE_NAME)
			value = cookie?.value
		} else {
			const cookies = document.cookie.split(";")
			for (const cookie of cookies) {
				const [name, ...rest] = cookie.trim().split("=")
				if (name === COUPON_COOKIE_NAME) {
					value = rest.join("=")
					break
				}
			}
		}

		if (!value) return null
		return JSON.parse(decodeURIComponent(value)) as CouponCookieData
	} catch {
		return null
	}
}

export async function clearCouponCookie(): Promise<void> {
	if ("cookieStore" in window) {
		await cookieStore.delete({ name: COUPON_COOKIE_NAME, path: "/" })
	} else {
		// biome-ignore lint/suspicious/noDocumentCookie: fallback for browsers without Cookie Store API
		document.cookie = `${COUPON_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`
	}
}
