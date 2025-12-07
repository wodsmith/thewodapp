"use server"

import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import { logError } from "@/lib/logging/posthog-otel-logger"
import { getPostHogClient } from "@/lib/posthog-server"
import {
	acceptTeamInvitation,
	cancelTeamInvitation,
	getPendingInvitationsForCurrentUser,
	getTeamInvitations,
	getTeamMembers,
	inviteUserToTeam,
	removeTeamMember,
	updateTeamMemberRole,
} from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

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
export const inviteUserAction = createServerAction()
	.input(inviteUserSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
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
					message: "[inviteUserAction] Failed to invite user",
					error,
					attributes: { teamId: input.teamId, roleId: input.roleId },
				})

				if (error instanceof ZSAError) {
					throw error
				}

				throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to invite user")
			}
		}, RATE_LIMITS.TEAM_INVITE)
	})

/**
 * Get team members action
 */
export const getTeamMembersAction = createServerAction()
	.input(teamIdSchema)
	.handler(async ({ input }) => {
		try {
			const members = await getTeamMembers(input.teamId)
			return { success: true, data: members }
		} catch (error) {
			logError({
				message: "[getTeamMembersAction] Failed to get team members",
				error,
				attributes: { teamId: input.teamId },
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get team members")
		}
	})

/**
 * Update a team member's role
 */
export const updateMemberRoleAction = createServerAction()
	.input(updateMemberRoleSchema)
	.handler(async ({ input }) => {
		try {
			await updateTeamMemberRole(input)
			return { success: true }
		} catch (error) {
			logError({
				message: "[updateMemberRoleAction] Failed to update member role",
				error,
				attributes: { teamId: input.teamId, userId: input.userId, roleId: input.roleId },
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update member role",
			)
		}
	})

/**
 * Remove a team member
 */
export const removeTeamMemberAction = createServerAction()
	.input(removeMemberSchema)
	.handler(async ({ input }) => {
		try {
			await removeTeamMember(input)
			return { success: true }
		} catch (error) {
			logError({
				message: "[removeTeamMemberAction] Failed to remove team member",
				error,
				attributes: { teamId: input.teamId, userId: input.userId },
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to remove team member",
			)
		}
	})

/**
 * Get pending team invitations
 */
export const getTeamInvitationsAction = createServerAction()
	.input(teamIdSchema)
	.handler(async ({ input }) => {
		try {
			const invitations = await getTeamInvitations(input.teamId)
			return { success: true, data: invitations }
		} catch (error) {
			logError({
				message: "[getTeamInvitationsAction] Failed to get team invitations",
				error,
				attributes: { teamId: input.teamId },
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get team invitations",
			)
		}
	})

/**
 * Cancel a team invitation
 */
export const cancelInvitationAction = createServerAction()
	.input(invitationIdSchema)
	.handler(async ({ input }) => {
		try {
			await cancelTeamInvitation(input.invitationId)
			return { success: true }
		} catch (error) {
			logError({
				message: "[cancelInvitationAction] Failed to cancel invitation",
				error,
				attributes: { invitationId: input.invitationId },
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to cancel invitation")
		}
	})

/**
 * Accept a team invitation
 */
export const acceptInvitationAction = createServerAction()
	.input(invitationTokenSchema)
	.handler(async ({ input }) => {
		try {
			const result = await acceptTeamInvitation(input.token)
			return { success: true, data: result }
		} catch (error) {
			logError({
				message: "[acceptInvitationAction] Failed to accept invitation",
				error,
				attributes: { tokenPrefix: input.token.substring(0, 8) },
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to accept invitation")
		}
	})

/**
 * Get pending team invitations for the current user
 */
export const getPendingInvitationsForCurrentUserAction =
	createServerAction().handler(async () => {
		try {
			const invitations = await getPendingInvitationsForCurrentUser()
			return { success: true, data: invitations }
		} catch (error) {
			logError({
				message: "[getPendingInvitationsForCurrentUserAction] Failed to get pending team invitations",
				error,
			})

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get pending team invitations",
			)
		}
	})
