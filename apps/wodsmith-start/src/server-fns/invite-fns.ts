/**
 * Invite Server Functions for TanStack Start
 * Functions for handling team and volunteer invitations
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	SYSTEM_ROLES_ENUM,
	scalingLevelsTable,
	TEAM_TYPE_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	userTable,
} from "@/db/schema"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { getSessionFromCookie } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"

// ============================================================================
// Types
// ============================================================================

export interface TeammateInvite {
	id: string
	email: string
	expiresAt: Date | null
	acceptedAt: Date | null
	team: {
		id: string
		name: string
		slug: string
	}
	competition: {
		id: string
		name: string
		slug: string
	} | null
	division: {
		id: string
		label: string
	} | null
	captain: {
		id: string
		firstName: string | null
		lastName: string | null
		email: string | null
	} | null
}

export interface VolunteerInvite {
	id: string
	email: string
	expiresAt: Date | null
	acceptedAt: Date | null
	status: string
	inviteSource: "direct" | "application"
	signupName?: string
	credentials?: string
	roleTypes: string[]
	team: {
		id: string
		name: string
	}
	competition: {
		id: string
		name: string
		slug: string
	} | null
}

// ============================================================================
// Input Schemas
// ============================================================================

const getInviteByTokenSchema = z.object({
	token: z.string().min(1, "Token is required"),
})

const checkEmailExistsSchema = z.object({
	email: z.string().email("Invalid email address"),
})

const acceptTeamInvitationSchema = z.object({
	token: z.string().min(1, "Token is required"),
})

const acceptVolunteerInviteSchema = z.object({
	token: z.string().min(1, "Token is required"),
	availability: z
		.enum([
			VOLUNTEER_AVAILABILITY.MORNING,
			VOLUNTEER_AVAILABILITY.AFTERNOON,
			VOLUNTEER_AVAILABILITY.ALL_DAY,
		])
		.default(VOLUNTEER_AVAILABILITY.ALL_DAY),
	availabilityNotes: z.string().optional(),
	credentials: z.string().optional(),
	signupPhone: z.string().optional(),
})

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get teammate invite by token (for invite page)
 * Returns invite details including competition context from competition_team metadata.
 */
export const getTeammateInviteFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getInviteByTokenSchema.parse(data))
	.handler(async ({ data }): Promise<TeammateInvite | null> => {
		const db = getDb()

		// Find the invitation by token
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, data.token),
			with: {
				team: true,
			},
		})

		if (!invitation) {
			return null
		}

		const team = Array.isArray(invitation.team)
			? invitation.team[0]
			: invitation.team

		// Check if this is a competition team invite
		if (team?.type !== TEAM_TYPE_ENUM.COMPETITION_TEAM) {
			return null // Not a competition team invite
		}

		// Parse competition metadata
		let competitionContext: {
			competitionId?: string
			divisionId?: string
		} = {}

		if (team.competitionMetadata) {
			try {
				competitionContext = JSON.parse(team.competitionMetadata)
			} catch {
				// Invalid JSON, ignore
			}
		}

		// Get competition details
		let competition = null
		let division = null

		if (competitionContext.competitionId) {
			const competitionResult = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, competitionContext.competitionId),
			})
			competition = competitionResult

			if (competitionContext.divisionId) {
				division = await db.query.scalingLevelsTable.findFirst({
					where: eq(scalingLevelsTable.id, competitionContext.divisionId),
				})
			}
		}

		// Get the captain info from the registration
		let captain = null
		if (competitionContext.competitionId) {
			const registration =
				await db.query.competitionRegistrationsTable.findFirst({
					where: and(
						eq(
							competitionRegistrationsTable.eventId,
							competitionContext.competitionId,
						),
						eq(competitionRegistrationsTable.athleteTeamId, team.id),
					),
					with: {
						captain: true,
					},
				})

			if (registration) {
				const captainUser = Array.isArray(registration.captain)
					? registration.captain[0]
					: registration.captain
				if (captainUser) {
					captain = {
						id: captainUser.id,
						firstName: captainUser.firstName,
						lastName: captainUser.lastName,
						email: captainUser.email,
					}
				}
			}
		}

		return {
			id: invitation.id,
			email: invitation.email,
			expiresAt: invitation.expiresAt ? new Date(invitation.expiresAt) : null,
			acceptedAt: invitation.acceptedAt
				? new Date(invitation.acceptedAt)
				: null,
			team: {
				id: team.id,
				name: team.name,
				slug: team.slug,
			},
			competition: competition
				? {
						id: competition.id,
						name: competition.name,
						slug: competition.slug,
					}
				: null,
			division: division
				? {
						id: division.id,
						label: division.label,
					}
				: null,
			captain,
		}
	})

/**
 * Get volunteer invite by token (for invite page)
 * Returns volunteer invite details including competition context.
 */
export const getVolunteerInviteFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getInviteByTokenSchema.parse(data))
	.handler(async ({ data }): Promise<VolunteerInvite | null> => {
		const db = getDb()

		// Find the invitation by token
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, data.token),
			with: {
				team: true,
			},
		})

		if (!invitation) {
			return null
		}

		// Check if this is a volunteer invite
		if (
			invitation.roleId !== SYSTEM_ROLES_ENUM.VOLUNTEER ||
			invitation.isSystemRole !== 1
		) {
			return null // Not a volunteer invite
		}

		const team = Array.isArray(invitation.team)
			? invitation.team[0]
			: invitation.team

		if (!team) {
			return null
		}

		// Get competition that uses this team (competition team)
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.competitionTeamId, team.id),
		})

		// Parse volunteer metadata
		let volunteerMetadata: Partial<VolunteerMembershipMetadata> = {}

		if (invitation.metadata) {
			try {
				volunteerMetadata = JSON.parse(invitation.metadata)
			} catch {
				// Invalid JSON, ignore
			}
		}

		// Determine invite source - fallback to heuristics for legacy data
		const inviteSource =
			volunteerMetadata.inviteSource ||
			(invitation.invitedBy ? "direct" : "application")

		return {
			id: invitation.id,
			email: invitation.email,
			expiresAt: invitation.expiresAt ? new Date(invitation.expiresAt) : null,
			acceptedAt: invitation.acceptedAt
				? new Date(invitation.acceptedAt)
				: null,
			status: volunteerMetadata.status || "pending",
			inviteSource,
			signupName: volunteerMetadata.signupName,
			credentials: volunteerMetadata.credentials,
			roleTypes: volunteerMetadata.volunteerRoleTypes || [],
			team: {
				id: team.id,
				name: team.name,
			},
			competition: competition
				? {
						id: competition.id,
						name: competition.name,
						slug: competition.slug,
					}
				: null,
		}
	})

/**
 * Check if an email address already has an account
 */
export const checkEmailExistsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => checkEmailExistsSchema.parse(data))
	.handler(async ({ data }): Promise<boolean> => {
		const db = getDb()

		const user = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email.toLowerCase()),
			columns: { id: true },
		})

		return !!user
	})

/**
 * Get current session info for invite pages
 */
export const getSessionInfoFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			return null
		}
		return {
			userId: session.userId,
			email: session.user.email,
		}
	},
)

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Accept a team invitation
 */
export const acceptTeamInvitationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => acceptTeamInvitationSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()

		if (!session) {
			throw new Error("NOT_AUTHORIZED: Not authenticated")
		}

		const db = getDb()
		const MAX_TEAMS_JOINED_PER_USER = 100

		// Find the invitation by token
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, data.token),
		})

		if (!invitation) {
			throw new Error("NOT_FOUND: Invitation not found")
		}

		// Check if invitation has expired
		if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
			throw new Error("Invitation has expired")
		}

		// Check if invitation was already accepted
		if (invitation.acceptedAt) {
			throw new Error("CONFLICT: Invitation has already been accepted")
		}

		// Check if user's email matches the invitation email (case-insensitive)
		if (session.user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
			throw new Error(
				"FORBIDDEN: This invitation is for a different email address",
			)
		}

		// Check if user is already a member
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, invitation.teamId),
				eq(teamMembershipTable.userId, session.userId),
			),
		})

		if (existingMembership) {
			// Mark invitation as accepted
			await db
				.update(teamInvitationTable)
				.set({
					acceptedAt: new Date(),
					acceptedBy: session.userId,
					updatedAt: new Date(),
				})
				.where(eq(teamInvitationTable.id, invitation.id))

			throw new Error("CONFLICT: You are already a member of this team")
		}

		// Check if user has reached their team joining limit
		const teamsCountResult = await db
			.select({ value: count() })
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.userId, session.userId))

		const teamsJoined = teamsCountResult[0]?.value || 0

		if (teamsJoined >= MAX_TEAMS_JOINED_PER_USER) {
			throw new Error(
				`FORBIDDEN: You have reached the limit of ${MAX_TEAMS_JOINED_PER_USER} teams you can join.`,
			)
		}

		// Add user to the team
		await db.insert(teamMembershipTable).values({
			teamId: invitation.teamId,
			userId: session.userId,
			roleId: invitation.roleId,
			isSystemRole: Number(invitation.isSystemRole),
			invitedBy: invitation.invitedBy,
			invitedAt: invitation.createdAt
				? new Date(invitation.createdAt)
				: new Date(),
			joinedAt: new Date(),
			isActive: 1,
			metadata: invitation.metadata,
		})

		// Mark invitation as accepted
		await db
			.update(teamInvitationTable)
			.set({
				acceptedAt: new Date(),
				acceptedBy: session.userId,
				updatedAt: new Date(),
			})
			.where(eq(teamInvitationTable.id, invitation.id))

		// Update the user's session to include this team
		await updateAllSessionsOfUser(session.userId)

		// Get team from invitation to check type and return team slug
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, invitation.teamId),
		})
		if (!team) {
			throw new Error("NOT_FOUND: Team not found")
		}

		// Handle competition_team type - also add user to competition_event team
		let registrationId: string | null = null
		let competitionId: string | null = null
		let competitionName: string | null = null
		let competitionSlug: string | null = null
		let divisionName: string | null = null
		let hasWaivers = false

		if (
			team.type === TEAM_TYPE_ENUM.COMPETITION_TEAM &&
			team.competitionMetadata
		) {
			try {
				const metadata = JSON.parse(team.competitionMetadata) as {
					competitionId?: string
					divisionId?: string
				}
				if (metadata.competitionId) {
					competitionId = metadata.competitionId

					// Add to competition event team
					const competition = await db.query.competitionsTable.findFirst({
						where: eq(competitionsTable.id, metadata.competitionId),
					})

					if (competition) {
						competitionName = competition.name
						competitionSlug = competition.slug

						// Check if user is already a member
						const existingEventMembership =
							await db.query.teamMembershipTable.findFirst({
								where: and(
									eq(teamMembershipTable.teamId, competition.competitionTeamId),
									eq(teamMembershipTable.userId, session.userId),
								),
							})

						if (!existingEventMembership) {
							await db.insert(teamMembershipTable).values({
								teamId: competition.competitionTeamId,
								userId: session.userId,
								roleId: SYSTEM_ROLES_ENUM.MEMBER,
								isSystemRole: 1,
								joinedAt: new Date(),
								isActive: 1,
							})
						}

						// Find the registration for this team
						const registration =
							await db.query.competitionRegistrationsTable.findFirst({
								where: and(
									eq(
										competitionRegistrationsTable.eventId,
										metadata.competitionId,
									),
									eq(competitionRegistrationsTable.athleteTeamId, team.id),
								),
								with: {
									division: {
										columns: { label: true },
									},
								},
							})

						if (registration) {
							registrationId = registration.id
							const div = Array.isArray(registration.division)
								? registration.division[0]
								: registration.division
							divisionName = div?.label || null
						}

						// Check if competition has waivers
						const { waiversTable } = await import("@/db/schemas/waivers")
						const waivers = await db.query.waiversTable.findMany({
							where: eq(waiversTable.competitionId, metadata.competitionId),
							columns: { id: true },
						})
						hasWaivers = waivers.length > 0

						// Clear from pendingTeammates on the registration
						if (session.user.email) {
							const registrations =
								await db.query.competitionRegistrationsTable.findMany({
									where: eq(
										competitionRegistrationsTable.eventId,
										metadata.competitionId,
									),
								})

							for (const reg of registrations) {
								if (!reg.pendingTeammates) continue

								try {
									const pending = JSON.parse(reg.pendingTeammates) as Array<{
										email: string
										affiliateName?: string | null
									}>
									const updatedPending = pending.filter(
										(t) =>
											t.email.toLowerCase() !==
											session.user.email?.toLowerCase(),
									)

									if (updatedPending.length !== pending.length) {
										await db
											.update(competitionRegistrationsTable)
											.set({
												pendingTeammates:
													updatedPending.length > 0
														? JSON.stringify(updatedPending)
														: null,
											})
											.where(eq(competitionRegistrationsTable.id, reg.id))
										break
									}
								} catch {
									// Ignore JSON parse errors
								}
							}
						}
					}
				}
			} catch {
				// Ignore JSON parse errors
			}
		}

		return {
			success: true,
			teamId: invitation.teamId,
			teamSlug: team.slug,
			teamName: team.name,
			registrationId,
			competitionId,
			competitionName,
			competitionSlug,
			divisionName,
			hasWaivers,
		}
	})

/**
 * Accept a direct volunteer invitation with additional volunteer data
 */
export const acceptVolunteerInviteFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => acceptVolunteerInviteSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("NOT_AUTHORIZED: Not authenticated")
		}

		const db = getDb()
		const MAX_TEAMS_JOINED_PER_USER = 100

		// Find the invitation by token
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, data.token),
		})

		if (!invitation) {
			throw new Error("NOT_FOUND: Invitation not found")
		}

		// Verify this is a volunteer invitation
		if (
			invitation.roleId !== SYSTEM_ROLES_ENUM.VOLUNTEER ||
			invitation.isSystemRole !== 1
		) {
			throw new Error("This is not a volunteer invitation")
		}

		// Check if invitation has expired
		if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
			throw new Error("Invitation has expired")
		}

		// Check if invitation was already accepted
		if (invitation.acceptedAt) {
			throw new Error("CONFLICT: Invitation has already been accepted")
		}

		// Check if user's email matches the invitation email (case-insensitive)
		if (session.user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
			throw new Error(
				"FORBIDDEN: This invitation is for a different email address",
			)
		}

		// Check if user is already a member
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, invitation.teamId),
				eq(teamMembershipTable.userId, session.userId),
			),
		})

		if (existingMembership) {
			// Mark invitation as accepted
			await db
				.update(teamInvitationTable)
				.set({
					acceptedAt: new Date(),
					acceptedBy: session.userId,
					updatedAt: new Date(),
				})
				.where(eq(teamInvitationTable.id, invitation.id))

			throw new Error(
				"CONFLICT: You are already a volunteer for this competition",
			)
		}

		// Check if user has reached their team joining limit
		const teamsCountResult = await db
			.select({ value: count() })
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.userId, session.userId))

		const teamsJoined = teamsCountResult[0]?.value || 0

		if (teamsJoined >= MAX_TEAMS_JOINED_PER_USER) {
			throw new Error(
				`FORBIDDEN: You have reached the limit of ${MAX_TEAMS_JOINED_PER_USER} teams you can join.`,
			)
		}

		// Parse existing invitation metadata and merge with user-provided data
		let existingMetadata: Record<string, unknown> = {}
		if (invitation.metadata) {
			try {
				existingMetadata = JSON.parse(invitation.metadata)
			} catch {
				// Invalid JSON, ignore
			}
		}

		// Merge user-provided volunteer data with existing metadata
		const mergedMetadata = {
			...existingMetadata,
			availability: data.availability,
			availabilityNotes: data.availabilityNotes,
			credentials: data.credentials,
			signupPhone: data.signupPhone,
			// Mark as approved since user is accepting a direct invite
			status: "approved",
		}

		// Add user to the team with merged metadata
		await db.insert(teamMembershipTable).values({
			teamId: invitation.teamId,
			userId: session.userId,
			roleId: invitation.roleId,
			isSystemRole: Number(invitation.isSystemRole),
			invitedBy: invitation.invitedBy,
			invitedAt: invitation.createdAt
				? new Date(invitation.createdAt)
				: new Date(),
			joinedAt: new Date(),
			isActive: 1,
			metadata: JSON.stringify(mergedMetadata),
		})

		// Mark invitation as accepted
		await db
			.update(teamInvitationTable)
			.set({
				acceptedAt: new Date(),
				acceptedBy: session.userId,
				updatedAt: new Date(),
			})
			.where(eq(teamInvitationTable.id, invitation.id))

		// Update the user's session to include this team
		await updateAllSessionsOfUser(session.userId)

		// Get team to return competition info
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, invitation.teamId),
		})

		return {
			success: true,
			teamId: invitation.teamId,
			teamSlug: team?.slug,
		}
	})
