/**
 * Stripe Connect Account Management for TanStack Start
 * Handles Express and Standard account onboarding, OAuth flow, and account status sync.
 *
 * All functions use createServerOnlyFn to enforce server-only execution.
 */

import { createServerOnlyFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { getDb } from "@/db"
import { teamTable } from "@/db/schema"
import { getAppUrl, getStripeClientId } from "@/lib/env"
import { getStripe } from "@/lib/stripe"

/**
 * OAuth state payload structure for Stripe Connect
 * Contains all necessary data for secure callback validation
 */
export interface StripeOAuthState {
	teamId: string
	teamSlug: string
	userId: string
	csrfToken: string
}

/**
 * Balance amounts by currency
 */
export interface BalanceAmount {
	currency: string
	amount: number
}

/**
 * Connected account balance summary
 */
export interface AccountBalance {
	available: BalanceAmount[]
	pending: BalanceAmount[]
}

/**
 * Create an Express connected account for a team
 */
export const createExpressAccount = createServerOnlyFn(
	async (
		teamId: string,
		email: string,
		teamName: string,
	): Promise<{ accountId: string; onboardingUrl: string }> => {
		const db = getDb()
		const stripe = getStripe()

		// Create Express account
		const account = await stripe.accounts.create({
			type: "express",
			country: "US",
			email,
			capabilities: {
				transfers: { requested: true },
			},
			business_type: "individual",
			metadata: {
				teamId,
				teamName,
			},
		})

		// Save to database
		await db
			.update(teamTable)
			.set({
				stripeConnectedAccountId: account.id,
				stripeAccountStatus: "PENDING",
				stripeAccountType: "express",
			})
			.where(eq(teamTable.id, teamId))

		// Create onboarding link
		const accountLink = await createExpressAccountLink(account.id, teamId)

		return {
			accountId: account.id,
			onboardingUrl: accountLink.url,
		}
	},
)

/**
 * Create/refresh an Express account onboarding link
 */
export const createExpressAccountLink = createServerOnlyFn(
	async (accountId: string, teamId: string): Promise<{ url: string }> => {
		const stripe = getStripe()
		const db = getDb()

		// Get team slug for return URLs
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
			columns: { slug: true },
		})

		if (!team) {
			throw new Error("Team not found")
		}

		const appUrl = getAppUrl()
		const accountLink = await stripe.accountLinks.create({
			account: accountId,
			refresh_url: `${appUrl}/compete/organizer/settings/payouts/${team.slug}?stripe_refresh=true`,
			return_url: `${appUrl}/compete/organizer/settings/payouts/${team.slug}?stripe_connected=true`,
			type: "account_onboarding",
		})

		return { url: accountLink.url }
	},
)

/**
 * Parse and validate the OAuth state parameter
 * Returns the decoded state payload
 */
export const parseOAuthState = createServerOnlyFn(
	(state: string): StripeOAuthState => {
		try {
			const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
			// Validate required fields
			if (
				!decoded.teamId ||
				!decoded.teamSlug ||
				!decoded.userId ||
				!decoded.csrfToken
			) {
				throw new Error("Missing required fields in OAuth state")
			}
			return decoded as StripeOAuthState
		} catch {
			throw new Error("Invalid OAuth state")
		}
	},
)

/**
 * Get OAuth authorization URL for Standard account connection
 *
 * @param teamId - The team ID to connect the Stripe account to
 * @param teamSlug - The team slug for redirect URL
 * @param userId - The authenticated user's ID (for callback validation)
 * @param csrfToken - CSRF token stored in cookie (for callback validation)
 */
export const getOAuthAuthorizeUrl = createServerOnlyFn(
	(
		teamId: string,
		teamSlug: string,
		userId: string,
		csrfToken: string,
	): string => {
		const clientId = getStripeClientId()
		if (!clientId) {
			throw new Error("STRIPE_CLIENT_ID environment variable not configured")
		}

		const statePayload: StripeOAuthState = {
			teamId,
			teamSlug,
			userId,
			csrfToken,
		}
		const state = Buffer.from(JSON.stringify(statePayload)).toString("base64")
		const appUrl = getAppUrl()
		const redirectUri = `${appUrl}/api/stripe/connect/callback`

		const params = new URLSearchParams({
			client_id: clientId,
			state,
			scope: "read_write",
			response_type: "code",
			redirect_uri: redirectUri,
		})

		return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
	},
)

/**
 * Handle OAuth callback - exchange code for account ID
 *
 * @param code - The authorization code from Stripe
 * @param state - The state parameter containing teamId, teamSlug, userId, csrfToken
 * @returns Object with teamId, teamSlug, accountId, and status
 */
export const handleOAuthCallback = createServerOnlyFn(
	async (
		code: string,
		state: string,
	): Promise<{
		teamId: string
		teamSlug: string
		accountId: string
		status: "VERIFIED" | "PENDING"
	}> => {
		const stripe = getStripe()
		const db = getDb()

		// Decode state - now includes userId and csrfToken for security
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
		const account = await stripe.accounts.retrieve(response.stripe_user_id)
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
				stripeOnboardingCompletedAt: status === "VERIFIED" ? new Date() : null,
			})
			.where(eq(teamTable.id, stateData.teamId))

		return {
			teamId: stateData.teamId,
			teamSlug: stateData.teamSlug,
			accountId: response.stripe_user_id,
			status,
		}
	},
)

/**
 * Get current account status from Stripe API
 */
export const getAccountStatus = createServerOnlyFn(
	async (
		accountId: string,
	): Promise<{
		chargesEnabled: boolean
		payoutsEnabled: boolean
		detailsSubmitted: boolean
		requirements: Stripe.Account.Requirements | null
	}> => {
		const stripe = getStripe()
		const account = await stripe.accounts.retrieve(accountId)

		return {
			chargesEnabled: account.charges_enabled ?? false,
			payoutsEnabled: account.payouts_enabled ?? false,
			detailsSubmitted: account.details_submitted ?? false,
			requirements: account.requirements ?? null,
		}
	},
)

/**
 * Sync account status from Stripe to database
 */
export const syncAccountStatus = createServerOnlyFn(
	async (teamId: string): Promise<void> => {
		const db = getDb()
		const stripe = getStripe()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
			columns: {
				stripeConnectedAccountId: true,
				stripeOnboardingCompletedAt: true,
			},
		})

		if (!team?.stripeConnectedAccountId) {
			return
		}

		const account = await stripe.accounts.retrieve(
			team.stripeConnectedAccountId,
		)
		const status =
			account.charges_enabled && account.payouts_enabled
				? "VERIFIED"
				: "PENDING"

		// Only set onboarding timestamp if not already set and status is VERIFIED
		const updateData: {
			stripeAccountStatus: string
			stripeOnboardingCompletedAt?: Date | null
		} = {
			stripeAccountStatus: status,
		}

		if (status === "VERIFIED" && !team.stripeOnboardingCompletedAt) {
			updateData.stripeOnboardingCompletedAt = new Date()
		}

		await db.update(teamTable).set(updateData).where(eq(teamTable.id, teamId))
	},
)

/**
 * Check if a team has a verified Stripe connection
 */
export const isAccountVerified = createServerOnlyFn(
	async (teamId: string): Promise<boolean> => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
			columns: { stripeAccountStatus: true },
		})

		return team?.stripeAccountStatus === "VERIFIED"
	},
)

/**
 * Disconnect a Stripe account from a team
 */
export const disconnectAccount = createServerOnlyFn(
	async (teamId: string): Promise<void> => {
		const db = getDb()

		await db
			.update(teamTable)
			.set({
				stripeConnectedAccountId: null,
				stripeAccountStatus: null,
				stripeAccountType: null,
				stripeOnboardingCompletedAt: null,
			})
			.where(eq(teamTable.id, teamId))

		// Note: We don't revoke the OAuth token or delete the Express account
		// The organizer can reconnect if they want
	},
)

/**
 * Get Stripe Express dashboard login link
 */
export const getStripeDashboardLink = createServerOnlyFn(
	async (accountId: string): Promise<string> => {
		const stripe = getStripe()
		const loginLink = await stripe.accounts.createLoginLink(accountId)
		return loginLink.url
	},
)

/**
 * Get the balance for a connected account
 */
export const getAccountBalance = createServerOnlyFn(
	async (accountId: string): Promise<AccountBalance> => {
		const stripe = getStripe()

		const balance = await stripe.balance.retrieve({
			stripeAccount: accountId,
		})

		return {
			available: balance.available.map((b) => ({
				currency: b.currency,
				amount: b.amount,
			})),
			pending: balance.pending.map((b) => ({
				currency: b.currency,
				amount: b.amount,
			})),
		}
	},
)
