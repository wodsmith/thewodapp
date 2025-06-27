import { generateCodeVerifier, generateState } from "arctic"
import ms from "ms"
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
	GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
	GOOGLE_OAUTH_STATE_COOKIE_NAME,
	REDIRECT_AFTER_SIGN_IN,
} from "@/constants"
import { isGoogleSSOEnabled } from "@/flags"
import { getGoogleSSOClient } from "@/lib/sso/google-sso"
import { getSessionFromCookie } from "@/utils/auth"
import isProd from "@/utils/is-prod"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

const cookieOptions: Partial<ResponseCookie> = {
	path: "/",
	httpOnly: true,
	secure: isProd,
	maxAge: Math.floor(ms("10 minutes") / 1000),
	sameSite: "lax",
}

export async function GET() {
	return withRateLimit(async () => {
		if (!(await isGoogleSSOEnabled())) {
			console.error("Google client ID or secret is not set")
			return redirect("/")
		}

		const session = await getSessionFromCookie()

		if (session) {
			return redirect(REDIRECT_AFTER_SIGN_IN)
		}

		let ssoRedirectUrl: null | URL = null

		try {
			const state = generateState()
			const codeVerifier = generateCodeVerifier()

			const google = getGoogleSSOClient()

			ssoRedirectUrl = google.createAuthorizationURL(state, codeVerifier, [
				"openid",
				"profile",
				"email",
			])

			const cookieStore = await cookies()
			cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, cookieOptions)
			cookieStore.set(
				GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
				codeVerifier,
				cookieOptions,
			)
		} catch (error) {
			console.error(
				"Error generating Google OAuth state and code verifier",
				error,
			)
			return redirect("/")
		}

		return new Response(null, {
			status: 307,
			headers: {
				Location: ssoRedirectUrl.toString(),
			},
		})
	}, RATE_LIMITS.GOOGLE_SSO_REQUEST)
}
