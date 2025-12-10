"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { teamTable, TEAM_PERMISSIONS } from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"
import { requireTeamPermission, requireTeamMembership } from "@/utils/team-auth"
import {
	createExpressAccount,
	createExpressAccountLink,
	getOAuthAuthorizeUrl,
	syncAccountStatus,
	disconnectAccount,
	getStripeDashboardLink,
	getAccountBalance,
	type AccountBalance,
} from "@/server/stripe-connect"
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit"

/**
 * Start Express account onboarding
 * Creates account if needed, returns onboarding URL
 */
export async function initiateExpressOnboarding(input: { teamId: string }) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: {
				id: true,
				name: true,
				slug: true,
				stripeConnectedAccountId: true,
				stripeAccountStatus: true,
			},
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// If already has account, just create new onboarding link
		if (team.stripeConnectedAccountId) {
			const link = await createExpressAccountLink(
				team.stripeConnectedAccountId,
				team.id
			)
			return { onboardingUrl: link.url }
		}

		// Create new Express account
		const result = await createExpressAccount(
			team.id,
			session.user.email ?? "",
			team.name
		)

		return { onboardingUrl: result.onboardingUrl }
	}, RATE_LIMITS.SETTINGS)
}

/**
 * Start Standard account OAuth flow
 * Returns OAuth authorization URL
 */
export async function initiateStandardOAuth(input: { teamId: string }) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: { id: true, slug: true },
		})

		if (!team) {
			throw new Error("Team not found")
		}

		const authorizationUrl = getOAuthAuthorizeUrl(team.id, team.slug)
		return { authorizationUrl }
	}, RATE_LIMITS.SETTINGS)
}

/**
 * Refresh onboarding link for Express accounts
 */
export async function refreshOnboardingLink(input: { teamId: string }) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: {
				id: true,
				stripeConnectedAccountId: true,
				stripeAccountType: true,
			},
		})

		if (!team?.stripeConnectedAccountId) {
			throw new Error("No Stripe account connected")
		}

		if (team.stripeAccountType !== "express") {
			throw new Error("Can only refresh onboarding for Express accounts")
		}

		const link = await createExpressAccountLink(
			team.stripeConnectedAccountId,
			team.id
		)

		return { onboardingUrl: link.url }
	}, RATE_LIMITS.SETTINGS)
}

/**
 * Get current Stripe connection status
 */
export async function getStripeConnectionStatus(input: { teamId: string }) {
	return withRateLimit(async () => {
		// Verify user is a member of this team
		await requireTeamMembership(input.teamId)

		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: {
				stripeConnectedAccountId: true,
				stripeAccountStatus: true,
				stripeAccountType: true,
				stripeOnboardingCompletedAt: true,
			},
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// If pending, sync status from Stripe
		if (team.stripeConnectedAccountId && team.stripeAccountStatus === "PENDING") {
			await syncAccountStatus(input.teamId)
			// Re-fetch after sync
			const updated = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, input.teamId),
				columns: {
					stripeAccountStatus: true,
					stripeOnboardingCompletedAt: true,
				},
			})
			return {
				isConnected: updated?.stripeAccountStatus === "VERIFIED",
				status: updated?.stripeAccountStatus ?? null,
				accountType: team.stripeAccountType,
				onboardingCompletedAt: updated?.stripeOnboardingCompletedAt,
			}
		}

		return {
			isConnected: team.stripeAccountStatus === "VERIFIED",
			status: team.stripeAccountStatus,
			accountType: team.stripeAccountType,
			onboardingCompletedAt: team.stripeOnboardingCompletedAt,
		}
	}, RATE_LIMITS.SETTINGS)
}

/**
 * Get Stripe dashboard link (Express accounts only)
 */
export async function getStripeDashboardUrl(input: { teamId: string }) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.ACCESS_BILLING)

		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: {
				stripeConnectedAccountId: true,
				stripeAccountType: true,
				stripeAccountStatus: true,
			},
		})

		if (!team?.stripeConnectedAccountId) {
			throw new Error("No Stripe account connected")
		}

		if (team.stripeAccountStatus !== "VERIFIED") {
			throw new Error("Stripe account not verified")
		}

		// Express accounts use login links, Standard accounts go to dashboard.stripe.com
		if (team.stripeAccountType === "express") {
			const url = await getStripeDashboardLink(team.stripeConnectedAccountId)
			return { dashboardUrl: url }
		}

		// Standard accounts - direct to Stripe dashboard
		return { dashboardUrl: "https://dashboard.stripe.com" }
	}, RATE_LIMITS.SETTINGS)
}

/**
 * Disconnect Stripe account from team
 */
export async function disconnectStripeAccount(input: { teamId: string }) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

		await disconnectAccount(input.teamId)

		return { success: true }
	}, RATE_LIMITS.SETTINGS)
}

/**
 * Get connected account balance from Stripe
 */
export async function getStripeAccountBalance(input: {
	teamId: string
}): Promise<AccountBalance | null> {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.ACCESS_BILLING)

		const db = getDb()
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
			columns: {
				stripeConnectedAccountId: true,
				stripeAccountStatus: true,
			},
		})

		if (!team?.stripeConnectedAccountId) {
			return null
		}

		if (team.stripeAccountStatus !== "VERIFIED") {
			return null
		}

		return getAccountBalance(team.stripeConnectedAccountId)
	}, RATE_LIMITS.SETTINGS)
}
