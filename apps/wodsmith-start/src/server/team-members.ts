/**
 * Team Members Server Module for TanStack Start
 * This file uses top-level imports for server-only modules.
 * Functions for managing team memberships and invitations
 */
import { createId } from "@paralleldrive/cuid2"
import { and, count, eq, isNull } from "drizzle-orm"
import { MAX_TEAMS_JOINED_PER_USER } from "@/constants"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	TEAM_PERMISSIONS,
	TEAM_TYPE_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { addToCompetitionEventTeam } from "@/server/registration"
import { notifyTeammateJoined } from "@/server/notifications"
import { getSessionFromCookie } from "@/utils/auth"
import { sendTeamInvitationEmail } from "@/utils/email"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { requireTeamPermission } from "@/utils/team-auth"

/**
 * Invite a user to join a team
 *
 * @param skipPermissionCheck - Skip the INVITE_MEMBERS permission check.
 *   Use this when permission was already checked against a different team
 *   (e.g., checking organizing team permissions for competition team invites)
 */
export async function inviteUserToTeam({
	teamId,
	email,
	roleId,
	isSystemRole = true,
	metadata,
	skipPermissionCheck = false,
}: {
	teamId: string
	email: string
	roleId: string
	isSystemRole?: boolean
	metadata?: string
	skipPermissionCheck?: boolean
}): Promise<{
	success: boolean
	userJoined?: boolean
	userId?: string
	invitationSent?: boolean
	invitationId?: string
}> {
	// Check if user has permission to invite members (unless caller already checked)
	if (!skipPermissionCheck) {
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.INVITE_MEMBERS)
	}

	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("NOT_AUTHORIZED: Not authenticated")
	}

	const db = getDb()

	// Get team name for email
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		throw new Error("NOT_FOUND: Team not found")
	}

	// Prevent inviting members to personal teams
	if (team.isPersonalTeam) {
		throw new Error("FORBIDDEN: Cannot invite members to a personal team")
	}

	// Check if user is already a member
	const existingUser = await db.query.userTable.findFirst({
		where: eq(userTable.email, email),
	})

	if (existingUser) {
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, teamId),
				eq(teamMembershipTable.userId, existingUser.id),
			),
		})

		if (existingMembership) {
			throw new Error("CONFLICT: User is already a member of this team")
		}

		// User exists but is not a member, add them directly
		await db.insert(teamMembershipTable).values({
			teamId,
			userId: existingUser.id,
			roleId,
			isSystemRole: isSystemRole ? 1 : 0,
			invitedBy: session.userId,
			invitedAt: new Date(),
			joinedAt: new Date(),
			isActive: 1,
			metadata,
		})

		// Update the user's session to include this team
		await updateAllSessionsOfUser(existingUser.id)

		return {
			success: true,
			userJoined: true,
			userId: existingUser.id,
		}
	}

	// User doesn't exist, create an invitation
	const token = createId()
	const expiresAt = new Date()
	expiresAt.setDate(expiresAt.getDate() + 7) // Valid for 7 days

	// Check if there's an existing invitation
	const existingInvitation = await db.query.teamInvitationTable.findFirst({
		where: and(
			eq(teamInvitationTable.teamId, teamId),
			eq(teamInvitationTable.email, email),
		),
	})

	if (existingInvitation) {
		// Update the existing invitation
		await db
			.update(teamInvitationTable)
			.set({
				roleId,
				isSystemRole: isSystemRole ? 1 : 0,
				token,
				expiresAt,
				invitedBy: session.userId,
				acceptedAt: null,
				acceptedBy: null,
				updatedAt: new Date(),
				metadata,
			})
			.where(eq(teamInvitationTable.id, existingInvitation.id))

		// Get inviter name for email
		const inviter = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.userId),
			columns: { firstName: true, lastName: true },
		})
		const inviterName = inviter
			? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
				"A team member"
			: "A team member"

		// Send invitation email
		await sendTeamInvitationEmail({
			email,
			invitationToken: token,
			teamName: team.name,
			inviterName,
		})

		return {
			success: true,
			invitationSent: true,
			invitationId: existingInvitation.id,
		}
	}

	const newInvitation = await db
		.insert(teamInvitationTable)
		.values({
			teamId,
			email,
			roleId,
			isSystemRole: isSystemRole ? 1 : 0,
			token,
			invitedBy: session.userId,
			expiresAt,
			metadata,
		})
		.returning()

	const invitation = newInvitation?.[0]

	if (!invitation) {
		throw new Error("ERROR: Could not create invitation")
	}

	// Get inviter name for email
	const inviter = await db.query.userTable.findFirst({
		where: eq(userTable.id, session.userId),
		columns: { firstName: true, lastName: true },
	})
	const inviterName = inviter
		? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
			"A team member"
		: "A team member"

	// Send invitation email
	await sendTeamInvitationEmail({
		email,
		invitationToken: token,
		teamName: team.name,
		inviterName,
	})

	return {
		success: true,
		invitationSent: true,
		invitationId: invitation.id,
	}
}

/**
 * Accept a team invitation
 */
export async function acceptTeamInvitation(token: string): Promise<{
	success: boolean
	teamId: string
	teamSlug: string
	teamName: string
}> {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("NOT_AUTHORIZED: Not authenticated")
	}

	const db = getDb()

	// Find the invitation by token
	const invitation = await db.query.teamInvitationTable.findFirst({
		where: eq(teamInvitationTable.token, token),
	})

	if (!invitation) {
		throw new Error("NOT_FOUND: Invitation not found")
	}

	// Check if invitation has expired
	if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
		throw new Error("ERROR: Invitation has expired")
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

	// Get team from invitation to check type and return team info
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, invitation.teamId),
	})

	if (!team) {
		throw new Error("NOT_FOUND: Team not found")
	}

	// Handle competition_team type - also add user to competition_event team
	if (
		team.type === TEAM_TYPE_ENUM.COMPETITION_TEAM &&
		team.competitionMetadata
	) {
		try {
			const metadata = JSON.parse(team.competitionMetadata) as {
				competitionId?: string
			}
			if (metadata.competitionId) {
				// Add user to competition_event team
				await addToCompetitionEventTeam(session.userId, metadata.competitionId)

				// Send teammate joined notification to captain (non-blocking)
				// Notification failure shouldn't prevent user from joining the team
				const registration =
					await db.query.competitionRegistrationsTable.findFirst({
						where: eq(
							competitionRegistrationsTable.athleteTeamId,
							invitation.teamId,
						),
					})

				if (registration?.captainUserId) {
					try {
						await notifyTeammateJoined({
							captainUserId: registration.captainUserId,
							newTeammateUserId: session.userId,
							competitionTeamId: invitation.teamId,
							competitionId: metadata.competitionId,
						})
					} catch (notifyError) {
						// Log but don't fail - notification is non-critical
						console.error(
							"[team-members] Failed to send teammate joined notification:",
							notifyError,
						)
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
	}
}

/**
 * Get pending invitations for a team
 */
export async function getTeamInvitations(teamId: string) {
	// Check if user has permission to view invitations
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.INVITE_MEMBERS)

	const db = getDb()

	// Get invitations that have not been accepted
	const invitations = await db.query.teamInvitationTable.findMany({
		where: and(
			eq(teamInvitationTable.teamId, teamId),
			isNull(teamInvitationTable.acceptedAt),
		),
		with: {
			invitedByUser: {
				columns: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					avatar: true,
				},
			},
		},
	})

	return invitations.map((invitation) => ({
		id: invitation.id,
		email: invitation.email,
		roleId: invitation.roleId,
		isSystemRole: Boolean(invitation.isSystemRole),
		createdAt: new Date(invitation.createdAt),
		expiresAt: invitation.expiresAt ? new Date(invitation.expiresAt) : null,
		invitedBy: (() => {
			const user = Array.isArray(invitation.invitedByUser)
				? invitation.invitedByUser[0]
				: invitation.invitedByUser
			return {
				id: user?.id,
				firstName: user?.firstName,
				lastName: user?.lastName,
				email: user?.email,
				avatar: user?.avatar,
			}
		})(),
	}))
}

/**
 * Cancel a team invitation
 */
export async function cancelTeamInvitation(invitationId: string) {
	const db = getDb()

	// Find the invitation
	const invitation = await db.query.teamInvitationTable.findFirst({
		where: eq(teamInvitationTable.id, invitationId),
	})

	if (!invitation) {
		throw new Error("NOT_FOUND: Invitation not found")
	}

	// Check if user has permission to cancel invitations for this team
	await requireTeamPermission(
		invitation.teamId,
		TEAM_PERMISSIONS.INVITE_MEMBERS,
	)

	// Delete the invitation
	await db
		.delete(teamInvitationTable)
		.where(eq(teamInvitationTable.id, invitationId))

	return { success: true }
}
