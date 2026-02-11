/**
 * Stripe Connect OAuth Callback API Route for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 *
 * Security measures:
 * 1. CSRF protection via state cookie validation
 * 2. Session validation - user must still be logged in
 * 3. Team permission validation - user must have EDIT_TEAM_SETTINGS on the team
 * 4. Proper cookie handling on redirect
 *
 * OBSERVABILITY:
 * - All OAuth callback states are logged with request context
 * - Security failures are logged for monitoring
 * - Successful connections are tracked with team and account IDs
 */

import { createFileRoute } from "@tanstack/react-router"
import { deleteCookie, getCookie } from "@tanstack/react-start/server"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getAppUrl } from "@/lib/env"
import {
	addRequestContextAttribute,
	logError,
	logInfo,
	logWarning,
	updateRequestContext,
} from "@/lib/logging"
import { handleOAuthCallback } from "@/server/stripe-connect/accounts"
import {
	parseOAuthState,
	STRIPE_OAUTH_STATE_COOKIE_NAME,
} from "@/server-fns/stripe-connect-fns"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"

export const Route = createFileRoute("/api/stripe/connect/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const appUrl = getAppUrl()

				const url = new URL(request.url)
				const code = url.searchParams.get("code")
				const state = url.searchParams.get("state")
				const error = url.searchParams.get("error")
				const errorDescription = url.searchParams.get("error_description")

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
						attributes: {
							teamSlug: stateData.teamSlug,
							teamId: stateData.teamId,
						},
					})
					const returnUrl = `/compete/organizer/settings/payouts/${stateData.teamSlug}`
					return createRedirect(
						`/sign-in?returnTo=${encodeURIComponent(returnUrl)}&error=session_expired`,
						appUrl,
					)
				}

				// Update request context with user and team info
				updateRequestContext({
					userId: session.userId,
					teamId: stateData.teamId,
				})

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
					logInfo({
						message: "[Stripe OAuth] Processing callback",
						attributes: {
							teamId: stateData.teamId,
							teamSlug: stateData.teamSlug,
						},
					})

					const result = await handleOAuthCallback(code, state)

					// Add connected account info to request context
					addRequestContextAttribute("stripeAccountId", result.accountId)

					logInfo({
						message: "[Stripe OAuth] Account connected successfully",
						attributes: {
							teamId: result.teamId,
							stripeAccountId: result.accountId,
							accountStatus: result.status,
						},
					})

					return createRedirect(
						`/compete/organizer/settings/payouts/${result.teamSlug}?stripe_connected=true`,
						appUrl,
					)
				} catch (err) {
					logError({
						message: "[Stripe OAuth] Callback processing failed",
						error: err,
						attributes: {
							teamSlug: stateData.teamSlug,
							teamId: stateData.teamId,
						},
					})

					return createRedirect(
						`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=connection_failed`,
						appUrl,
					)
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
