/**
 * Stripe Connect OAuth Callback API Route for TanStack Start
 *
 * Security measures:
 * 1. CSRF protection via state cookie validation
 * 2. Session validation - user must still be logged in
 * 3. Team permission validation - user must have EDIT_TEAM_SETTINGS on the team
 * 4. Proper cookie handling on redirect
 */

import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/stripe/connect/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				// Dynamic imports for server-only modules
				const { getCookie, deleteCookie } = await import(
					"@tanstack/react-start/server"
				)
				const { getSessionFromCookie } = await import("@/utils/auth")
				const { hasTeamPermission } = await import("@/utils/team-auth")
				const { TEAM_PERMISSIONS } = await import("@/db/schema")
				const { logError, logInfo, logWarning } = await import(
					"@/lib/logging/posthog-otel-logger"
				)
				const { parseOAuthState, STRIPE_OAUTH_STATE_COOKIE_NAME } =
					await import("@/server-fns/stripe-connect-fns")

				const url = new URL(request.url)
				const code = url.searchParams.get("code")
				const state = url.searchParams.get("state")
				const error = url.searchParams.get("error")
				const errorDescription = url.searchParams.get("error_description")

				const appUrl = process.env.APP_URL || "https://thewodapp.com"

				// Handle OAuth errors from Stripe
				if (error) {
					logError({
						message: "[Stripe OAuth] Authorization error from Stripe",
						attributes: { error, errorDescription },
					})
					// Decode state to get team slug for redirect (if possible)
					try {
						const stateData = parseOAuthState(state ?? "")
						return createRedirect(
							`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=${encodeURIComponent(error)}`,
							appUrl,
						)
					} catch {
						return createRedirect(
							"/compete/organizer?error=oauth_failed",
							appUrl,
						)
					}
				}

				if (!code || !state) {
					logWarning({
						message: "[Stripe OAuth] Missing code or state parameter",
					})
					return createRedirect(
						"/compete/organizer?error=missing_oauth_params",
						appUrl,
					)
				}

				// Parse and validate state parameter
				let stateData: ReturnType<typeof parseOAuthState>
				try {
					stateData = parseOAuthState(state)
				} catch (err) {
					logError({
						message: "[Stripe OAuth] Invalid state parameter",
						error: err,
					})
					return createRedirect(
						"/compete/organizer?error=invalid_state",
						appUrl,
					)
				}

				// Validate CSRF token from cookie
				const csrfCookie = getCookie(STRIPE_OAUTH_STATE_COOKIE_NAME)

				if (!csrfCookie || csrfCookie !== stateData.csrfToken) {
					logError({
						message: "[Stripe OAuth] CSRF token mismatch",
						attributes: {
							hasCookie: !!csrfCookie,
							teamSlug: stateData.teamSlug,
						},
					})
					return createRedirect(
						`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=csrf_mismatch`,
						appUrl,
					)
				}

				// Clear the CSRF cookie (one-time use)
				deleteCookie(STRIPE_OAUTH_STATE_COOKIE_NAME)

				// Validate user session
				const session = await getSessionFromCookie()
				if (!session) {
					logWarning({
						message: "[Stripe OAuth] No valid session found on callback",
						attributes: { teamSlug: stateData.teamSlug },
					})
					const returnUrl = `/compete/organizer/settings/payouts/${stateData.teamSlug}`
					return createRedirect(
						`/sign-in?returnTo=${encodeURIComponent(returnUrl)}&error=session_expired`,
						appUrl,
					)
				}

				// Verify the callback is for the same user who initiated OAuth
				if (session.userId !== stateData.userId) {
					logError({
						message:
							"[Stripe OAuth] User ID mismatch - possible session hijacking attempt",
						attributes: {
							sessionUserId: session.userId,
							stateUserId: stateData.userId,
							teamSlug: stateData.teamSlug,
						},
					})
					return createRedirect(
						`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=unauthorized`,
						appUrl,
					)
				}

				// Verify user still has permission on this team
				const hasPermission = await hasTeamPermission(
					stateData.teamId,
					TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
				)
				if (!hasPermission) {
					logError({
						message: "[Stripe OAuth] User lacks team permission",
						attributes: {
							userId: session.userId,
							teamId: stateData.teamId,
							teamSlug: stateData.teamSlug,
						},
					})
					return createRedirect(
						`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=no_permission`,
						appUrl,
					)
				}

				try {
					console.log("[Stripe OAuth] Processing callback with code and state")
					const result = await handleOAuthCallback(code, state)

					logInfo({
						message: "[Stripe OAuth] Successfully connected account",
						attributes: {
							teamId: result.teamId,
							accountId: result.accountId,
							userId: session.userId,
						},
					})
					console.log(
						"[Stripe OAuth] Success - redirecting to team page",
						result,
					)

					return createRedirect(
						`/compete/organizer/settings/payouts/${result.teamSlug}?stripe_connected=true`,
						appUrl,
					)
				} catch (err) {
					console.error("[Stripe OAuth] Callback failed:", err)
					logError({
						message: "[Stripe OAuth] Callback failed",
						error: err,
						attributes: {
							teamSlug: stateData.teamSlug,
							userId: session.userId,
						},
					})

					return createRedirect(
						`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=connection_failed`,
						appUrl,
					)
				}

				/**
				 * Handle OAuth callback - exchange code for account ID
				 */
				async function handleOAuthCallback(
					code: string,
					state: string,
				): Promise<{
					teamId: string
					teamSlug: string
					accountId: string
					status: "VERIFIED" | "PENDING"
				}> {
					const { getStripe } = await import("@/lib/stripe")
					const { getDb } = await import("@/db")
					const { teamTable } = await import("@/db/schema")
					const { eq } = await import("drizzle-orm")

					const stripe = getStripe()
					const db = getDb()

					// Decode state
					const stateData = parseOAuthState(state)

					// Exchange code for account ID
					const response = await stripe.oauth.token({
						grant_type: "authorization_code",
						code,
					})

					if (!response.stripe_user_id) {
						throw new Error("Failed to get Stripe account ID from OAuth")
					}

					// Get account details to check status
					const account = await stripe.accounts.retrieve(
						response.stripe_user_id,
					)
					const status =
						account.charges_enabled && account.payouts_enabled
							? "VERIFIED"
							: "PENDING"

					console.log("[Stripe OAuth] Account status check:", {
						accountId: response.stripe_user_id,
						chargesEnabled: account.charges_enabled,
						payoutsEnabled: account.payouts_enabled,
						detailsSubmitted: account.details_submitted,
						status,
						teamId: stateData.teamId,
					})

					// Update team
					await db
						.update(teamTable)
						.set({
							stripeConnectedAccountId: response.stripe_user_id,
							stripeAccountStatus: status,
							stripeAccountType: "standard",
							stripeOnboardingCompletedAt:
								status === "VERIFIED" ? new Date() : null,
						})
						.where(eq(teamTable.id, stateData.teamId))

					return {
						teamId: stateData.teamId,
						teamSlug: stateData.teamSlug,
						accountId: response.stripe_user_id,
						status,
					}
				}
			},
		},
	},
})

/**
 * Create a redirect response that properly preserves cookies
 *
 * Using Response with status 307 and Location header instead of redirect()
 * to ensure cookies are properly handled on Cloudflare Workers
 */
function createRedirect(path: string, appUrl: string): Response {
	const url = new URL(path, appUrl)
	return new Response(null, {
		status: 307,
		headers: {
			Location: url.toString(),
		},
	})
}
