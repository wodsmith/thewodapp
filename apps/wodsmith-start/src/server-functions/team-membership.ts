import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	acceptTeamInvitation,
	cancelTeamInvitation,
	getPendingInvitationsForCurrentUser,
	getTeamInvitations,
	getTeamMembers,
	inviteUserToTeam,
	removeTeamMember,
	updateTeamMemberRole,
} from "~/server/team-members"
import { getSessionFromCookie } from "~/utils/auth.server"
import { getPostHogClient } from "~/lib/posthog-server"
import { logError } from "~/lib/logging/posthog-otel-logger"

// Invite user schema
const inviteUserSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	email: z.string().email("Invalid email").max(255, "Email is too long"),
	roleId: z.string().min(1, "Role is required"),
	isSystemRole: z.boolean().optional().default(true),
})

// Update member role schema
const updateMemberRoleSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	userId: z.string().min(1, "User ID is required"),
	roleId: z.string().min(1, "Role is required"),
	isSystemRole: z.boolean().optional().default(true),
})

const teamIdSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const removeMemberSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	userId: z.string().min(1, "User ID is required"),
})

const invitationIdSchema = z.object({
	invitationId: z.string().min(1, "Invitation ID is required"),
})

const invitationTokenSchema = z.object({
	token: z.string().min(1, "Invitation token is required"),
})

/**
 * Invite a user to a team
 */
export const inviteUserFn = createServerFn({ method: "POST" })
	.validator(inviteUserSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await inviteUserToTeam(input)

			// Track team invite event server-side
			const session = await getSessionFromCookie()
			if (session?.userId) {
				const posthog = getPostHogClient()
				posthog.capture({
					distinctId: session.userId,
					event: "team_invite_sent",
					properties: {
						team_id: input.teamId,
						role_id: input.roleId,
						is_system_role: input.isSystemRole,
					},
				})
			}

			return { success: true, data: result }
		} catch (error) {
			logError({
				message: "[inviteUserFn] Failed to invite user",
				error,
				attributes: { teamId: input.teamId, roleId: input.roleId },
			})
			throw error
		}
	})

/**
 * Get team members
 */
export const getTeamMembersFn = createServerFn({ method: "POST" })
	.validator(teamIdSchema)
	.handler(async ({ data: input }) => {
		try {
			const members = await getTeamMembers(input.teamId)
			return { success: true, data: members }
		} catch (error) {
			logError({
				message: "[getTeamMembersFn] Failed to get team members",
				error,
				attributes: { teamId: input.teamId },
			})
			throw error
		}
	})

/**
 * Update a team member's role
 */
export const updateMemberRoleFn = createServerFn({ method: "POST" })
	.validator(updateMemberRoleSchema)
	.handler(async ({ data: input }) => {
		try {
			await updateTeamMemberRole(input)
			return { success: true }
		} catch (error) {
			logError({
				message: "[updateMemberRoleFn] Failed to update member role",
				error,
				attributes: {
					teamId: input.teamId,
					userId: input.userId,
					roleId: input.roleId,
				},
			})
			throw error
		}
	})

/**
 * Remove a team member
 */
export const removeTeamMemberFn = createServerFn({ method: "POST" })
	.validator(removeMemberSchema)
	.handler(async ({ data: input }) => {
		try {
			await removeTeamMember(input)
			return { success: true }
		} catch (error) {
			logError({
				message: "[removeTeamMemberFn] Failed to remove team member",
				error,
				attributes: { teamId: input.teamId, userId: input.userId },
			})
			throw error
		}
	})

/**
 * Get pending team invitations for a team
 */
export const getTeamInvitationsFn = createServerFn({ method: "POST" })
	.validator(teamIdSchema)
	.handler(async ({ data: input }) => {
		try {
			const invitations = await getTeamInvitations(input.teamId)
			return { success: true, data: invitations }
		} catch (error) {
			logError({
				message: "[getTeamInvitationsFn] Failed to get team invitations",
				error,
				attributes: { teamId: input.teamId },
			})
			throw error
		}
	})

/**
 * Cancel a team invitation
 */
export const cancelInvitationFn = createServerFn({ method: "POST" })
	.validator(invitationIdSchema)
	.handler(async ({ data: input }) => {
		try {
			await cancelTeamInvitation(input.invitationId)
			return { success: true }
		} catch (error) {
			logError({
				message: "[cancelInvitationFn] Failed to cancel invitation",
				error,
				attributes: { invitationId: input.invitationId },
			})
			throw error
		}
	})

/**
 * Accept a team invitation
 */
export const acceptInvitationFn = createServerFn({ method: "POST" })
	.validator(invitationTokenSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await acceptTeamInvitation(input.token)
			return { success: true, data: result }
		} catch (error) {
			logError({
				message: "[acceptInvitationFn] Failed to accept invitation",
				error,
				attributes: { tokenPrefix: input.token.substring(0, 8) },
			})
			throw error
		}
	})

/**
 * Get pending team invitations for the current user
 */
export const getPendingInvitationsForCurrentUserFn = createServerFn(
	"GET",
	async () => {
		try {
			const invitations = await getPendingInvitationsForCurrentUser()
			return { success: true, data: invitations }
		} catch (error) {
			logError({
				message:
					"[getPendingInvitationsForCurrentUserFn] Failed to get pending team invitations",
				error,
			})
			throw error
		}
	},
)
