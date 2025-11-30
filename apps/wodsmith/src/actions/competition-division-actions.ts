"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	addCompetitionDivision,
	deleteCompetitionDivision,
	getCompetitionDivisionsWithCounts,
	initializeCompetitionDivisions,
	reorderCompetitionDivisions,
	updateCompetitionDivision,
	updateCompetitionDivisionDescription,
} from "@/server/competition-divisions"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"

/**
 * Initialize divisions for a competition from a template or with defaults
 */
export const initializeCompetitionDivisionsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			templateGroupId: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			const result = await initializeCompetitionDivisions({
				competitionId: input.competitionId,
				teamId: input.teamId,
				templateGroupId: input.templateGroupId,
			})

			revalidatePath(
				`/admin/teams/${input.teamId}/competitions/${input.competitionId}/divisions`,
			)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to initialize divisions:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to initialize divisions"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Get divisions for a competition with registration counts
 */
export const getCompetitionDivisionsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to this team")
			}

			const result = await getCompetitionDivisionsWithCounts({
				competitionId: input.competitionId,
			})

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get divisions:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get divisions")
		}
	})

/**
 * Add a new division to a competition
 */
export const addCompetitionDivisionAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			label: z.string().min(1, "Division name is required").max(100),
			teamSize: z.number().int().min(1).max(10).default(1),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			const result = await addCompetitionDivision({
				competitionId: input.competitionId,
				teamId: input.teamId,
				label: input.label,
				teamSize: input.teamSize,
			})

			revalidatePath(
				`/admin/teams/${input.teamId}/competitions/${input.competitionId}/divisions`,
			)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to add division:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to add division"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Update a division label
 */
export const updateCompetitionDivisionAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			divisionId: z.string().min(1, "Division ID is required"),
			label: z.string().min(1, "Division name is required").max(100),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			await updateCompetitionDivision({
				competitionId: input.competitionId,
				teamId: input.teamId,
				divisionId: input.divisionId,
				label: input.label,
			})

			revalidatePath(
				`/admin/teams/${input.teamId}/competitions/${input.competitionId}/divisions`,
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to update division:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to update division"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Delete a division (blocked if registrations exist)
 */
export const deleteCompetitionDivisionAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			divisionId: z.string().min(1, "Division ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			const result = await deleteCompetitionDivision({
				competitionId: input.competitionId,
				teamId: input.teamId,
				divisionId: input.divisionId,
			})

			if (!result.success) {
				throw new ZSAError("ERROR", result.error ?? "Failed to delete division")
			}

			revalidatePath(
				`/admin/teams/${input.teamId}/competitions/${input.competitionId}/divisions`,
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to delete division:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to delete division"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})

/**
 * Reorder divisions (drag and drop)
 */
export const reorderCompetitionDivisionsAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			orderedDivisionIds: z
				.array(z.string())
				.min(1, "Division IDs are required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			await reorderCompetitionDivisions({
				competitionId: input.competitionId,
				teamId: input.teamId,
				orderedDivisionIds: input.orderedDivisionIds,
			})

			revalidatePath(
				`/admin/teams/${input.teamId}/competitions/${input.competitionId}/divisions`,
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder divisions:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to reorder divisions")
		}
	})

/**
 * Update a division's description
 */
export const updateDivisionDescriptionAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
			competitionId: z.string().min(1, "Competition ID is required"),
			divisionId: z.string().min(1, "Division ID is required"),
			description: z.string().max(2000).nullable(),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const hasAccess = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No permission to manage competitions")
			}

			await updateCompetitionDivisionDescription({
				competitionId: input.competitionId,
				teamId: input.teamId,
				divisionId: input.divisionId,
				description: input.description,
			})

			revalidatePath(
				`/admin/teams/${input.teamId}/competitions/${input.competitionId}/divisions`,
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to update division description:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			const message =
				error instanceof Error ? error.message : "Failed to update description"
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})
