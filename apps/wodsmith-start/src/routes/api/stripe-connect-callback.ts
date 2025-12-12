import { createFileRoute } from "@tanstack/react-router"
import { handleOAuthCallback } from "~/server/stripe-connect/accounts.server"
import { logError, logInfo } from "~/lib/logging/posthog-otel-logger"

export const Route = createFileRoute("/api/stripe-connect-callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { searchParams } = new URL(request.url)

				const code = searchParams.get("code")
				const state = searchParams.get("state")
				const error = searchParams.get("error")
				const errorDescription = searchParams.get("error_description")

				const appUrl =
					process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

				// Handle OAuth errors
				if (error) {
					logError({
						message: "[Stripe OAuth] Authorization error",
						attributes: { error, errorDescription },
					})
					// Decode state to get team slug for redirect
					try {
						const stateData = JSON.parse(
							Buffer.from(state ?? "", "base64").toString("utf-8"),
						)
						return new Response(null, {
							status: 302,
							headers: {
								Location: `${appUrl}/settings/teams/${stateData.teamSlug}?stripe_error=${encodeURIComponent(error)}`,
							},
						})
					} catch {
						return new Response(null, {
							status: 302,
							headers: {
								Location: `${appUrl}/settings?error=oauth_failed`,
							},
						})
					}
				}

				if (!code || !state) {
					return new Response(null, {
						status: 302,
						headers: {
							Location: `${appUrl}/settings?error=missing_oauth_params`,
						},
					})
				}

				try {
					console.log("[Stripe OAuth] Processing callback with code and state")
					const result = await handleOAuthCallback(code, state)

					logInfo({
						message: "[Stripe OAuth] Successfully connected account",
						attributes: {
							teamId: result.teamId,
							accountId: result.accountId,
						},
					})
					console.log(
						"[Stripe OAuth] Success - redirecting to team page",
						result,
					)

					return new Response(null, {
						status: 302,
						headers: {
							Location: `${appUrl}/settings/teams/${result.teamSlug}?stripe_connected=true`,
						},
					})
				} catch (err) {
					console.error("[Stripe OAuth] Callback failed:", err)
					logError({
						message: "[Stripe OAuth] Callback failed",
						error: err,
					})

					// Try to extract team slug from state for better redirect
					try {
						const stateData = JSON.parse(
							Buffer.from(state, "base64").toString("utf-8"),
						)
						return new Response(null, {
							status: 302,
							headers: {
								Location: `${appUrl}/settings/teams/${stateData.teamSlug}?stripe_error=connection_failed`,
							},
						})
					} catch {
						return new Response(null, {
							status: 302,
							headers: {
								Location: `${appUrl}/settings?error=oauth_exchange_failed`,
							},
						})
					}
				}
			},
		},
	},
})
