import { createFileRoute } from "@tanstack/react-router"
import { handleGoogleOAuthCallback } from "@/server-functions/google-sso"
import { REDIRECT_AFTER_SIGN_IN, SITE_URL } from "@/constants"
import { getSessionFromCookie } from "@/utils/auth.server"

export const Route = createFileRoute("/sso/google/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					const { searchParams } = new URL(request.url)
					const code = searchParams.get("code")
					const state = searchParams.get("state")
					const error = searchParams.get("error")

					// If user is already authenticated, redirect to dashboard
					const session = await getSessionFromCookie()
					if (session) {
						return new Response(null, {
							status: 302,
							headers: { Location: REDIRECT_AFTER_SIGN_IN },
						})
					}

					// Check for error from Google
					if (error) {
						console.error("Google OAuth error:", error)
						return new Response(null, {
							status: 302,
							headers: {
								Location: `/sign-in?error=${encodeURIComponent(error)}`,
							},
						})
					}

					// Validate required parameters
					if (!code || !state) {
						console.error("Google OAuth: Missing code or state")
						return new Response(null, {
							status: 302,
							headers: {
								Location: "/sign-in?error=missing_oauth_params",
							},
						})
					}

					// Handle the OAuth callback
					const result = await handleGoogleOAuthCallback(code, state)

					if (!result.success) {
						console.error("Google OAuth callback failed:", result.error)
						return new Response(null, {
							status: 302,
							headers: {
								Location: `/sign-in?error=${encodeURIComponent(result.error || "authentication_failed")}`,
							},
						})
					}

					// Successful login - redirect to dashboard
					return new Response(null, {
						status: 302,
						headers: { Location: REDIRECT_AFTER_SIGN_IN },
					})
				} catch (error) {
					console.error("Google OAuth callback handler error:", error)
					return new Response(null, {
						status: 302,
						headers: { Location: "/sign-in?error=server_error" },
					})
				}
			},
		},
	},
})
