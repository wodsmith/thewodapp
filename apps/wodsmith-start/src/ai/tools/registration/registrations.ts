/**
 * @fileoverview Registration management tools for the Registration Agent.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and, count, sql } from "drizzle-orm"

import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { waiverSignaturesTable, waiversTable } from "@/db/schemas/waivers"

/**
 * Get registration overview for a competition.
 */
export const getRegistrationOverview = createTool({
	id: "get-registration-overview",
	description:
		"Get a summary of registrations for a competition including counts by division and payment status.",
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

		// Get registration counts by division
		const divisionCounts = await db
			.select({
				divisionId: competitionRegistrationsTable.divisionId,
				count: count(),
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))
			.groupBy(competitionRegistrationsTable.divisionId)

		// Get division labels
		const divisionIds = divisionCounts
			.map((d) => d.divisionId)
			.filter(Boolean) as string[]
		const divisions =
			divisionIds.length > 0
				? await db.query.scalingLevelsTable.findMany({
						where: sql`${scalingLevelsTable.id} IN (${sql.join(
							divisionIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					})
				: []

		const divisionMap = new Map(divisions.map((d) => [d.id, d.label]))

		// Get payment status counts
		const paymentCounts = await db
			.select({
				paymentStatus: competitionRegistrationsTable.paymentStatus,
				count: count(),
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))
			.groupBy(competitionRegistrationsTable.paymentStatus)

		// Get total count
		const [totalResult] = await db
			.select({ total: count() })
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))

		return {
			totalRegistrations: totalResult?.total ?? 0,
			byDivision: divisionCounts.map((d) => ({
				divisionId: d.divisionId,
				divisionName: d.divisionId
					? (divisionMap.get(d.divisionId) ?? "Unknown")
					: "No Division",
				count: Number(d.count),
			})),
			byPaymentStatus: paymentCounts.map((p) => ({
				status: p.paymentStatus ?? "UNKNOWN",
				count: Number(p.count),
			})),
		}
	},
})

/**
 * List registrations with optional filters.
 */
export const listRegistrations = createTool({
	id: "list-registrations",
	description:
		"List athlete registrations for a competition with optional filters.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		divisionId: z.string().optional().describe("Filter by division"),
		paymentStatus: z
			.enum(["FREE", "PENDING_PAYMENT", "PAID", "FAILED"])
			.optional()
			.describe("Filter by payment status"),
		limit: z.number().min(1).max(100).default(50).describe("Max results"),
		offset: z.number().min(0).default(0).describe("Pagination offset"),
	}),
	execute: async (inputData, context) => {
		const { competitionId, divisionId, paymentStatus, limit, offset } =
			inputData
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

		// Build query conditions
		const conditions = [
			eq(competitionRegistrationsTable.eventId, competitionId),
		]
		if (divisionId) {
			conditions.push(eq(competitionRegistrationsTable.divisionId, divisionId))
		}
		if (paymentStatus) {
			conditions.push(
				eq(competitionRegistrationsTable.paymentStatus, paymentStatus),
			)
		}

		// Get registrations
		const registrations = await db.query.competitionRegistrationsTable.findMany(
			{
				where: and(...conditions),
				with: {
					user: true,
					division: true,
				},
				orderBy: (r, { desc }) => [desc(r.registeredAt)],
				limit,
				offset,
			},
		)

		return {
			registrations: registrations.map((r) => ({
				id: r.id,
				userId: r.userId,
				athleteName: r.user
					? `${r.user.firstName || ""} ${r.user.lastName || ""}`.trim() ||
						r.user.email
					: "Unknown",
				email: r.user?.email,
				divisionId: r.divisionId,
				divisionName: r.division?.label,
				teamName: r.teamName,
				paymentStatus: r.paymentStatus,
				registeredAt: r.registeredAt.toISOString(),
			})),
		}
	},
})

/**
 * Get detailed registration info.
 */
export const getRegistrationDetails = createTool({
	id: "get-registration-details",
	description:
		"Get full details for a specific registration including waiver status.",
	inputSchema: z.object({
		registrationId: z.string().describe("The registration ID"),
	}),
	execute: async (inputData, context) => {
		const { registrationId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get registration with related data
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(competitionRegistrationsTable.id, registrationId),
				with: {
					user: true,
					division: true,
					competition: true,
				},
			},
		)

		if (!registration) {
			return { error: "Registration not found" }
		}

		// Verify team access
		if (teamId && registration.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		// Get waivers for competition
		const waivers = await db.query.waiversTable.findMany({
			where: eq(waiversTable.competitionId, registration.eventId),
		})

		// Get user's waiver signatures
		const signatures = await db.query.waiverSignaturesTable.findMany({
			where: and(
				eq(waiverSignaturesTable.userId, registration.userId),
				eq(waiverSignaturesTable.registrationId, registrationId),
			),
		})

		const signedWaiverIds = new Set(signatures.map((s) => s.waiverId))

		return {
			registration: {
				id: registration.id,
				userId: registration.userId,
				athleteName: registration.user
					? `${registration.user.firstName || ""} ${registration.user.lastName || ""}`.trim() ||
						registration.user.email
					: "Unknown",
				email: registration.user?.email,
				divisionId: registration.divisionId,
				divisionName: registration.division?.label,
				teamName: registration.teamName,
				paymentStatus: registration.paymentStatus,
				paidAt: registration.paidAt?.toISOString(),
				registeredAt: registration.registeredAt.toISOString(),
				metadata: registration.metadata
					? JSON.parse(registration.metadata)
					: null,
			},
			waiverStatus: waivers.map((w) => ({
				waiverId: w.id,
				title: w.title,
				required: w.required,
				signed: signedWaiverIds.has(w.id),
			})),
		}
	},
})

/**
 * Update a registration.
 */
export const updateRegistration = createTool({
	id: "update-registration",
	description: "Update a registration's division or status.",
	inputSchema: z.object({
		registrationId: z.string().describe("The registration ID"),
		divisionId: z.string().optional().describe("New division ID"),
		paymentStatus: z
			.enum(["FREE", "PENDING_PAYMENT", "PAID", "FAILED"])
			.optional()
			.describe("Update payment status"),
	}),
	execute: async (inputData, context) => {
		const { registrationId, divisionId, paymentStatus } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get registration
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(competitionRegistrationsTable.id, registrationId),
				with: {
					competition: true,
				},
			},
		)

		if (!registration) {
			return { error: "Registration not found" }
		}

		// Verify team access
		if (teamId && registration.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		// Update registration
		await db
			.update(competitionRegistrationsTable)
			.set({
				...(divisionId !== undefined && { divisionId }),
				...(paymentStatus !== undefined && {
					paymentStatus,
					paidAt: paymentStatus === "PAID" ? new Date() : registration.paidAt,
				}),
				updatedAt: new Date(),
			})
			.where(eq(competitionRegistrationsTable.id, registrationId))

		return {
			success: true,
			registrationId,
			updated: { divisionId, paymentStatus },
		}
	},
})

/**
 * Check waiver completion for a registration.
 */
export const checkWaiverCompletion = createTool({
	id: "check-waiver-completion",
	description:
		"Check if all required waivers have been signed for a registration.",
	inputSchema: z.object({
		registrationId: z.string().describe("The registration ID"),
	}),
	execute: async (inputData, context) => {
		const { registrationId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get registration
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(competitionRegistrationsTable.id, registrationId),
				with: {
					competition: true,
				},
			},
		)

		if (!registration) {
			return { error: "Registration not found" }
		}

		// Verify team access
		if (teamId && registration.competition?.organizingTeamId !== teamId) {
			return { error: "Access denied" }
		}

		// Get required waivers
		const requiredWaivers = await db.query.waiversTable.findMany({
			where: and(
				eq(waiversTable.competitionId, registration.eventId),
				eq(waiversTable.required, true),
			),
		})

		// Get user's signatures for this specific registration
		const signatures = await db.query.waiverSignaturesTable.findMany({
			where: and(
				eq(waiverSignaturesTable.userId, registration.userId),
				eq(waiverSignaturesTable.registrationId, registrationId),
			),
		})

		const signedWaiverIds = new Set(signatures.map((s) => s.waiverId))

		const missingWaivers = requiredWaivers.filter(
			(w) => !signedWaiverIds.has(w.id),
		)

		return {
			complete: missingWaivers.length === 0,
			totalRequired: requiredWaivers.length,
			signed: requiredWaivers.length - missingWaivers.length,
			missingWaivers: missingWaivers.map((w) => ({
				waiverId: w.id,
				title: w.title,
			})),
		}
	},
})
