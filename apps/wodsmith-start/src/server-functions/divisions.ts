import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "~/db/schemas/teams"
import {
	addCompetitionDivision,
	deleteCompetitionDivision,
	getCompetitionDivisionsWithCounts,
	initializeCompetitionDivisions,
	reorderCompetitionDivisions,
	updateCompetitionDivision,
	updateCompetitionDivisionDescription,
} from "~/server/competition-divisions"
import { getSessionFromCookie } from "~/utils/auth.server"
import { hasTeamPermission } from "~/utils/team-auth.server"

/**
 * Initialize divisions for a competition from a template or with defaults
 */
export const initializeCompetitionDivisionsFn = createServerFn({
	method: "POST",
})
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			templateGroupId: z.string().optional(),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No permission to manage competitions")
			}

			const result = await initializeCompetitionDivisions({
				competitionId: input.competitionId,
				teamId: input.teamId,
				templateGroupId: input.templateGroupId,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to initialize divisions:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to initialize divisions")
		}
	})

/**
 * Get divisions for a competition with registration counts
 */
export const getCompetitionDivisionsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			if (!hasAccess) {
				throw new Error("No access to this team")
			}

			const result = await getCompetitionDivisionsWithCounts({
				competitionId: input.competitionId,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get divisions:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get divisions")
		}
	})

/**
 * Add a new division to a competition
 */
export const addCompetitionDivisionFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			label: z.string().min(1, "Division name is required").max(100),
			teamSize: z.number().int().min(1).max(10).default(1),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No permission to manage competitions")
			}

			const result = await addCompetitionDivision({
				competitionId: input.competitionId,
				teamId: input.teamId,
				label: input.label,
				teamSize: input.teamSize,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to add division:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to add division")
		}
	})

/**
 * Update a division label
 */
export const updateCompetitionDivisionFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			divisionId: z.string().min(1, "Division ID is required"),
			label: z.string().min(1, "Division name is required").max(100),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No permission to manage competitions")
			}

			await updateCompetitionDivision({
				competitionId: input.competitionId,
				teamId: input.teamId,
				divisionId: input.divisionId,
				label: input.label,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to update division:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update division")
		}
	})

/**
 * Delete a division (blocked if registrations exist)
 */
export const deleteCompetitionDivisionFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			divisionId: z.string().min(1, "Division ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No permission to manage competitions")
			}

			const result = await deleteCompetitionDivision({
				competitionId: input.competitionId,
				teamId: input.teamId,
				divisionId: input.divisionId,
			})

			if (!result.success) {
				throw new Error(result.error ?? "Failed to delete division")
			}

			return { success: true }
		} catch (error) {
			console.error("Failed to delete division:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to delete division")
		}
	})

/**
 * Reorder divisions (drag and drop)
 */
export const reorderCompetitionDivisionsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			orderedDivisionIds: z
				.array(z.string())
				.min(1, "Division IDs are required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No permission to manage competitions")
			}

			await reorderCompetitionDivisions({
				competitionId: input.competitionId,
				teamId: input.teamId,
				orderedDivisionIds: input.orderedDivisionIds,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder divisions:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to reorder divisions")
		}
	})

/**
 * Update a division's description
 */
export const updateDivisionDescriptionFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			divisionId: z.string().min(1, "Division ID is required"),
			description: z.string().max(2000).nullable(),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No permission to manage competitions")
			}

			await updateCompetitionDivisionDescription({
				competitionId: input.competitionId,
				teamId: input.teamId,
				divisionId: input.divisionId,
				description: input.description,
			})

			return { success: true }
		} catch (error) {
			console.error("Failed to update division description:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update description")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Public Division Functions                          */
/* -------------------------------------------------------------------------- */

/**
 * Get divisions for a competition (public wrapper)
 */
export const getDivisionsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const result = await getCompetitionDivisionsWithCounts({
				competitionId: input.competitionId,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get divisions:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get divisions")
		}
	})

/**
 * Get divisions for a competition with registration counts
 */
export const getCompetitionDivisionsWithCountsFn = createServerFn({
	method: "POST",
})
	.validator(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const result = await getCompetitionDivisionsWithCounts({
				competitionId: input.competitionId,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get divisions with counts:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get divisions")
		}
	})

/**
 * List scaling groups for a competition
 */
export const listScalingGroupsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			// TODO: Implement scaling groups listing
			// This should return the scaling groups available for divisions
			return { success: true, data: [] }
		} catch (error) {
			console.error("Failed to list scaling groups:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to list scaling groups")
		}
	})
