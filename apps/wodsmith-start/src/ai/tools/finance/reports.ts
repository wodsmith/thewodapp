/**
 * @fileoverview Finance and reporting tools for the Finance Agent.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and, count, sql } from "drizzle-orm"

import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import { commercePurchaseTable } from "@/db/schemas/commerce"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { sponsorsTable, sponsorGroupsTable } from "@/db/schemas/sponsors"
import { parseCompetitionSettings } from "@/types/competitions"

/**
 * Get revenue report for a competition.
 */
export const getRevenueReport = createTool({
	id: "get-revenue-report",
	description:
		"Get a detailed revenue breakdown for a competition including registration fees by division.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get purchases for this competition
		const purchases = await db.query.commercePurchaseTable.findMany({
			where: and(
				eq(commercePurchaseTable.competitionId, competitionId),
				eq(commercePurchaseTable.status, "COMPLETED"),
			),
		})

		// Calculate totals
		const totals = purchases.reduce(
			(acc, p) => ({
				totalCents: acc.totalCents + (p.totalCents ?? 0),
				platformFeeCents: acc.platformFeeCents + (p.platformFeeCents ?? 0),
				stripeFeeCents: acc.stripeFeeCents + (p.stripeFeeCents ?? 0),
				organizerNetCents: acc.organizerNetCents + (p.organizerNetCents ?? 0),
			}),
			{
				totalCents: 0,
				platformFeeCents: 0,
				stripeFeeCents: 0,
				organizerNetCents: 0,
			},
		)

		// Get registration counts by payment status
		const registrationStats = await db
			.select({
				paymentStatus: competitionRegistrationsTable.paymentStatus,
				count: count(),
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))
			.groupBy(competitionRegistrationsTable.paymentStatus)

		// Get revenue by division
		const divisionRevenue = await db
			.select({
				divisionId: commercePurchaseTable.divisionId,
				total: sql<number>`SUM(${commercePurchaseTable.totalCents})`.as(
					"total",
				),
				count: count(),
			})
			.from(commercePurchaseTable)
			.where(
				and(
					eq(commercePurchaseTable.competitionId, competitionId),
					eq(commercePurchaseTable.status, "COMPLETED"),
				),
			)
			.groupBy(commercePurchaseTable.divisionId)

		// Get division labels
		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		const divisions = scalingGroupId
			? await db.query.scalingLevelsTable.findMany({
					where: eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
				})
			: []

		const divisionMap = new Map(divisions.map((d) => [d.id, d.label]))

		return {
			summary: {
				totalRevenue: totals.totalCents,
				platformFees: totals.platformFeeCents,
				stripeFees: totals.stripeFeeCents,
				organizerNet: totals.organizerNetCents,
				totalPurchases: purchases.length,
			},
			registrations: {
				total: registrationStats.reduce((acc, r) => acc + Number(r.count), 0),
				byStatus: registrationStats.map((r) => ({
					status: r.paymentStatus ?? "UNKNOWN",
					count: Number(r.count),
				})),
			},
			byDivision: divisionRevenue.map((d) => ({
				divisionId: d.divisionId,
				divisionName: d.divisionId
					? (divisionMap.get(d.divisionId) ?? "Unknown")
					: "No Division",
				totalCents: Number(d.total ?? 0),
				registrationCount: Number(d.count),
			})),
		}
	},
})

/**
 * Export sponsors for a competition.
 */
export const exportSponsors = createTool({
	id: "export-sponsors",
	description:
		"Get all sponsors for a competition organized by sponsor group/tier.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get sponsor groups
		const groups = await db.query.sponsorGroupsTable.findMany({
			where: eq(sponsorGroupsTable.competitionId, competitionId),
			orderBy: (g, { asc }) => [asc(g.displayOrder)],
		})

		// Get all sponsors for this competition
		const sponsors = await db.query.sponsorsTable.findMany({
			where: eq(sponsorsTable.competitionId, competitionId),
			orderBy: (s, { asc }) => [asc(s.displayOrder)],
		})

		// Group sponsors
		const groupedSponsors = groups.map((g) => ({
			groupId: g.id,
			groupName: g.name,
			displayOrder: g.displayOrder,
			sponsors: sponsors
				.filter((s) => s.groupId === g.id)
				.map((s) => ({
					id: s.id,
					name: s.name,
					logoUrl: s.logoUrl,
					website: s.website,
				})),
		}))

		// Get ungrouped sponsors
		const ungrouped = sponsors.filter((s) => !s.groupId)

		return {
			groups: groupedSponsors,
			ungrouped: ungrouped.map((s) => ({
				id: s.id,
				name: s.name,
				logoUrl: s.logoUrl,
				website: s.website,
			})),
			totalSponsors: sponsors.length,
		}
	},
})

/**
 * Get financial summary across all competitions.
 */
export const getFinancialSummary = createTool({
	id: "get-financial-summary",
	description: "Get a financial summary across competitions for the team.",
	inputSchema: z.object({
		status: z
			.enum(["draft", "published", "all"])
			.optional()
			.describe("Filter competitions by status"),
	}),
	execute: async (inputData, context) => {
		const { status } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return { error: "Team context required" }
		}

		const db = getDb()

		// Get competitions
		const competitions = await db.query.competitionsTable.findMany({
			where: and(
				eq(competitionsTable.organizingTeamId, teamId),
				status && status !== "all"
					? eq(competitionsTable.status, status)
					: undefined,
			),
		})

		const competitionIds = competitions.map((c) => c.id)

		if (competitionIds.length === 0) {
			return {
				totalRevenue: 0,
				totalOrganizations: 0,
				competitions: [],
			}
		}

		// Get purchases for all competitions
		const purchases = await db.query.commercePurchaseTable.findMany({
			where: eq(commercePurchaseTable.status, "COMPLETED"),
		})

		// Filter to team's competitions
		const teamPurchases = purchases.filter((p) =>
			competitionIds.includes(p.competitionId ?? ""),
		)

		// Group by competition
		const byCompetition = new Map<string, typeof teamPurchases>()
		for (const p of teamPurchases) {
			if (!p.competitionId) continue
			const existing = byCompetition.get(p.competitionId) || []
			existing.push(p)
			byCompetition.set(p.competitionId, existing)
		}

		// Build summary
		const competitionSummaries = competitions.map((c) => {
			const compPurchases = byCompetition.get(c.id) || []
			const totals = compPurchases.reduce(
				(acc, p) => ({
					revenue: acc.revenue + (p.totalCents ?? 0),
					organizerNet: acc.organizerNet + (p.organizerNetCents ?? 0),
				}),
				{ revenue: 0, organizerNet: 0 },
			)

			return {
				competitionId: c.id,
				name: c.name,
				startDate: c.startDate.toISOString(),
				status: c.status,
				totalRevenue: totals.revenue,
				organizerNet: totals.organizerNet,
				registrationCount: compPurchases.length,
			}
		})

		const grandTotals = competitionSummaries.reduce(
			(acc, c) => ({
				revenue: acc.revenue + c.totalRevenue,
				organizerNet: acc.organizerNet + c.organizerNet,
			}),
			{ revenue: 0, organizerNet: 0 },
		)

		return {
			totalRevenue: grandTotals.revenue,
			totalOrganizerNet: grandTotals.organizerNet,
			totalCompetitions: competitions.length,
			competitions: competitionSummaries,
		}
	},
})
