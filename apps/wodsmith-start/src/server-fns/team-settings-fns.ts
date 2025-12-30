/**
 * Team Settings Server Functions for TanStack Start
 * Functions for team management (CRUD, members, invitations)
 *
 * Note: Some team functions already exist in team-fns.ts (getActiveTeamFn, getTeamLeaderboardsFn)
 * and invite-fns.ts (acceptTeamInvitationFn) - not duplicated here.
 */

import { createId } from "@paralleldrive/cuid2"
import { ZSAError } from "@repo/zsa"
import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, isNull, not } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	TEAM_TYPE_ENUM,
	type Team,
	type TeamMembership,
	teamInvitationTable,
	teamMembershipTable,
	teamRoleTable,
	teamSubscriptionTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { generateSlug } from "@/utils/slugify"
import { requireTeamPermission } from "./requireTeamMembership"

// ============================================================================
// Constants
// ============================================================================

const MAX_TEAMS_JOINED_PER_USER = 100

// ============================================================================
// Type Definitions
// ============================================================================

/** User fields included in team member queries */
type MemberUser = {
	id: string
	firstName: string | null
	lastName: string | null
	email: string | null
	avatar: string | null
}

/** Membership with user relation included */
type TeamMembershipWithUser = TeamMembership & {
	user: MemberUser | null
}

/** Membership with team relation included */
type TeamMembershipWithTeam = TeamMembership & {
	team: Team | null
}

export interface TeamMemberInfo {
	id: string
	userId: string
	roleId: string
	roleName: string
	isSystemRole: boolean
	isActive: boolean
	joinedAt: Date | null
	user: {
		id: string | undefined
		firstName: string | null | undefined
		lastName: string | null | undefined
		email: string | null | undefined
		avatar: string | null | undefined
	}
}

export interface TeamInvitationInfo {
	id: string
	email: string
	roleId: string
	isSystemRole: boolean
	createdAt: Date
	expiresAt: Date | null
	invitedBy: {
		id: string | undefined
		firstName: string | null | undefined
		lastName: string | null | undefined
		email: string | null | undefined
		avatar: string | null | undefined
	}
}

// ============================================================================
// Input Schemas
// ============================================================================

const createTeamInputSchema = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
})

const updateTeamInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	data: z.object({
		name: z
			.string()
			.min(1, "Name is required")
			.max(100, "Name is too long")
			.optional(),
		description: z.string().max(1000, "Description is too long").optional(),
		avatarUrl: z
			.string()
			.url("Invalid avatar URL")
			.max(600, "URL is too long")
			.optional(),
		billingEmail: z
			.string()
			.email("Invalid email")
			.max(255, "Email is too long")
			.optional(),
		settings: z.string().max(10000, "Settings are too large").optional(),
	}),
})

const deleteTeamInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const teamIdSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const teamSlugSchema = z.object({
	slug: z.string().min(1, "Slug is required"),
})

const inviteUserInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	email: z.string().email("Invalid email").max(255, "Email is too long"),
	roleId: z.string().min(1, "Role is required"),
	isSystemRole: z.boolean().optional().default(true),
})

const cancelInvitationInputSchema = z.object({
	invitationId: z.string().min(1, "Invitation ID is required"),
})

const updateMemberRoleInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	userId: z.string().min(1, "User ID is required"),
	roleId: z.string().min(1, "Role is required"),
	isSystemRole: z.boolean().optional().default(true),
})

const removeTeamMemberInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	userId: z.string().min(1, "User ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Require verified email authentication
 */
async function requireVerifiedEmail() {
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new Error("Not authenticated")
	}
	if (!session.user.emailVerified) {
		throw new Error("Email not verified")
	}
	return session
}

// ============================================================================
// Server Functions - Team CRUD
// ============================================================================

/**
 * Create a new team with the current user as owner
 */
export const createTeamFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createTeamInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await requireVerifiedEmail()
		const userId = session.userId
		const db = getDb()

		// Generate unique slug for the team
		let slug = generateSlug(data.name)
		let slugIsUnique = false
		let attempts = 0

		// Make sure slug is unique
		while (!slugIsUnique && attempts < 5) {
			const existingTeam = await db.query.teamTable.findFirst({
				where: eq(teamTable.slug, slug),
			})

			if (!existingTeam) {
				slugIsUnique = true
			} else {
				// Add a random suffix to make the slug unique
				slug = `${generateSlug(data.name)}-${createId().substring(0, 4)}`
				attempts++
			}
		}

		if (!slugIsUnique) {
			throw new ZSAError(
				"ERROR",
				"Could not generate a unique slug for the team",
			)
		}

		// Insert the team with default free plan
		const newTeam = (await db
			.insert(teamTable)
			.values({
				name: data.name,
				slug,
				description: data.description,
				creditBalance: 0,
				currentPlanId: "free", // All new teams start on free plan
			})
			.returning()) as unknown as Array<typeof teamTable.$inferInsert>

		const team = Array.isArray(newTeam) ? newTeam[0] : undefined
		if (!team || !team.id) {
			throw new ZSAError("ERROR", "Could not create team")
		}

		const teamId: string = team.id

		// Add the creator as an owner
		await db.insert(teamMembershipTable).values({
			teamId,
			userId,
			roleId: SYSTEM_ROLES_ENUM.OWNER,
			isSystemRole: 1,
			invitedBy: userId,
			invitedAt: new Date(),
			joinedAt: new Date(),
			isActive: 1,
		})

		// Create default custom role for the team
		await db.insert(teamRoleTable).values({
			teamId,
			name: "Editor",
			description: "Can edit team content",
			permissions: [
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
				TEAM_PERMISSIONS.CREATE_COMPONENTS,
				TEAM_PERMISSIONS.EDIT_COMPONENTS,
			],
			isEditable: 1,
		})

		// Create team subscription for free plan
		const now = new Date()
		const oneMonthFromNow = new Date(now)
		oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)

		await db.insert(teamSubscriptionTable).values({
			teamId,
			planId: "free",
			status: "active",
			currentPeriodStart: now,
			currentPeriodEnd: oneMonthFromNow,
			cancelAtPeriodEnd: 0,
		})

		// Update the user's session to include the new team
		await updateAllSessionsOfUser(userId)

		return {
			success: true,
			data: {
				teamId,
				name: data.name,
				slug,
			},
		}
	})

/**
 * Update a team's details
 */
export const updateTeamFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateTeamInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Check if user has permission to update team settings
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
		)

		const db = getDb()

		// If name is being updated, check if we need to update the slug
		if (data.data.name) {
			const currentTeam = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, data.teamId),
			})

			if (currentTeam && currentTeam.name !== data.data.name) {
				// Generate new slug based on the new name
				let newSlug = generateSlug(data.data.name)
				let slugIsUnique = false
				let attempts = 0

				while (!slugIsUnique && attempts < 5) {
					const existingTeam = await db.query.teamTable.findFirst({
						where: and(
							eq(teamTable.slug, newSlug),
							// Make sure we don't check against our own team
							not(eq(teamTable.id, data.teamId)),
						),
					})

					if (!existingTeam) {
						slugIsUnique = true
					} else {
						// Add a random suffix to make the slug unique
						newSlug = `${generateSlug(data.data.name)}-${createId().substring(0, 4)}`
						attempts++
					}
				}

				if (!slugIsUnique) {
					throw new ZSAError(
						"ERROR",
						"Could not generate a unique slug for the team",
					)
				}

				// Update team with new slug
				await db
					.update(teamTable)
					.set({
						...data.data,
						slug: newSlug,
					})
					.where(eq(teamTable.id, data.teamId))

				return { success: true, data: { ...data.data, slug: newSlug } }
			}
		}

		// Update team without changing slug
		await db
			.update(teamTable)
			.set(data.data)
			.where(eq(teamTable.id, data.teamId))

		return { success: true, data: data.data }
	})

/**
 * Delete a team
 */
export const deleteTeamFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteTeamInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Check if user has permission to delete team
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.DELETE_TEAM)

		const db = getDb()

		// Get all user IDs from the team memberships to update their sessions later
		const memberships = await db.query.teamMembershipTable.findMany({
			where: eq(teamMembershipTable.teamId, data.teamId),
			columns: {
				userId: true,
			},
		})

		const userIds = [...new Set(memberships.map((m) => m.userId))]

		// Delete team and related data
		await db.delete(teamTable).where(eq(teamTable.id, data.teamId))

		// Update sessions for all affected users
		for (const userId of userIds) {
			await updateAllSessionsOfUser(userId)
		}

		return { success: true }
	})

/**
 * Get all teams for the current user
 */
export const getUserTeamsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await requireVerifiedEmail()
		const db = getDb()

		const userTeams = (await db.query.teamMembershipTable.findMany({
			where: eq(teamMembershipTable.userId, session.userId),
			with: {
				team: true,
			},
		})) as TeamMembershipWithTeam[]

		// Filter out competition-related teams (competition_event and competition_team)
		const teams = userTeams
			.map((membership) => membership.team)
			.filter(
				(team): team is Team =>
					team !== null &&
					team.type !== TEAM_TYPE_ENUM.COMPETITION_EVENT &&
					team.type !== TEAM_TYPE_ENUM.COMPETITION_TEAM,
			)

		return { success: true, data: teams }
	},
)

/**
 * Get a team by slug
 */
export const getTeamBySlugFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamSlugSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.slug, data.slug),
		})

		if (!team) {
			throw new ZSAError("NOT_FOUND", "Team not found")
		}

		// Check if user is a member of this team
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		return { success: true, data: team }
	})

// ============================================================================
// Server Functions - Team Members
// ============================================================================

/**
 * Get all members of a team
 */
export const getTeamMembersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(
		async ({ data }): Promise<{ success: boolean; data: TeamMemberInfo[] }> => {
			// Check if user has access to the team
			await requireTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const db = getDb()

			const members = (await db.query.teamMembershipTable.findMany({
				where: eq(teamMembershipTable.teamId, data.teamId),
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
			})) as TeamMembershipWithUser[]

			// Get all team roles for this team (for custom roles)
			const teamRoles = await db.query.teamRoleTable.findMany({
				where: eq(teamRoleTable.teamId, data.teamId),
			})

			// Map roles by ID for easy lookup
			const roleMap = new Map(teamRoles.map((role) => [role.id, role.name]))

			const memberInfos: TeamMemberInfo[] = members.map((member) => {
				let roleName = "Unknown"

				// For system roles, use the roleId directly as the name
				if (member.isSystemRole) {
					// Capitalize the first letter for display
					roleName =
						member.roleId.charAt(0).toUpperCase() + member.roleId.slice(1)
				} else {
					// For custom roles, look up the name in our roleMap
					roleName = roleMap.get(member.roleId) || "Custom Role"
				}

				// Handle user relation - can be array or single object
				const user = Array.isArray(member.user) ? member.user[0] : member.user

				return {
					id: member.id,
					userId: member.userId,
					roleId: member.roleId,
					roleName,
					isSystemRole: Boolean(member.isSystemRole),
					isActive: Boolean(member.isActive),
					joinedAt: member.joinedAt ? new Date(member.joinedAt) : null,
					user: {
						id: user?.id,
						firstName: user?.firstName,
						lastName: user?.lastName,
						email: user?.email,
						avatar: user?.avatar,
					},
				}
			})

			return { success: true, data: memberInfos }
		},
	)

/**
 * Update a team member's role
 */
export const updateMemberRoleFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateMemberRoleInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Check if user has permission to change member roles
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.CHANGE_MEMBER_ROLES,
		)

		const db = getDb()

		// Get team info to check if it's a personal team
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, data.teamId),
		})

		if (!team) {
			throw new ZSAError("NOT_FOUND", "Team not found")
		}

		// Prevent role changes in personal teams
		if (team.isPersonalTeam) {
			throw new ZSAError("FORBIDDEN", "Cannot change roles in a personal team")
		}

		// Verify membership exists
		const membership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, data.teamId),
				eq(teamMembershipTable.userId, data.userId),
			),
		})

		if (!membership) {
			throw new ZSAError("NOT_FOUND", "Team membership not found")
		}

		// Update the role
		await db
			.update(teamMembershipTable)
			.set({
				roleId: data.roleId,
				isSystemRole: data.isSystemRole ? 1 : 0,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(teamMembershipTable.teamId, data.teamId),
					eq(teamMembershipTable.userId, data.userId),
				),
			)

		// Update the user's session to reflect the new role
		await updateAllSessionsOfUser(data.userId)

		return { success: true }
	})

/**
 * Remove a member from a team
 */
export const removeTeamMemberFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => removeTeamMemberInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Check if user has permission to remove members
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.REMOVE_MEMBERS)

		const db = getDb()

		// Get team info to check if it's a personal team
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, data.teamId),
		})

		if (!team) {
			throw new ZSAError("NOT_FOUND", "Team not found")
		}

		// Prevent removing members from personal teams
		if (team.isPersonalTeam) {
			throw new ZSAError(
				"FORBIDDEN",
				"Cannot remove members from a personal team",
			)
		}

		// Verify membership exists
		const membership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, data.teamId),
				eq(teamMembershipTable.userId, data.userId),
			),
		})

		if (!membership) {
			throw new ZSAError("NOT_FOUND", "Team membership not found")
		}

		// Don't allow removing an owner
		if (
			membership.roleId === SYSTEM_ROLES_ENUM.OWNER &&
			membership.isSystemRole
		) {
			throw new ZSAError("FORBIDDEN", "Cannot remove the team owner")
		}

		// Delete the membership
		await db
			.delete(teamMembershipTable)
			.where(
				and(
					eq(teamMembershipTable.teamId, data.teamId),
					eq(teamMembershipTable.userId, data.userId),
				),
			)

		// Update the user's session to remove this team
		await updateAllSessionsOfUser(data.userId)

		return { success: true }
	})

// ============================================================================
// Server Functions - Invitations
// ============================================================================

/**
 * Invite a user to join a team
 */
export const inviteUserFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => inviteUserInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Check if user has permission to invite members
		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.INVITE_MEMBERS)

		const session = await getSessionFromCookie()
		if (!session) {
			throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
		}

		const db = getDb()

		// Get team name for email
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, data.teamId),
		})

		if (!team) {
			throw new ZSAError("NOT_FOUND", "Team not found")
		}

		// Prevent inviting members to personal teams
		if (team.isPersonalTeam) {
			throw new ZSAError(
				"FORBIDDEN",
				"Cannot invite members to a personal team",
			)
		}

		// Check if user is already a member
		const existingUser = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email),
		})

		if (existingUser) {
			const existingMembership = await db.query.teamMembershipTable.findFirst({
				where: and(
					eq(teamMembershipTable.teamId, data.teamId),
					eq(teamMembershipTable.userId, existingUser.id),
				),
			})

			if (existingMembership) {
				throw new ZSAError("CONFLICT", "User is already a member of this team")
			}

			// Check if user has reached their team joining limit
			const teamsCountResult = await db
				.select({ value: count() })
				.from(teamMembershipTable)
				.where(eq(teamMembershipTable.userId, existingUser.id))

			const teamsJoined = teamsCountResult[0]?.value || 0

			if (teamsJoined >= MAX_TEAMS_JOINED_PER_USER) {
				throw new ZSAError(
					"FORBIDDEN",
					`This user has reached the limit of ${MAX_TEAMS_JOINED_PER_USER} teams they can join.`,
				)
			}

			// User exists but is not a member, add them directly
			await db.insert(teamMembershipTable).values({
				teamId: data.teamId,
				userId: existingUser.id,
				roleId: data.roleId,
				isSystemRole: data.isSystemRole ? 1 : 0,
				invitedBy: session.userId,
				invitedAt: new Date(),
				joinedAt: new Date(),
				isActive: 1,
			})

			// Update the user's session to include this team
			await updateAllSessionsOfUser(existingUser.id)

			return {
				success: true,
				data: {
					userJoined: true,
					userId: existingUser.id,
				},
			}
		}

		// User doesn't exist, create an invitation
		const token = createId()
		const expiresAt = new Date()
		expiresAt.setDate(expiresAt.getDate() + 7) // Valid for 7 days

		// Check if there's an existing invitation
		const existingInvitation = await db.query.teamInvitationTable.findFirst({
			where: and(
				eq(teamInvitationTable.teamId, data.teamId),
				eq(teamInvitationTable.email, data.email),
			),
		})

		if (existingInvitation) {
			// Update the existing invitation
			await db
				.update(teamInvitationTable)
				.set({
					roleId: data.roleId,
					isSystemRole: data.isSystemRole ? 1 : 0,
					token,
					expiresAt,
					invitedBy: session.userId,
					acceptedAt: null,
					acceptedBy: null,
					updatedAt: new Date(),
				})
				.where(eq(teamInvitationTable.id, existingInvitation.id))

			// TODO: Send invitation email

			return {
				success: true,
				data: {
					invitationSent: true,
					invitationId: existingInvitation.id,
				},
			}
		}

		const newInvitation = await db
			.insert(teamInvitationTable)
			.values({
				teamId: data.teamId,
				email: data.email,
				roleId: data.roleId,
				isSystemRole: data.isSystemRole ? 1 : 0,
				token,
				invitedBy: session.userId,
				expiresAt,
			})
			.returning()

		const invitation = newInvitation?.[0]

		if (!invitation) {
			throw new ZSAError("ERROR", "Could not create invitation")
		}

		// TODO: Send invitation email

		return {
			success: true,
			data: {
				invitationSent: true,
				invitationId: invitation.id,
			},
		}
	})

/**
 * Cancel a team invitation
 */
export const cancelInvitationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => cancelInvitationInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Find the invitation
		const invitation = await db.query.teamInvitationTable.findFirst({
			where: eq(teamInvitationTable.id, data.invitationId),
		})

		if (!invitation) {
			throw new ZSAError("NOT_FOUND", "Invitation not found")
		}

		// Check if user has permission to cancel invitations for this team
		await requireTeamPermission(
			invitation.teamId,
			TEAM_PERMISSIONS.INVITE_MEMBERS,
		)

		// Delete the invitation
		await db
			.delete(teamInvitationTable)
			.where(eq(teamInvitationTable.id, data.invitationId))

		return { success: true }
	})

/**
 * Get pending invitations for a team
 */
export const getTeamInvitationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{ success: boolean; data: TeamInvitationInfo[] }> => {
			// Check if user has permission to view invitations
			await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.INVITE_MEMBERS)

			const db = getDb()

			// Get invitations that have not been accepted
			const invitations = await db.query.teamInvitationTable.findMany({
				where: and(
					eq(teamInvitationTable.teamId, data.teamId),
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

			const invitationInfos: TeamInvitationInfo[] = invitations.map(
				(invitation) => {
					// Handle invitedByUser relation - can be array or single object
					const invitedByUser = Array.isArray(invitation.invitedByUser)
						? invitation.invitedByUser[0]
						: invitation.invitedByUser

					return {
						id: invitation.id,
						email: invitation.email,
						roleId: invitation.roleId,
						isSystemRole: Boolean(invitation.isSystemRole),
						createdAt: new Date(invitation.createdAt),
						expiresAt: invitation.expiresAt
							? new Date(invitation.expiresAt)
							: null,
						invitedBy: {
							id: invitedByUser?.id,
							firstName: invitedByUser?.firstName,
							lastName: invitedByUser?.lastName,
							email: invitedByUser?.email,
							avatar: invitedByUser?.avatar,
						},
					}
				},
			)

			return { success: true, data: invitationInfos }
		},
	)
