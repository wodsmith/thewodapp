/**
 * Competition Detail Server Functions for TanStack Start
 *
 * Additional server functions for the competition detail pages
 * that complement the base competition-fns.ts
 *
 * These functions provide data for:
 * - Competition detail layout (registration counts, user status, permissions)
 * - Registration sidebar (user registration, volunteer status)
 * - Pending team invitations
 *
 * Note: Additional data like divisions, workouts, heats, and sponsors
 * should be handled by separate dedicated server function files when needed.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { addressesTable } from "@/db/schemas/addresses"
import {
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	teamInvitationTable,
	teamMembershipTable,
	teamRoleTable,
	teamTable,
} from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import {
	DEFAULT_TIMEZONE,
	hasDateStartedInTimezone,
	isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionRegistrationsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getUserRegistrationInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	userId: z.string().min(1, "User ID is required"),
})

const getPendingTeamInvitesInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	userId: z.string().min(1, "User ID is required"),
})

const checkCanManageInputSchema = z.object({
	organizingTeamId: z.string().min(1, "Organizing team ID is required"),
	userId: z.string().min(1, "User ID is required"),
})

const checkIsVolunteerInputSchema = z.object({
	competitionTeamId: z.string().nullable(),
	userId: z.string().min(1, "User ID is required"),
})

const getCompetitionByIdInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const updateCompetitionRotationSettingsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	defaultHeatsPerRotation: z.number().int().min(1).max(10).optional(),
	defaultLaneShiftPattern: z.enum(["stay", "shift_right"]).optional(),
})

const updateCompetitionScoringConfigInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	scoringConfig: z.object({
		algorithm: z.enum([
			"traditional",
			"p_score",
			"winner_takes_more",
			"online",
			"custom",
		]),
		traditional: z
			.object({
				step: z.number().positive(),
				firstPlacePoints: z.number().positive(),
			})
			.optional(),
		pScore: z
			.object({
				allowNegatives: z.boolean(),
				medianField: z.enum(["top_half", "all"]),
			})
			.optional(),
		customTable: z
			.object({
				baseTemplate: z.enum(["traditional", "p_score", "winner_takes_more"]),
				overrides: z.record(z.string(), z.number()),
			})
			.optional(),
		tiebreaker: z.object({
			primary: z.enum(["countback", "head_to_head", "none"]),
			secondary: z.enum(["countback", "head_to_head", "none"]).optional(),
			headToHeadEventId: z.string().optional(),
		}),
		statusHandling: z.object({
			dnf: z.enum(["worst_performance", "zero", "last_place"]),
			dns: z.enum(["worst_performance", "zero", "exclude"]),
			withdrawn: z.enum(["zero", "exclude"]),
		}),
	}),
})

const deleteCompetitionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	organizingTeamId: z.string().min(1, "Organizing team ID is required"),
})

// ============================================================================
// Permission Helpers
// ============================================================================

async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new Error("Unauthorized")
	}

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) {
		throw new Error("Team not found")
	}

	if (!team.permissions.includes(permission)) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get a single competition by ID
 * Used for the organizer layout route
 */
export const getCompetitionByIdFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getCompetitionByIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const result = await db
			.select({
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
				primaryAddressId: competitionsTable.primaryAddressId,
				createdAt: competitionsTable.createdAt,
				updatedAt: competitionsTable.updatedAt,
				updateCounter: competitionsTable.updateCounter,
				// Address fields
				addressName: addressesTable.name,
				addressStreetLine1: addressesTable.streetLine1,
				addressStreetLine2: addressesTable.streetLine2,
				addressCity: addressesTable.city,
				addressStateProvince: addressesTable.stateProvince,
				addressPostalCode: addressesTable.postalCode,
				addressCountryCode: addressesTable.countryCode,
				addressNotes: addressesTable.notes,
			})
			.from(competitionsTable)
			.leftJoin(
				addressesTable,
				eq(competitionsTable.primaryAddressId, addressesTable.id),
			)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!result[0]) {
			return { competition: null }
		}

		// Reshape to include address as nested object
		const {
			addressName,
			addressStreetLine1,
			addressStreetLine2,
			addressCity,
			addressStateProvince,
			addressPostalCode,
			addressCountryCode,
			addressNotes,
			...competition
		} = result[0]

		const primaryAddress = competition.primaryAddressId
			? {
					name: addressName,
					streetLine1: addressStreetLine1,
					streetLine2: addressStreetLine2,
					city: addressCity,
					stateProvince: addressStateProvince,
					postalCode: addressPostalCode,
					countryCode: addressCountryCode,
					notes: addressNotes,
				}
			: null

		return { competition: { ...competition, primaryAddress } }
	})

/**
 * Get registration count for a competition
 * Used for the competition detail header
 */
export const getCompetitionRegistrationCountFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getCompetitionRegistrationsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const result = await db
			.select({ count: count() })
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

		const registrationCount = result[0]?.count ?? 0

		return { count: registrationCount }
	})

/**
 * Get all registrations for a competition
 * Returns basic registration data without full relations
 */
export const getCompetitionRegistrationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionRegistrationsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const registrations = await db
			.select({
				id: competitionRegistrationsTable.id,
				eventId: competitionRegistrationsTable.eventId,
				userId: competitionRegistrationsTable.userId,
				divisionId: competitionRegistrationsTable.divisionId,
				registeredAt: competitionRegistrationsTable.registeredAt,
				teamName: competitionRegistrationsTable.teamName,
				captainUserId: competitionRegistrationsTable.captainUserId,
				athleteTeamId: competitionRegistrationsTable.athleteTeamId,
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))
			.orderBy(competitionRegistrationsTable.registeredAt)

		return { registrations }
	})

/**
 * Get user's registration for a competition
 * Checks both direct registration (as captain) and team membership
 */
export const getUserCompetitionRegistrationFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) => getUserRegistrationInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// First check if user is the captain/direct registrant
		const directRegistration = await db
			.select({
				id: competitionRegistrationsTable.id,
				eventId: competitionRegistrationsTable.eventId,
				userId: competitionRegistrationsTable.userId,
				divisionId: competitionRegistrationsTable.divisionId,
				registeredAt: competitionRegistrationsTable.registeredAt,
				teamName: competitionRegistrationsTable.teamName,
				captainUserId: competitionRegistrationsTable.captainUserId,
				athleteTeamId: competitionRegistrationsTable.athleteTeamId,
				teamMemberId: competitionRegistrationsTable.teamMemberId,
			})
			.from(competitionRegistrationsTable)
			.where(
				and(
					eq(competitionRegistrationsTable.eventId, data.competitionId),
					eq(competitionRegistrationsTable.userId, data.userId),
				),
			)
			.limit(1)

		if (directRegistration[0]) {
			return { registration: directRegistration[0] }
		}

		// Check if user is a teammate on a team registration
		// Find teams the user is a member of
		const userTeamMemberships = await db
			.select({ teamId: teamMembershipTable.teamId })
			.from(teamMembershipTable)
			.where(
				and(
					eq(teamMembershipTable.userId, data.userId),
					eq(teamMembershipTable.isActive, 1),
				),
			)

		if (userTeamMemberships.length === 0) {
			return { registration: null }
		}

		const userTeamIds = userTeamMemberships.map((m) => m.teamId)

		// Find registration where athleteTeamId is one of user's teams
		// Note: We'd need to handle batching for many teams, but for now keep it simple
		const teamRegistration = await db
			.select({
				id: competitionRegistrationsTable.id,
				eventId: competitionRegistrationsTable.eventId,
				userId: competitionRegistrationsTable.userId,
				divisionId: competitionRegistrationsTable.divisionId,
				registeredAt: competitionRegistrationsTable.registeredAt,
				teamName: competitionRegistrationsTable.teamName,
				captainUserId: competitionRegistrationsTable.captainUserId,
				athleteTeamId: competitionRegistrationsTable.athleteTeamId,
				teamMemberId: competitionRegistrationsTable.teamMemberId,
			})
			.from(competitionRegistrationsTable)
			.where(
				and(
					eq(competitionRegistrationsTable.eventId, data.competitionId),
					sql`${competitionRegistrationsTable.athleteTeamId} IN (${sql.join(
						userTeamIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
			)
			.limit(1)

		return { registration: teamRegistration[0] ?? null }
	})

/**
 * Get pending team invitations for a user related to a competition
 * Used to show invites to join competition teams
 */
export const getPendingTeamInvitesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getPendingTeamInvitesInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get the competition to find the competitionTeamId
		const competition = await db
			.select({
				id: competitionsTable.id,
				competitionTeamId: competitionsTable.competitionTeamId,
			})
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition[0]) {
			return { invitations: [] }
		}

		// Find pending invitations for this user to teams related to this competition
		// This includes both athlete team invites and competition team invites
		const invitations = await db
			.select({
				id: teamInvitationTable.id,
				teamId: teamInvitationTable.teamId,
				email: teamInvitationTable.email,
				roleId: teamInvitationTable.roleId,
				isSystemRole: teamInvitationTable.isSystemRole,
				token: teamInvitationTable.token,
				expiresAt: teamInvitationTable.expiresAt,
				createdAt: teamInvitationTable.createdAt,
				metadata: teamInvitationTable.metadata,
			})
			.from(teamInvitationTable)
			.where(
				and(
					eq(teamInvitationTable.email, data.userId), // Assuming userId is email for now
					isNull(teamInvitationTable.acceptedAt),
				),
			)

		// Filter to competition-related invites
		// This is a simplified version - in production we'd join with teams and check parent organization
		return { invitations }
	})

/**
 * Check if user can manage/organize a competition
 * Checks team membership and permissions, or site admin status
 */
export const checkCanManageCompetitionFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => checkCanManageInputSchema.parse(data))
	.handler(async ({ data }) => {
		// First check if user is a site admin - they can manage any competition
		const session = await getSessionFromCookie()
		if (session?.user?.role === ROLES_ENUM.ADMIN) {
			return { canManage: true }
		}

		const db = getDb()

		// Check if user is a member of the organizing team
		const membership = await db
			.select({
				id: teamMembershipTable.id,
				roleId: teamMembershipTable.roleId,
				isSystemRole: teamMembershipTable.isSystemRole,
			})
			.from(teamMembershipTable)
			.where(
				and(
					eq(teamMembershipTable.teamId, data.organizingTeamId),
					eq(teamMembershipTable.userId, data.userId),
					eq(teamMembershipTable.isActive, 1),
				),
			)
			.limit(1)

		if (!membership[0]) {
			return { canManage: false }
		}

		// Check if user has admin or owner role
		// System roles: ADMIN, OWNER would allow management
		const isTeamAdmin =
			membership[0].roleId === SYSTEM_ROLES_ENUM.ADMIN ||
			membership[0].roleId === SYSTEM_ROLES_ENUM.OWNER

		return { canManage: isTeamAdmin }
	})

/**
 * Check if user is a volunteer for a competition
 * Checks if user has volunteer role in the competition team
 */
export const checkIsVolunteerFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => checkIsVolunteerInputSchema.parse(data))
	.handler(async ({ data }) => {
		if (!data.competitionTeamId) {
			return { isVolunteer: false }
		}

		const db = getDb()

		const membership = await db
			.select({ id: teamMembershipTable.id })
			.from(teamMembershipTable)
			.where(
				and(
					eq(teamMembershipTable.teamId, data.competitionTeamId),
					eq(teamMembershipTable.userId, data.userId),
					eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
					eq(teamMembershipTable.isSystemRole, 1),
					eq(teamMembershipTable.isActive, 1),
				),
			)
			.limit(1)

		return { isVolunteer: !!membership[0] }
	})

/**
 * Get registration status for a competition
 * Returns whether registration is open, closed, or not yet open
 * Uses timezone-aware date comparisons
 */
export const getRegistrationStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				registrationOpensAt: z.string().nullable(),
				registrationClosesAt: z.string().nullable(),
				timezone: z.string().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const timezone = data.timezone || DEFAULT_TIMEZONE
		const regOpensAt = data.registrationOpensAt
		const regClosesAt = data.registrationClosesAt

		// Use timezone-aware comparisons
		const hasOpened = hasDateStartedInTimezone(regOpensAt, timezone)
		const hasClosed = isDeadlinePassedInTimezone(regClosesAt, timezone)

		const registrationOpen = !!(
			regOpensAt &&
			regClosesAt &&
			hasOpened &&
			!hasClosed
		)
		const registrationClosed = hasClosed
		const registrationNotYetOpen = !!(regOpensAt && !hasOpened)

		return {
			registrationOpen,
			registrationClosed,
			registrationNotYetOpen,
		}
	})

// ============================================================================
// Organizer Athletes View
// ============================================================================

const getOrganizerRegistrationsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionFilter: z.string().optional(),
})

/**
 * Get registrations for organizer view with full user and division details
 */
export const getOrganizerRegistrationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getOrganizerRegistrationsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Build where clause
		const whereConditions = [
			eq(competitionRegistrationsTable.eventId, data.competitionId),
		]

		// Get registrations with user and division info using query builder
		const registrations = await db.query.competitionRegistrationsTable.findMany(
			{
				where: and(...whereConditions),
				orderBy: (table, { desc }) => [desc(table.registeredAt)],
				with: {
					user: {
						columns: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							avatar: true,
							gender: true,
							dateOfBirth: true,
						},
					},
					division: {
						columns: {
							id: true,
							label: true,
							teamSize: true,
						},
					},
					athleteTeam: {
						with: {
							memberships: {
								columns: {
									id: true,
									userId: true,
									joinedAt: true,
								},
								where: eq(teamMembershipTable.isActive, 1),
								with: {
									user: {
										columns: {
											id: true,
											firstName: true,
											lastName: true,
											email: true,
											avatar: true,
										},
									},
								},
							},
						},
					},
				},
			},
		)

		// Filter by division if specified (done in JS since we're using query builder)
		const filteredRegistrations = data.divisionFilter
			? registrations.filter((r) => r.divisionId === data.divisionFilter)
			: registrations

		return { registrations: filteredRegistrations }
	})

/**
 * Update competition rotation settings
 */
export const updateCompetitionRotationSettingsFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		updateCompetitionRotationSettingsInputSchema.parse(data),
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
				defaultHeatsPerRotation: input.defaultHeatsPerRotation,
				defaultLaneShiftPattern: input.defaultLaneShiftPattern as
					| LaneShiftPattern
					| undefined,
				updatedAt: new Date(),
			})
			.where(eq(competitionsTable.id, input.competitionId))

		return { success: true }
	})

/**
 * Update competition scoring configuration
 */
export const updateCompetitionScoringConfigFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		updateCompetitionScoringConfigInputSchema.parse(data),
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

		// Parse existing settings and merge with new scoring config
		let existingSettings: Record<string, unknown> = {}
		if (competition.settings) {
			try {
				existingSettings = JSON.parse(competition.settings)
			} catch {
				// Ignore parse errors
			}
		}

		const newSettings = {
			...existingSettings,
			scoringConfig: input.scoringConfig,
		}

		// Update competition
		await db
			.update(competitionsTable)
			.set({
				settings: JSON.stringify(newSettings),
				updatedAt: new Date(),
			})
			.where(eq(competitionsTable.id, input.competitionId))

		return { success: true }
	})

/**
 * Delete a competition
 */
export const deleteCompetitionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteCompetitionInputSchema.parse(data))
	.handler(async ({ data: input }) => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		const db = getDb()

		// Check permission
		await requireTeamPermission(
			input.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Get the competition to verify it exists and get the competitionTeamId
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, input.competitionId),
		})
		if (!competition) throw new Error("Competition not found")

		// Check for existing registrations
		const registrations = await db
			.select({ count: count() })
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, input.competitionId))

		const registrationCount = registrations[0]?.count ?? 0
		if (registrationCount > 0) {
			throw new Error(
				`Cannot delete competition with ${registrationCount} existing registration(s). Please remove registrations first.`,
			)
		}

		// Delete the competition (will cascade delete registrations due to schema)
		await db
			.delete(competitionsTable)
			.where(eq(competitionsTable.id, input.competitionId))

		// Clean up competition_event team related records before deleting the team
		// These tables don't have onDelete cascade, so we must delete manually
		await db
			.delete(teamMembershipTable)
			.where(eq(teamMembershipTable.teamId, competition.competitionTeamId))

		await db
			.delete(teamRoleTable)
			.where(eq(teamRoleTable.teamId, competition.competitionTeamId))

		await db
			.delete(teamInvitationTable)
			.where(eq(teamInvitationTable.teamId, competition.competitionTeamId))

		// Delete the competition_event team
		await db
			.delete(teamTable)
			.where(eq(teamTable.id, competition.competitionTeamId))

		return { success: true }
	})
