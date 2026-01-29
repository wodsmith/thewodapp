/**
 * Competition Server Functions for TanStack Start
 * Port of competition logic from wodsmith app
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	type Competition,
	type CompetitionGroup,
	competitionGroupsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	TEAM_PERMISSIONS,
	type Team,
	teamTable,
} from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import {
	createCompetition,
	createCompetitionGroup,
	deleteCompetitionGroup,
	updateCompetition,
	updateCompetitionGroup,
} from "@/server-fns/competition-server-logic"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

export interface CompetitionWithOrganizingTeam extends Competition {
	organizingTeam: Team | null
	group: CompetitionGroup | null
}

export interface CompetitionWithRelations extends Competition {
	organizingTeam: Team | null
	competitionTeam: Team | null
	group: CompetitionGroup | null
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPublicCompetitionsInputSchema = z.object({
	// No inputs needed for public competitions
})

const getOrganizerCompetitionsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const getCompetitionBySlugInputSchema = z.object({
	slug: z.string().min(1, "Slug is required"),
})

// Schema for YYYY-MM-DD date strings
const dateStringSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")

const createCompetitionInputSchema = z.object({
	organizingTeamId: z.string().min(1, "Team ID is required"),
	name: z.string().min(1, "Name is required"),
	slug: z.string().min(1, "Slug is required"),
	startDate: dateStringSchema,
	endDate: dateStringSchema,
	description: z.string().optional(),
	registrationOpensAt: dateStringSchema.optional(),
	registrationClosesAt: dateStringSchema.optional(),
	groupId: z.string().optional(),
	settings: z.string().optional(),
	timezone: z.string().optional(),
	competitionType: z.enum(["in-person", "online"]).optional(),
})

const updateCompetitionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	name: z.string().optional(),
	slug: z.string().optional(),
	description: z.string().nullable().optional(),
	startDate: dateStringSchema.optional(),
	endDate: dateStringSchema.optional(),
	registrationOpensAt: dateStringSchema.nullable().optional(),
	registrationClosesAt: dateStringSchema.nullable().optional(),
	groupId: z.string().nullable().optional(),
	settings: z.string().nullable().optional(),
	visibility: z.enum(["public", "private"]).optional(),
	status: z.enum(["draft", "published"]).optional(),
	competitionType: z.enum(["in-person", "online"]).optional(),
	profileImageUrl: z.string().nullable().optional(),
	bannerImageUrl: z.string().nullable().optional(),
	timezone: z.string().optional(),
})

const getCompetitionGroupsInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const getCompetitionGroupByIdInputSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
})

const createCompetitionGroupInputSchema = z.object({
	organizingTeamId: z.string().min(1, "Team ID is required"),
	name: z.string().min(1, "Name is required"),
	slug: z.string().min(1, "Slug is required"),
	description: z.string().optional(),
})

const updateCompetitionGroupInputSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
	name: z.string().optional(),
	slug: z.string().optional(),
	description: z.string().nullable().optional(),
})

const deleteCompetitionGroupInputSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all public competitions for the /compete page
 * Returns published competitions with visibility = 'public'
 * Ordered by startDate ascending (upcoming first)
 */
export const getPublicCompetitionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getPublicCompetitionsInputSchema.parse(data),
	)
	.handler(async () => {
		const db = getDb()

		const competitions = await db
			.select({
				// Competition fields
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
				competitionTeamId: competitionsTable.competitionTeamId,
				groupId: competitionsTable.groupId,
				slug: competitionsTable.slug,
				name: competitionsTable.name,
				description: competitionsTable.description,
				startDate: competitionsTable.startDate,
				endDate: competitionsTable.endDate,
				registrationOpensAt: competitionsTable.registrationOpensAt,
				registrationClosesAt: competitionsTable.registrationClosesAt,
				timezone: competitionsTable.timezone,
				settings: competitionsTable.settings,
				defaultRegistrationFeeCents:
					competitionsTable.defaultRegistrationFeeCents,
				platformFeePercentage: competitionsTable.platformFeePercentage,
				platformFeeFixed: competitionsTable.platformFeeFixed,
				passStripeFeesToCustomer: competitionsTable.passStripeFeesToCustomer,
				passPlatformFeesToCustomer:
					competitionsTable.passPlatformFeesToCustomer,
				visibility: competitionsTable.visibility,
				status: competitionsTable.status,
				competitionType: competitionsTable.competitionType,
				profileImageUrl: competitionsTable.profileImageUrl,
				bannerImageUrl: competitionsTable.bannerImageUrl,
				defaultHeatsPerRotation: competitionsTable.defaultHeatsPerRotation,
				defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
				defaultMaxSpotsPerDivision:
					competitionsTable.defaultMaxSpotsPerDivision,
				createdAt: competitionsTable.createdAt,
				updatedAt: competitionsTable.updatedAt,
				updateCounter: competitionsTable.updateCounter,
				// Organizing team fields (subset for public display)
				organizingTeam: {
					id: teamTable.id,
					name: teamTable.name,
					slug: teamTable.slug,
					avatarUrl: teamTable.avatarUrl,
				},
				// Group fields
				group: {
					id: competitionGroupsTable.id,
					organizingTeamId: competitionGroupsTable.organizingTeamId,
					slug: competitionGroupsTable.slug,
					name: competitionGroupsTable.name,
					description: competitionGroupsTable.description,
					createdAt: competitionGroupsTable.createdAt,
					updatedAt: competitionGroupsTable.updatedAt,
					updateCounter: competitionGroupsTable.updateCounter,
				},
			})
			.from(competitionsTable)
			.leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
			.leftJoin(
				competitionGroupsTable,
				eq(competitionsTable.groupId, competitionGroupsTable.id),
			)
			.where(
				and(
					eq(competitionsTable.visibility, "public"),
					eq(competitionsTable.status, "published"),
				),
			)
			.orderBy(competitionsTable.startDate)

		// Transform the result to match the expected type
		const competitionsWithRelations: CompetitionWithOrganizingTeam[] =
			competitions.map((row) => ({
				id: row.id,
				organizingTeamId: row.organizingTeamId,
				competitionTeamId: row.competitionTeamId,
				groupId: row.groupId,
				slug: row.slug,
				name: row.name,
				description: row.description,
				startDate: row.startDate,
				endDate: row.endDate,
				registrationOpensAt: row.registrationOpensAt,
				registrationClosesAt: row.registrationClosesAt,
				timezone: row.timezone,
				settings: row.settings,
				defaultRegistrationFeeCents: row.defaultRegistrationFeeCents,
				platformFeePercentage: row.platformFeePercentage,
				platformFeeFixed: row.platformFeeFixed,
				passStripeFeesToCustomer: row.passStripeFeesToCustomer,
				passPlatformFeesToCustomer: row.passPlatformFeesToCustomer,
				visibility: row.visibility,
				status: row.status,
				competitionType: row.competitionType,
				profileImageUrl: row.profileImageUrl,
				bannerImageUrl: row.bannerImageUrl,
				defaultHeatsPerRotation: row.defaultHeatsPerRotation,
				defaultLaneShiftPattern: row.defaultLaneShiftPattern,
				defaultMaxSpotsPerDivision: row.defaultMaxSpotsPerDivision,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				updateCounter: row.updateCounter,
				organizingTeam: row.organizingTeam?.id
					? ({
							id: row.organizingTeam.id,
							name: row.organizingTeam.name,
							slug: row.organizingTeam.slug,
							avatarUrl: row.organizingTeam.avatarUrl,
						} as Partial<Team> as Team)
					: null,
				group: row.group?.id
					? ({
							id: row.group.id,
							organizingTeamId: row.group.organizingTeamId,
							slug: row.group.slug,
							name: row.group.name,
							description: row.group.description,
							createdAt: row.group.createdAt,
							updatedAt: row.group.updatedAt,
							updateCounter: row.group.updateCounter,
						} as CompetitionGroup)
					: null,
			}))

		return { competitions: competitionsWithRelations }
	})

/**
 * Get all competitions organized by a team
 * Returns competitions where team is the organizing team
 * Ordered by startDate descending (most recent first)
 */
export const getOrganizerCompetitionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getOrganizerCompetitionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const competitions = await db
			.select({
				// Competition fields
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
				competitionTeamId: competitionsTable.competitionTeamId,
				groupId: competitionsTable.groupId,
				slug: competitionsTable.slug,
				name: competitionsTable.name,
				description: competitionsTable.description,
				startDate: competitionsTable.startDate,
				endDate: competitionsTable.endDate,
				registrationOpensAt: competitionsTable.registrationOpensAt,
				registrationClosesAt: competitionsTable.registrationClosesAt,
				timezone: competitionsTable.timezone,
				settings: competitionsTable.settings,
				defaultRegistrationFeeCents:
					competitionsTable.defaultRegistrationFeeCents,
				platformFeePercentage: competitionsTable.platformFeePercentage,
				platformFeeFixed: competitionsTable.platformFeeFixed,
				passStripeFeesToCustomer: competitionsTable.passStripeFeesToCustomer,
				passPlatformFeesToCustomer:
					competitionsTable.passPlatformFeesToCustomer,
				visibility: competitionsTable.visibility,
				status: competitionsTable.status,
				competitionType: competitionsTable.competitionType,
				profileImageUrl: competitionsTable.profileImageUrl,
				bannerImageUrl: competitionsTable.bannerImageUrl,
				defaultHeatsPerRotation: competitionsTable.defaultHeatsPerRotation,
				defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
				defaultMaxSpotsPerDivision:
					competitionsTable.defaultMaxSpotsPerDivision,
				createdAt: competitionsTable.createdAt,
				updatedAt: competitionsTable.updatedAt,
				updateCounter: competitionsTable.updateCounter,
				// Organizing team (full)
				organizingTeam: teamTable,
				// Competition team (full)
				competitionTeam: {
					id: teamTable.id,
					name: teamTable.name,
					slug: teamTable.slug,
					type: teamTable.type,
					parentOrganizationId: teamTable.parentOrganizationId,
					description: teamTable.description,
					creditBalance: teamTable.creditBalance,
					avatarUrl: teamTable.avatarUrl,
					competitionMetadata: teamTable.competitionMetadata,
					createdAt: teamTable.createdAt,
					updatedAt: teamTable.updatedAt,
					updateCounter: teamTable.updateCounter,
				},
				// Group fields
				group: {
					id: competitionGroupsTable.id,
					organizingTeamId: competitionGroupsTable.organizingTeamId,
					slug: competitionGroupsTable.slug,
					name: competitionGroupsTable.name,
					description: competitionGroupsTable.description,
					createdAt: competitionGroupsTable.createdAt,
					updatedAt: competitionGroupsTable.updatedAt,
					updateCounter: competitionGroupsTable.updateCounter,
				},
			})
			.from(competitionsTable)
			.leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
			.leftJoin(
				competitionGroupsTable,
				eq(competitionsTable.groupId, competitionGroupsTable.id),
			)
			.where(eq(competitionsTable.organizingTeamId, data.teamId))
			.orderBy(desc(competitionsTable.startDate))

		// Note: Due to the complexity of properly typing the joins with multiple team joins,
		// we'll return a simpler structure. The actual implementation would need
		// a second join for competitionTeam, but for this MVP we'll fetch it separately if needed.

		// Transform to expected type (simplified - organizingTeam only for now)
		const competitionsWithRelations = competitions.map((row) => ({
			id: row.id,
			organizingTeamId: row.organizingTeamId,
			competitionTeamId: row.competitionTeamId,
			groupId: row.groupId,
			slug: row.slug,
			name: row.name,
			description: row.description,
			startDate: row.startDate,
			endDate: row.endDate,
			registrationOpensAt: row.registrationOpensAt,
			registrationClosesAt: row.registrationClosesAt,
			timezone: row.timezone,
			settings: row.settings,
			defaultRegistrationFeeCents: row.defaultRegistrationFeeCents,
			platformFeePercentage: row.platformFeePercentage,
			platformFeeFixed: row.platformFeeFixed,
			passStripeFeesToCustomer: row.passStripeFeesToCustomer,
			passPlatformFeesToCustomer: row.passPlatformFeesToCustomer,
			visibility: row.visibility,
			status: row.status,
			competitionType: row.competitionType,
			profileImageUrl: row.profileImageUrl,
			bannerImageUrl: row.bannerImageUrl,
			defaultHeatsPerRotation: row.defaultHeatsPerRotation,
			defaultLaneShiftPattern: row.defaultLaneShiftPattern,
			defaultMaxSpotsPerDivision: row.defaultMaxSpotsPerDivision,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			updateCounter: row.updateCounter,
			organizingTeam: row.organizingTeam as Team | null,
			competitionTeam: null, // Would need second join to populate
			group: row.group?.id
				? ({
						id: row.group.id,
						organizingTeamId: row.group.organizingTeamId,
						slug: row.group.slug,
						name: row.group.name,
						description: row.group.description,
						createdAt: row.group.createdAt,
						updatedAt: row.group.updatedAt,
						updateCounter: row.group.updateCounter,
					} as CompetitionGroup)
				: null,
		}))

		return { competitions: competitionsWithRelations }
	})

/**
 * Get a single competition by slug
 * Used for public competition detail pages
 * Returns full competition details with organizing team and group
 */
export const getCompetitionBySlugFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionBySlugInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const result = await db
			.select({
				// Competition fields
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
				competitionTeamId: competitionsTable.competitionTeamId,
				groupId: competitionsTable.groupId,
				slug: competitionsTable.slug,
				name: competitionsTable.name,
				description: competitionsTable.description,
				startDate: competitionsTable.startDate,
				endDate: competitionsTable.endDate,
				registrationOpensAt: competitionsTable.registrationOpensAt,
				registrationClosesAt: competitionsTable.registrationClosesAt,
				timezone: competitionsTable.timezone,
				settings: competitionsTable.settings,
				defaultRegistrationFeeCents:
					competitionsTable.defaultRegistrationFeeCents,
				platformFeePercentage: competitionsTable.platformFeePercentage,
				platformFeeFixed: competitionsTable.platformFeeFixed,
				passStripeFeesToCustomer: competitionsTable.passStripeFeesToCustomer,
				passPlatformFeesToCustomer:
					competitionsTable.passPlatformFeesToCustomer,
				visibility: competitionsTable.visibility,
				status: competitionsTable.status,
				competitionType: competitionsTable.competitionType,
				profileImageUrl: competitionsTable.profileImageUrl,
				bannerImageUrl: competitionsTable.bannerImageUrl,
				defaultHeatsPerRotation: competitionsTable.defaultHeatsPerRotation,
				defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
				defaultMaxSpotsPerDivision:
					competitionsTable.defaultMaxSpotsPerDivision,
				createdAt: competitionsTable.createdAt,
				updatedAt: competitionsTable.updatedAt,
				updateCounter: competitionsTable.updateCounter,
				// Organizing team
				organizingTeam: teamTable,
				// Group fields
				group: {
					id: competitionGroupsTable.id,
					organizingTeamId: competitionGroupsTable.organizingTeamId,
					slug: competitionGroupsTable.slug,
					name: competitionGroupsTable.name,
					description: competitionGroupsTable.description,
					createdAt: competitionGroupsTable.createdAt,
					updatedAt: competitionGroupsTable.updatedAt,
					updateCounter: competitionGroupsTable.updateCounter,
				},
			})
			.from(competitionsTable)
			.leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
			.leftJoin(
				competitionGroupsTable,
				eq(competitionsTable.groupId, competitionGroupsTable.id),
			)
			.where(eq(competitionsTable.slug, data.slug))
			.limit(1)

		if (!result[0]) {
			return { competition: null }
		}

		const row = result[0]

		const competition: CompetitionWithOrganizingTeam = {
			id: row.id,
			organizingTeamId: row.organizingTeamId,
			competitionTeamId: row.competitionTeamId,
			groupId: row.groupId,
			slug: row.slug,
			name: row.name,
			description: row.description,
			startDate: row.startDate,
			endDate: row.endDate,
			registrationOpensAt: row.registrationOpensAt,
			registrationClosesAt: row.registrationClosesAt,
			timezone: row.timezone,
			settings: row.settings,
			defaultRegistrationFeeCents: row.defaultRegistrationFeeCents,
			platformFeePercentage: row.platformFeePercentage,
			platformFeeFixed: row.platformFeeFixed,
			passStripeFeesToCustomer: row.passStripeFeesToCustomer,
			passPlatformFeesToCustomer: row.passPlatformFeesToCustomer,
			visibility: row.visibility,
			status: row.status,
			competitionType: row.competitionType,
			profileImageUrl: row.profileImageUrl,
			bannerImageUrl: row.bannerImageUrl,
			defaultHeatsPerRotation: row.defaultHeatsPerRotation,
			defaultLaneShiftPattern: row.defaultLaneShiftPattern,
			defaultMaxSpotsPerDivision: row.defaultMaxSpotsPerDivision,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			updateCounter: row.updateCounter,
			organizingTeam: row.organizingTeam as Team | null,
			group: row.group?.id
				? ({
						id: row.group.id,
						organizingTeamId: row.group.organizingTeamId,
						slug: row.group.slug,
						name: row.group.name,
						description: row.group.description,
						createdAt: row.group.createdAt,
						updatedAt: row.group.updatedAt,
						updateCounter: row.group.updateCounter,
					} as CompetitionGroup)
				: null,
		}

		return { competition }
	})

/**
 * Create a new competition
 * Creates the competition and auto-generates a competition_event team
 */
export const createCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createCompetitionInputSchema.parse(data))
	.handler(async ({ data }) => {
		try {
			const result = await createCompetition({
				organizingTeamId: data.organizingTeamId,
				name: data.name,
				slug: data.slug,
				startDate: data.startDate,
				endDate: data.endDate,
				description: data.description,
				registrationOpensAt: data.registrationOpensAt,
				registrationClosesAt: data.registrationClosesAt,
				groupId: data.groupId,
				settings: data.settings,
				timezone: data.timezone,
				competitionType: data.competitionType,
			})

			logInfo({
				message: "[competition] Competition created",
				attributes: {
					competitionId: result.competitionId,
					competitionTeamId: result.competitionTeamId,
					competitionName: data.name,
					organizingTeamId: data.organizingTeamId,
					slug: data.slug,
				},
			})

			return result
		} catch (error) {
			logError({
				message: "[competition] Failed to create competition",
				error,
				attributes: {
					competitionName: data.name,
					organizingTeamId: data.organizingTeamId,
					slug: data.slug,
				},
			})
			throw error
		}
	})

/**
 * Update an existing competition
 * Allows updating competition details, slug, dates, settings, etc.
 * Requires authentication and MANAGE_COMPETITION permission on the organizing team.
 */
export const updateCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateCompetitionInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Auth check: require authenticated user
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Authentication required")
		}

		const db = getDb()

		// Get the competition to check organizing team
		const existingCompetition = await db
			.select({
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
			})
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!existingCompetition[0]) {
			throw new Error("Competition not found")
		}

		// Admin bypass - site admins can manage any competition
		const isAdmin = session.user.role === ROLES_ENUM.ADMIN

		if (!isAdmin) {
			// Permission check: user must have MANAGE_COMPETITION permission on organizing team
			const organizingTeam = session.teams?.find(
				(t) => t.id === existingCompetition[0].organizingTeamId,
			)
			if (
				!organizingTeam ||
				!organizingTeam.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)
			) {
				throw new Error(
					"You do not have permission to manage this competition. Please contact the organizing team.",
				)
			}
		}

		try {
			const { competitionId, ...updates } = data

			const competition = await updateCompetition(competitionId, updates)

			logInfo({
				message: "[competition] Competition updated",
				attributes: {
					competitionId,
					userId: session.userId,
					updatedFields: Object.keys(updates),
				},
			})

			return { competition }
		} catch (error) {
			logError({
				message: "[competition] Failed to update competition",
				error,
				attributes: {
					competitionId: data.competitionId,
					userId: session.userId,
				},
			})
			throw error
		}
	})

/**
 * Get all competition groups/series for a team
 * Returns groups where team is the organizing team with competition counts
 */
export const getCompetitionGroupsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionGroupsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const groups = await db
			.select({
				id: competitionGroupsTable.id,
				organizingTeamId: competitionGroupsTable.organizingTeamId,
				slug: competitionGroupsTable.slug,
				name: competitionGroupsTable.name,
				description: competitionGroupsTable.description,
				createdAt: competitionGroupsTable.createdAt,
				updatedAt: competitionGroupsTable.updatedAt,
				updateCounter: competitionGroupsTable.updateCounter,
				competitionCount: sql<number>`cast(count(${competitionsTable.id}) as integer)`,
			})
			.from(competitionGroupsTable)
			.leftJoin(
				competitionsTable,
				eq(competitionsTable.groupId, competitionGroupsTable.id),
			)
			.where(eq(competitionGroupsTable.organizingTeamId, data.teamId))
			.groupBy(competitionGroupsTable.id)
			.orderBy(desc(competitionGroupsTable.createdAt))

		return { groups }
	})

/**
 * Get a single competition group/series by ID
 */
export const getCompetitionGroupByIdFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionGroupByIdInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const group = await db
			.select({
				id: competitionGroupsTable.id,
				organizingTeamId: competitionGroupsTable.organizingTeamId,
				slug: competitionGroupsTable.slug,
				name: competitionGroupsTable.name,
				description: competitionGroupsTable.description,
				createdAt: competitionGroupsTable.createdAt,
				updatedAt: competitionGroupsTable.updatedAt,
				updateCounter: competitionGroupsTable.updateCounter,
			})
			.from(competitionGroupsTable)
			.where(eq(competitionGroupsTable.id, data.groupId))
			.limit(1)

		if (!group[0]) {
			return { group: null }
		}

		return { group: group[0] }
	})

/**
 * Create a new competition group/series
 */
export const createCompetitionGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		createCompetitionGroupInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		try {
			const result = await createCompetitionGroup({
				organizingTeamId: data.organizingTeamId,
				name: data.name,
				slug: data.slug,
				description: data.description,
			})

			logInfo({
				message: "[competition] Competition group created",
				attributes: {
					groupId: result.groupId,
					groupName: data.name,
					organizingTeamId: data.organizingTeamId,
				},
			})

			return result
		} catch (error) {
			logError({
				message: "[competition] Failed to create competition group",
				error,
				attributes: {
					groupName: data.name,
					organizingTeamId: data.organizingTeamId,
				},
			})
			throw error
		}
	})

/**
 * Update an existing competition group/series
 */
export const updateCompetitionGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateCompetitionGroupInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		try {
			const { groupId, ...updates } = data

			const group = await updateCompetitionGroup(groupId, updates)

			logInfo({
				message: "[competition] Competition group updated",
				attributes: {
					groupId,
					updatedFields: Object.keys(updates),
				},
			})

			return { group }
		} catch (error) {
			logError({
				message: "[competition] Failed to update competition group",
				error,
				attributes: { groupId: data.groupId },
			})
			throw error
		}
	})

/**
 * Delete a competition group/series
 * Fails if the group contains competitions
 */
export const deleteCompetitionGroupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		deleteCompetitionGroupInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		try {
			const result = await deleteCompetitionGroup(data.groupId)

			logInfo({
				message: "[competition] Competition group deleted",
				attributes: { groupId: data.groupId },
			})

			return result
		} catch (error) {
			logError({
				message: "[competition] Failed to delete competition group",
				error,
				attributes: { groupId: data.groupId },
			})
			throw error
		}
	})
