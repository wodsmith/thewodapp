"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { acceptTeamInvitation } from "@/server/team-members"
import {
	createTeam,
	deleteTeam,
	getOwnedTeams,
	getTeam,
	getUserTeams,
	updateTeam,
} from "@/server/teams"
import { requireVerifiedEmail, setActiveTeamCookie } from "@/utils/auth"

// Update team schema
const updateTeamSchema = z.object({
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

const deleteTeamSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const getTeamSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const createTeamSchema = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
})

export const createTeamAction = createServerAction()
	.input(createTeamSchema)
	.handler(async ({ input }) => {
		try {
			const result = await createTeam(input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create team")
		}
	})

/**
 * Update team details server action
 */
export const updateTeamAction = createServerAction()
	.input(updateTeamSchema)
	.handler(async ({ input }) => {
		try {
			const result = await updateTeam(input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update team")
		}
	})

/**
 * Delete team server action
 */
export const deleteTeamAction = createServerAction()
	.input(deleteTeamSchema)
	.handler(async ({ input }) => {
		try {
			await deleteTeam(input.teamId)
			return { success: true }
		} catch (error) {
			console.error("Failed to delete team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to delete team")
		}
	})

/**
 * Get all teams for the current user
 */
export const getUserTeamsAction = createServerAction().handler(async () => {
	try {
		const teams = await getUserTeams()
		return { success: true, data: teams }
	} catch (error) {
		console.error("Failed to get user teams:", error)

		if (error instanceof ZSAError) {
			throw error
		}

		throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get user teams")
	}
})

/**
 * Get a team by ID
 */
export const getTeamAction = createServerAction()
	.input(getTeamSchema)
	.handler(async ({ input }) => {
		try {
			const team = await getTeam(input.teamId)
			return { success: true, data: team }
		} catch (error) {
			console.error(`Failed to get team ${input.teamId}:`, error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get team")
		}
	})

/**
 * Get teams owned by the current user
 */
export const getOwnedTeamsAction = createServerAction().handler(async () => {
	try {
		const teams = await getOwnedTeams()
		return { success: true, data: teams }
	} catch (error) {
		console.error("Failed to get owned teams:", error)

		if (error instanceof ZSAError) {
			throw error
		}

		throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get owned teams")
	}
})

const setActiveTeamSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

/**
 * Set the active team cookie for the current user
 * Validates that the user is a member of the team before setting
 */
export const setActiveTeamAction = createServerAction()
	.input(setActiveTeamSchema)
	.handler(async ({ input }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.teams) {
				throw new ZSAError("NOT_AUTHORIZED", "No teams found in session")
			}

			// Validate that the team exists in user's session
			const team = session.teams.find((t) => t.id === input.teamId)

			if (!team) {
				throw new ZSAError("FORBIDDEN", "You are not a member of this team")
			}

			// Verify user has at least ACCESS_DASHBOARD permission
			if (!team.permissions.includes(TEAM_PERMISSIONS.ACCESS_DASHBOARD)) {
				throw new ZSAError(
					"FORBIDDEN",
					"You do not have permission to access this team",
				)
			}

			// Set the active team cookie
			await setActiveTeamCookie(input.teamId)

			return { success: true, teamId: input.teamId, teamName: team.name }
		} catch (error) {
			console.error("Failed to set active team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to set active team")
		}
	})

const acceptTeamInvitationSchema = z.object({
	token: z.string().min(1, "Invitation token is required"),
})

/**
 * Accept a team invitation
 */
export const acceptTeamInvitationAction = createServerAction()
	.input(acceptTeamInvitationSchema)
	.handler(async ({ input }) => {
		try {
			const result = await acceptTeamInvitation(input.token)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to accept team invitation:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("ERROR", "Failed to accept team invitation")
		}
	})
