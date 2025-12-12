import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { createTeam, deleteTeam, getOwnedTeams, getTeam, getUserTeams, updateTeam } from "@/server/teams"
import { acceptTeamInvitation } from "@/server/team-members"
import { requireVerifiedEmail, setActiveTeamCookie } from "@/utils/auth.server"
import { TEAM_PERMISSIONS } from "@/db/schema.server"

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

const setActiveTeamSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const acceptTeamInvitationSchema = z.object({
	token: z.string().min(1, "Invitation token is required"),
})

/**
 * Create a new team
 */
export const createTeamFn = createServerFn({ method: "POST" })
	.validator(createTeamSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await createTeam(input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create team:", error)
			throw error
		}
	})

/**
 * Update team details
 */
export const updateTeamFn = createServerFn({ method: "POST" })
	.validator(updateTeamSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await updateTeam(input)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update team:", error)
			throw error
		}
	})

/**
 * Delete team
 */
export const deleteTeamFn = createServerFn({ method: "POST" })
	.validator(deleteTeamSchema)
	.handler(async ({ data: input }) => {
		try {
			await deleteTeam(input.teamId)
			return { success: true }
		} catch (error) {
			console.error("Failed to delete team:", error)
			throw error
		}
	})

/**
 * Get all teams for the current user
 */
export const getUserTeamsFn = createServerFn("GET", async () => {
	try {
		const teams = await getUserTeams()
		return { success: true, data: teams }
	} catch (error) {
		console.error("Failed to get user teams:", error)
		throw error
	}
})

/**
 * Get a team by ID
 */
export const getTeamFn = createServerFn({ method: "POST" })
	.validator(getTeamSchema)
	.handler(async ({ data: input }) => {
		try {
			const team = await getTeam(input.teamId)
			return { success: true, data: team }
		} catch (error) {
			console.error(`Failed to get team ${input.teamId}:`, error)
			throw error
		}
	})

/**
 * Get teams owned by the current user
 */
export const getOwnedTeamsFn = createServerFn("GET", async () => {
	try {
		const teams = await getOwnedTeams()
		return { success: true, data: teams }
	} catch (error) {
		console.error("Failed to get owned teams:", error)
		throw error
	}
})

/**
 * Set the active team cookie for the current user
 * Validates that the user is a member of the team before setting
 */
export const setActiveTeamFn = createServerFn({ method: "POST" })
	.validator(setActiveTeamSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await requireVerifiedEmail()

			if (!session?.teams) {
				throw new Error("No teams found in session")
			}

			// Validate that the team exists in user's session
			const team = session.teams.find((t) => t.id === input.teamId)

			if (!team) {
				throw new Error("You are not a member of this team")
			}

			// Verify user has at least ACCESS_DASHBOARD permission
			if (!team.permissions.includes(TEAM_PERMISSIONS.ACCESS_DASHBOARD)) {
				throw new Error("You do not have permission to access this team")
			}

			// Set the active team cookie
			await setActiveTeamCookie(input.teamId)

			return { success: true, teamId: input.teamId, teamName: team.name }
		} catch (error) {
			console.error("Failed to set active team:", error)
			throw error
		}
	})

/**
 * Accept a team invitation
 */
export const acceptTeamInvitationFn = createServerFn({ method: "POST" })
	.validator(acceptTeamInvitationSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await acceptTeamInvitation(input.token)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to accept team invitation:", error)
			throw error
		}
	})
