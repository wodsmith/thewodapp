/**
 * Invite Server Functions for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 * Functions for handling team and volunteer invitations
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	INVITATION_STATUS,
	SYSTEM_ROLES_ENUM,
	scalingLevelsTable,
	TEAM_TYPE_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { competitionRegistrationAnswersTable } from "@/db/schemas/competitions"
import type {
	PendingInviteAnswer,
	PendingInviteData,
	PendingWaiverSignature,
} from "@/db/schemas/teams"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { waiverSignaturesTable, waiversTable } from "@/db/schemas/waivers"
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
	answers: z
		.array(
			z.object({
				questionId: z.string().min(1),
				answer: z.string().max(5000),
			}),
		)
		.optional(),
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

const submitPendingInviteDataSchema = z.object({
	token: z.string().min(1, "Token is required"),
	answers: z
		.array(
			z.object({
				questionId: z.string().min(1),
				answer: z.string().max(5000),
			}),
		)
		.optional(),
	signatures: z
		.array(
			z.object({
				waiverId: z.string().min(1),
				signedAt: z.string(),
				signatureName: z.string().min(1),
			}),
		)
		.optional(),
})

const transferPendingDataSchema = z.object({
	token: z.string().min(1, "Token is required"),
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

		// Mark invitation as accepted (with account)
		await db
			.update(teamInvitationTable)
			.set({
				acceptedAt: new Date(),
				acceptedBy: session.userId,
				status: INVITATION_STATUS.ACCEPTED,
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

						// Merge answers from request data AND pending metadata
						let allAnswers = data.answers || []

						// Check for pending answers in invitation metadata (from guest form)
						if (invitation.metadata) {
							try {
								const inviteMetadata = JSON.parse(invitation.metadata) as Record<
									string,
									unknown
								>
								if (Array.isArray(inviteMetadata.pendingAnswers)) {
									const pendingAnswers =
										inviteMetadata.pendingAnswers as PendingInviteAnswer[]
									// Merge pending answers (pending takes precedence if duplicate)
									const answerMap = new Map<
										string,
										{ questionId: string; answer: string }
									>()
									for (const a of allAnswers) {
										answerMap.set(a.questionId, a)
									}
									for (const a of pendingAnswers) {
										answerMap.set(a.questionId, a)
									}
									allAnswers = Array.from(answerMap.values())
								}
							} catch {
								// Invalid JSON, ignore
							}
						}

						// Store teammate registration answers if provided
						if (allAnswers.length > 0 && registrationId) {
							for (const answerData of allAnswers) {
								// Check if answer already exists for this user/question/registration
								const existingAnswer =
									await db.query.competitionRegistrationAnswersTable.findFirst({
										where: and(
											eq(
												competitionRegistrationAnswersTable.questionId,
												answerData.questionId,
											),
											eq(
												competitionRegistrationAnswersTable.registrationId,
												registrationId,
											),
											eq(
												competitionRegistrationAnswersTable.userId,
												session.userId,
											),
										),
									})

								if (existingAnswer) {
									// Update existing answer
									await db
										.update(competitionRegistrationAnswersTable)
										.set({
											answer: answerData.answer,
											updatedAt: new Date(),
										})
										.where(
											eq(
												competitionRegistrationAnswersTable.id,
												existingAnswer.id,
											),
										)
								} else {
									// Insert new answer
									await db.insert(competitionRegistrationAnswersTable).values({
										questionId: answerData.questionId,
										registrationId: registrationId,
										userId: session.userId,
										answer: answerData.answer,
									})
								}
							}
						}

						// Transfer pending waiver signatures from invitation metadata
						if (invitation.metadata && registrationId) {
							try {
								const inviteMetadata = JSON.parse(invitation.metadata) as Record<
									string,
									unknown
								>
								if (Array.isArray(inviteMetadata.pendingSignatures)) {
									const pendingSignatures =
										inviteMetadata.pendingSignatures as PendingWaiverSignature[]
									for (const sigData of pendingSignatures) {
										// Check if signature already exists
										const existingSig =
											await db.query.waiverSignaturesTable.findFirst({
												where: and(
													eq(waiverSignaturesTable.waiverId, sigData.waiverId),
													eq(waiverSignaturesTable.userId, session.userId),
												),
											})

										if (!existingSig) {
											await db.insert(waiverSignaturesTable).values({
												waiverId: sigData.waiverId,
												userId: session.userId,
												signedAt: new Date(sigData.signedAt),
												registrationId,
											})
										}
									}
								}

								// Clear pending data from metadata now that it's transferred
								delete inviteMetadata.pendingAnswers
								delete inviteMetadata.pendingSignatures
								delete inviteMetadata.submittedAt

								await db
									.update(teamInvitationTable)
									.set({
										metadata:
											Object.keys(inviteMetadata).length > 0
												? JSON.stringify(inviteMetadata)
												: null,
									})
									.where(eq(teamInvitationTable.id, invitation.id))
							} catch {
								// Invalid JSON, ignore
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

		// Mark invitation as accepted (with account)
		await db
			.update(teamInvitationTable)
			.set({
				acceptedAt: new Date(),
				acceptedBy: session.userId,
				status: INVITATION_STATUS.ACCEPTED,
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

// ============================================================================
// Pending Invite Data Functions (Guest/Unauthenticated)
// ============================================================================

/**
 * Submit pending invite data (answers/signatures) without authentication.
 * Stores data in invitation.metadata JSON field for later transfer.
 */
export const submitPendingInviteDataFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => submitPendingInviteDataSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

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

		// Parse existing metadata
		let existingMetadata: Record<string, unknown> = {}
		if (invitation.metadata) {
			try {
				existingMetadata = JSON.parse(invitation.metadata)
			} catch {
				// Invalid JSON, ignore
			}
		}

		// Build pending data
		const pendingData: PendingInviteData = {
			submittedAt: new Date().toISOString(),
		}

		if (data.answers && data.answers.length > 0) {
			pendingData.pendingAnswers = data.answers.map((a) => ({
				questionId: a.questionId,
				answer: a.answer,
			}))
		}

		if (data.signatures && data.signatures.length > 0) {
			pendingData.pendingSignatures = data.signatures.map((s) => ({
				waiverId: s.waiverId,
				signedAt: s.signedAt,
				signatureName: s.signatureName,
			}))
		}

		// Merge with existing metadata
		const updatedMetadata = {
			...existingMetadata,
			...pendingData,
		}

		// Update invitation metadata and set status to accepted
		// Guest has submitted their form data - this is acceptance without account
		await db
			.update(teamInvitationTable)
			.set({
				metadata: JSON.stringify(updatedMetadata),
				status: INVITATION_STATUS.ACCEPTED,
				updatedAt: new Date(),
			})
			.where(eq(teamInvitationTable.id, invitation.id))

		return {
			success: true,
			inviteId: invitation.id,
		}
	})

/**
 * Retrieve pending invite data by token (for pre-filling forms).
 */
export const getPendingInviteDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getInviteByTokenSchema.parse(data))
	.handler(async ({ data }): Promise<PendingInviteData | null> => {
		const db = getDb()

		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, data.token),
		})

		if (!invitation || !invitation.metadata) {
			return null
		}

		try {
			const metadata = JSON.parse(invitation.metadata) as Record<
				string,
				unknown
			>

			// Extract pending data fields
			const pendingData: PendingInviteData = {}

			if (typeof metadata.submittedAt === "string") {
				pendingData.submittedAt = metadata.submittedAt
			}

			if (Array.isArray(metadata.pendingAnswers)) {
				pendingData.pendingAnswers =
					metadata.pendingAnswers as PendingInviteAnswer[]
			}

			if (Array.isArray(metadata.pendingSignatures)) {
				pendingData.pendingSignatures =
					metadata.pendingSignatures as PendingWaiverSignature[]
			}

			return Object.keys(pendingData).length > 0 ? pendingData : null
		} catch {
			return null
		}
	})

/**
 * Transfer pending invite data to real tables after authentication.
 * Called after user accepts invite.
 */
export const transferPendingDataToUserFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => transferPendingDataSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()

		if (!session) {
			throw new Error("NOT_AUTHORIZED: Not authenticated")
		}

		const db = getDb()

		// Find the invitation by token
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.token, data.token),
			with: {
				team: true,
			},
		})

		if (!invitation) {
			throw new Error("NOT_FOUND: Invitation not found")
		}

		// Check if user's email matches the invitation email (case-insensitive)
		if (session.user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
			throw new Error(
				"FORBIDDEN: This invitation is for a different email address",
			)
		}

		// Parse metadata to get pending data
		let pendingData: PendingInviteData | null = null
		if (invitation.metadata) {
			try {
				const metadata = JSON.parse(invitation.metadata) as Record<
					string,
					unknown
				>
				pendingData = {
					submittedAt:
						typeof metadata.submittedAt === "string"
							? metadata.submittedAt
							: undefined,
					pendingAnswers: Array.isArray(metadata.pendingAnswers)
						? (metadata.pendingAnswers as PendingInviteAnswer[])
						: undefined,
					pendingSignatures: Array.isArray(metadata.pendingSignatures)
						? (metadata.pendingSignatures as PendingWaiverSignature[])
						: undefined,
				}
			} catch {
				// Invalid JSON, ignore
			}
		}

		if (!pendingData) {
			return { success: true, transferred: false }
		}

		const team = Array.isArray(invitation.team)
			? invitation.team[0]
			: invitation.team

		// Get competition metadata to find registrationId
		let registrationId: string | null = null
		if (
			team?.type === TEAM_TYPE_ENUM.COMPETITION_TEAM &&
			team.competitionMetadata
		) {
			try {
				const competitionMetadata = JSON.parse(team.competitionMetadata) as {
					competitionId?: string
				}
				if (competitionMetadata.competitionId) {
					const registration =
						await db.query.competitionRegistrationsTable.findFirst({
							where: and(
								eq(
									competitionRegistrationsTable.eventId,
									competitionMetadata.competitionId,
								),
								eq(competitionRegistrationsTable.athleteTeamId, team.id),
							),
						})

					if (registration) {
						registrationId = registration.id
					}
				}
			} catch {
				// Invalid JSON, ignore
			}
		}

		// Transfer pending answers
		if (
			pendingData.pendingAnswers &&
			pendingData.pendingAnswers.length > 0 &&
			registrationId
		) {
			for (const answerData of pendingData.pendingAnswers) {
				// Check if answer already exists
				const existingAnswer =
					await db.query.competitionRegistrationAnswersTable.findFirst({
						where: and(
							eq(
								competitionRegistrationAnswersTable.questionId,
								answerData.questionId,
							),
							eq(
								competitionRegistrationAnswersTable.registrationId,
								registrationId,
							),
							eq(competitionRegistrationAnswersTable.userId, session.userId),
						),
					})

				if (existingAnswer) {
					// Update existing answer
					await db
						.update(competitionRegistrationAnswersTable)
						.set({
							answer: answerData.answer,
							updatedAt: new Date(),
						})
						.where(
							eq(competitionRegistrationAnswersTable.id, existingAnswer.id),
						)
				} else {
					// Insert new answer
					await db.insert(competitionRegistrationAnswersTable).values({
						questionId: answerData.questionId,
						registrationId,
						userId: session.userId,
						answer: answerData.answer,
					})
				}
			}
		}

		// Transfer pending signatures
		if (
			pendingData.pendingSignatures &&
			pendingData.pendingSignatures.length > 0
		) {
			for (const signatureData of pendingData.pendingSignatures) {
				// Check if signature already exists
				const existingSignature =
					await db.query.waiverSignaturesTable.findFirst({
						where: and(
							eq(waiverSignaturesTable.waiverId, signatureData.waiverId),
							eq(waiverSignaturesTable.userId, session.userId),
						),
					})

				if (!existingSignature) {
					// Insert new signature (signatureName is stored in pending data only, not in table)
					await db.insert(waiverSignaturesTable).values({
						waiverId: signatureData.waiverId,
						userId: session.userId,
						signedAt: new Date(signatureData.signedAt),
						registrationId: registrationId || undefined,
					})
				}
			}
		}

		// Clear pending data from metadata
		if (invitation.metadata) {
			try {
				const metadata = JSON.parse(invitation.metadata) as Record<
					string,
					unknown
				>
				delete metadata.submittedAt
				delete metadata.pendingAnswers
				delete metadata.pendingSignatures

				await db
					.update(teamInvitationTable)
					.set({
						metadata:
							Object.keys(metadata).length > 0
								? JSON.stringify(metadata)
								: null,
						updatedAt: new Date(),
					})
					.where(eq(teamInvitationTable.id, invitation.id))
			} catch {
				// Invalid JSON, ignore
			}
		}

		return {
			success: true,
			transferred: true,
			answersCount: pendingData.pendingAnswers?.length || 0,
			signaturesCount: pendingData.pendingSignatures?.length || 0,
		}
	})
