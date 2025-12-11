import { type NextRequest, NextResponse } from "next/server"
import { handleOAuthCallback } from "@/server/stripe-connect"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"

export async function GET(request: NextRequest) {
	const code = request.nextUrl.searchParams.get("code")
	const state = request.nextUrl.searchParams.get("state")
	const error = request.nextUrl.searchParams.get("error")
	const errorDescription = request.nextUrl.searchParams.get("error_description")

	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

	// Handle OAuth errors
	if (error) {
		logError({
			message: "[Stripe OAuth] Authorization error",
			attributes: { error, errorDescription },
		})
		// Decode state to get team slug for redirect
		try {
			const stateData = JSON.parse(
				Buffer.from(state ?? "", "base64").toString("utf-8")
			)
			return NextResponse.redirect(
				new URL(
					`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=${encodeURIComponent(error)}`,
					appUrl
				)
			)
		} catch {
			return NextResponse.redirect(
				new URL("/compete/organizer?error=oauth_failed", appUrl)
			)
		}
	}

	if (!code || !state) {
		return NextResponse.redirect(
			new URL("/compete/organizer?error=missing_oauth_params", appUrl)
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
			},
		})
		console.log("[Stripe OAuth] Success - redirecting to team page", result)

		return NextResponse.redirect(
			new URL(
				`/compete/organizer/settings/payouts/${result.teamSlug}?stripe_connected=true`,
				appUrl
			)
		)
	} catch (err) {
		console.error("[Stripe OAuth] Callback failed:", err)
		logError({
			message: "[Stripe OAuth] Callback failed",
			error: err,
		})
		
		// Try to extract team slug from state for better redirect
		try {
			const stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
			return NextResponse.redirect(
				new URL(
					`/compete/organizer/settings/payouts/${stateData.teamSlug}?stripe_error=connection_failed`,
					appUrl
				)
			)
		} catch {
			return NextResponse.redirect(
				new URL("/compete/organizer?error=oauth_exchange_failed", appUrl)
			)
		}
	}
}
