import { generateCodeVerifier, generateState } from "arctic"
import { createFileRoute } from "@tanstack/react-router"
import { getCookie, setCookie } from "vinxi/http"
import {
	GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
	GOOGLE_OAUTH_STATE_COOKIE_NAME,
	REDIRECT_AFTER_SIGN_IN,
} from "@/constants"
import { getGoogleSSOClient, isGoogleSSOEnabled } from "@/lib/sso/google-sso"
import { getSessionFromCookie } from "@/utils/auth.server"
import isProd from "@/utils/is-prod"

const getCookieOptions = () => ({
	path: "/" as const,
	httpOnly: true,
	secure: isProd,
	maxAge: 60 * 10, // 10 minutes in seconds
	sameSite: "lax" as const,
})

export const Route = createFileRoute("/sso/google")({
	server: {
		handlers: {
			GET: async () => {
				try {
					// Check if user is already authenticated
					const session = await getSessionFromCookie()
					if (session) {
						return new Response(null, {
							status: 302,
							headers: { Location: REDIRECT_AFTER_SIGN_IN },
						})
					}

					// Check if Google SSO is enabled
					if (!isGoogleSSOEnabled()) {
						console.error("Google SSO is not enabled - missing credentials")
						return new Response("Google SSO is not available", {
							status: 503,
						})
					}

					// Generate OAuth state and code verifier
					const state = generateState()
					const codeVerifier = generateCodeVerifier()

					// Get the Google client
					const google = getGoogleSSOClient()

					// Create the authorization URL
					const authUrl = google.createAuthorizationURL(state, codeVerifier, [
						"openid",
						"profile",
						"email",
					])

					const cookieOptions = getCookieOptions()

					// Set cookies for state and code verifier
					setCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, cookieOptions)
					setCookie(
						GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
						codeVerifier,
						cookieOptions,
					)

					// Redirect to Google OAuth
					return new Response(null, {
						status: 307,
						headers: {
							Location: authUrl.toString(),
						},
					})
				} catch (error) {
					console.error("Error initiating Google OAuth:", error)
					return new Response("Failed to initiate Google Sign In", {
						status: 500,
					})
				}
			},
		},
	},
})
