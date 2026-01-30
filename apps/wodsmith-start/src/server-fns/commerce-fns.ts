/**
 * Commerce Server Functions for TanStack Start
 * Fee configuration and division fee management
 *
 * Note: Registration payment functions are in registration-fns.ts
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionDivisionsTable,
	competitionsTable,
	TEAM_PERMISSIONS,
	teamTable,
} from "@/db/schema"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import { getCompetitionRevenueStats } from "@/server/commerce/fee-calculator"

// Re-export type for consumers
export type { CompetitionRevenueStats } from "@/server/commerce/fee-calculator"

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if user has permission for a team (or is a site admin)
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	// Site admins have all permissions
	if (session.user?.role === ROLES_ENUM.ADMIN) return true

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionDivisionFeesInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getCompetitionRevenueStatsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const updateCompetitionFeeConfigInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	defaultRegistrationFeeCents: z.number().int().min(0).optional(),
	platformFeePercentage: z.number().min(0).max(100).nullable().optional(),
	platformFeeFixed: z.number().int().min(0).nullable().optional(),
	passStripeFeesToCustomer: z.boolean().optional(),
	passPlatformFeesToCustomer: z.boolean().optional(),
})

const updateDivisionFeeInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().min(1, "Division ID is required"),
	feeCents: z.number().int().min(0).nullable(), // null = remove override
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all division fees for a competition (for admin/display)
 */
export const getCompetitionDivisionFeesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionDivisionFeesInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Query fees without relation to avoid Drizzle relation resolution issues
		const fees = await db.query.competitionDivisionsTable.findMany({
			where: eq(competitionDivisionsTable.competitionId, data.competitionId),
		})

		// Get division labels separately if there are fees
		const divisionIds = fees.map((f) => f.divisionId)
		const divisions =
			divisionIds.length > 0
				? await db.query.scalingLevelsTable.findMany({
						where: (table, { inArray }) => inArray(table.id, divisionIds),
					})
				: []

		const divisionMap = new Map(divisions.map((d) => [d.id, d.label]))

		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
		})

		return {
			defaultFeeCents: competition?.defaultRegistrationFeeCents ?? 0,
			divisionFees: fees.map((f) => ({
				divisionId: f.divisionId,
				divisionLabel: divisionMap.get(f.divisionId),
				feeCents: f.feeCents,
			})),
		}
	})

/**
 * Update competition-level fee configuration
 */
export const updateCompetitionFeeConfigFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateCompetitionFeeConfigInputSchema.parse(data),
	)
	.handler(async ({ data: input }) => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		const db = getDb()

		// Verify user has permission to manage this competition
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, input.competitionId),
		})
		if (!competition) throw new Error("Competition not found")

		// Check permission
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Update competition
		await db
			.update(competitionsTable)
			.set({
				defaultRegistrationFeeCents: input.defaultRegistrationFeeCents,
				platformFeePercentage: input.platformFeePercentage,
				platformFeeFixed: input.platformFeeFixed,
				passStripeFeesToCustomer: input.passStripeFeesToCustomer,
				passPlatformFeesToCustomer: input.passPlatformFeesToCustomer,
				updatedAt: new Date(),
			})
			.where(eq(competitionsTable.id, input.competitionId))

		return { success: true }
	})

/**
 * Get revenue stats for a competition
 */
export const getCompetitionRevenueStatsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionRevenueStatsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const stats = await getCompetitionRevenueStats(data.competitionId)
		return { stats }
	})

/**
 * Get organizing team's Stripe status for a competition
 */
export const getOrganizerStripeStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ organizingTeamId: z.string().min(1) }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, data.organizingTeamId),
			columns: {
				slug: true,
				stripeAccountStatus: true,
			},
		})

		if (!team?.slug) {
			return { stripeStatus: null }
		}

		return {
			stripeStatus: {
				isConnected: team.stripeAccountStatus === "VERIFIED",
				teamSlug: team.slug,
			},
		}
	})

/**
 * Update or remove a division-specific fee
 */
export const updateDivisionFeeFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateDivisionFeeInputSchema.parse(data))
	.handler(async ({ data: input }) => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		const db = getDb()

		// Verify permission
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, input.competitionId),
		})
		if (!competition) throw new Error("Competition not found")

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		if (input.feeCents === null) {
			// Remove override
			await db
				.delete(competitionDivisionsTable)
				.where(
					and(
						eq(competitionDivisionsTable.competitionId, input.competitionId),
						eq(competitionDivisionsTable.divisionId, input.divisionId),
					),
				)
		} else {
			// Upsert fee
			const existing = await db.query.competitionDivisionsTable.findFirst({
				where: and(
					eq(competitionDivisionsTable.competitionId, input.competitionId),
					eq(competitionDivisionsTable.divisionId, input.divisionId),
				),
			})

			if (existing) {
				await db
					.update(competitionDivisionsTable)
					.set({ feeCents: input.feeCents, updatedAt: new Date() })
					.where(eq(competitionDivisionsTable.id, existing.id))
			} else {
				await db.insert(competitionDivisionsTable).values({
					competitionId: input.competitionId,
					divisionId: input.divisionId,
					feeCents: input.feeCents,
				})
			}
		}

		return { success: true }
	})
