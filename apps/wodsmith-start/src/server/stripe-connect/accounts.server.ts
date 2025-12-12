import { eq } from "drizzle-orm"
import { getDb } from "~/db"
import { teamTable } from "~/db/schema.server"
import { getStripe } from "~/lib/stripe"
import type Stripe from "stripe"

const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID

/**
 * Create an Express connected account for a team
 */
export async function createExpressAccount(
	teamId: string,
	email: string,
	teamName: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
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
}

/**
 * Create/refresh an Express account onboarding link
 */
export async function createExpressAccountLink(
	accountId: string,
	teamId: string,
): Promise<{ url: string }> {
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

	const appUrl = process.env.PUBLIC_ORIGIN || process.env.ORIGIN
	if (!appUrl) {
		throw new Error("ORIGIN environment variable not configured")
	}

	const accountLink = await stripe.accountLinks.create({
		account: accountId,
		refresh_url: `${appUrl}/settings/teams/${team.slug}?stripe_refresh=true`,
		return_url: `${appUrl}/settings/teams/${team.slug}?stripe_connected=true`,
		type: "account_onboarding",
	})

	return { url: accountLink.url }
}

/**
 * Get OAuth authorization URL for Standard account connection
 */
export function getOAuthAuthorizeUrl(teamId: string, teamSlug: string): string {
	if (!STRIPE_CLIENT_ID) {
		throw new Error("STRIPE_CLIENT_ID environment variable not configured")
	}

	const state = Buffer.from(JSON.stringify({ teamId, teamSlug })).toString(
		"base64",
	)

	const appUrl = process.env.PUBLIC_ORIGIN || process.env.ORIGIN
	if (!appUrl) {
		throw new Error("ORIGIN environment variable not configured")
	}

	const redirectUri = `${appUrl}/api/stripe-connect-callback`

	const params = new URLSearchParams({
		client_id: STRIPE_CLIENT_ID,
		state,
		scope: "read_write",
		response_type: "code",
		redirect_uri: redirectUri,
	})

	return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

/**
 * Handle OAuth callback - exchange code for account ID
 */
export async function handleOAuthCallback(
	code: string,
	state: string,
): Promise<{ teamId: string; teamSlug: string; accountId: string }> {
	const stripe = getStripe()
	const db = getDb()

	// Decode state
	let stateData: { teamId: string; teamSlug: string }
	try {
		stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8"))
	} catch {
		throw new Error("Invalid OAuth state")
	}

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
		account.charges_enabled && account.payouts_enabled ? "VERIFIED" : "PENDING"

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
	}
}

/**
 * Get current account status from Stripe API
 */
export async function getAccountStatus(accountId: string): Promise<{
	chargesEnabled: boolean
	payoutsEnabled: boolean
	detailsSubmitted: boolean
	requirements: Stripe.Account.Requirements | null
}> {
	const stripe = getStripe()
	const account = await stripe.accounts.retrieve(accountId)

	return {
		chargesEnabled: account.charges_enabled ?? false,
		payoutsEnabled: account.payouts_enabled ?? false,
		detailsSubmitted: account.details_submitted ?? false,
		requirements: account.requirements ?? null,
	}
}

/**
 * Sync account status from Stripe to database
 */
export async function syncAccountStatus(teamId: string): Promise<void> {
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

	const account = await stripe.accounts.retrieve(team.stripeConnectedAccountId)
	const status =
		account.charges_enabled && account.payouts_enabled ? "VERIFIED" : "PENDING"

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
}

/**
 * Check if a team has a verified Stripe connection
 */
export async function isAccountVerified(teamId: string): Promise<boolean> {
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { stripeAccountStatus: true },
	})

	return team?.stripeAccountStatus === "VERIFIED"
}

/**
 * Disconnect a Stripe account from a team
 */
export async function disconnectAccount(teamId: string): Promise<void> {
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
}

/**
 * Get Stripe Express dashboard login link
 */
export async function getStripeDashboardLink(
	accountId: string,
): Promise<string> {
	const stripe = getStripe()
	const loginLink = await stripe.accounts.createLoginLink(accountId)
	return loginLink.url
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
 * Get the balance for a connected account
 */
export async function getAccountBalance(
	accountId: string,
): Promise<AccountBalance> {
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
}
