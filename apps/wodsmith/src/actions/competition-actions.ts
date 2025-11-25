"use server"

import { revalidatePath } from "next/cache"
import { createServerAction, ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"
import {
	createCompetitionGroup,
	deleteCompetitionGroup,
	getCompetitionGroup,
	getCompetitionGroups,
	updateCompetitionGroup,
} from "@/server/competitions"
import {
	createCompetitionGroupSchema,
	deleteCompetitionGroupSchema,
	getCompetitionGroupSchema,
	getCompetitionGroupsSchema,
	updateCompetitionGroupSchema,
} from "@/schemas/competitions"

/* -------------------------------------------------------------------------- */
/*                        Competition Group Actions                           */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition group (series)
 */
export const createCompetitionGroupAction = createServerAction()
	.input(createCompetitionGroupSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has programming management permission (reusing for competitions)
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const result = await createCompetitionGroup(input)

			// Revalidate competition pages
			revalidatePath("/admin/teams/[teamId]/competitions")
			revalidatePath("/admin/teams/[teamId]/competitions/series")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create competition series:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to create competition series")
		}
	})

/**
 * Get all competition groups for an organizing team
 */
export const getCompetitionGroupsAction = createServerAction()
	.input(getCompetitionGroupsSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has access to team
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const groups = await getCompetitionGroups(input.organizingTeamId)

			return { success: true, data: groups }
		} catch (error) {
			console.error("Failed to get competition groups:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competition series")
		}
	})

/**
 * Get a single competition group
 */
export const getCompetitionGroupAction = createServerAction()
	.input(getCompetitionGroupSchema)
	.handler(async ({ input }) => {
		try {
			const group = await getCompetitionGroup(input.groupId)

			if (!group) {
				throw new ZSAError("NOT_FOUND", "Competition series not found")
			}

			// Check if user has access to the organizing team
			await requireTeamPermission(
				group.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			return { success: true, data: group }
		} catch (error) {
			console.error("Failed to get competition group:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competition series")
		}
	})

/**
 * Update a competition group
 */
export const updateCompetitionGroupAction = createServerAction()
	.input(updateCompetitionGroupSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has programming management permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const { organizingTeamId: _organizingTeamId, ...updateData } = input
			const result = await updateCompetitionGroup(
				input.groupId,
				updateData,
			)

			// Revalidate competition pages
			revalidatePath("/admin/teams/[teamId]/competitions")
			revalidatePath("/admin/teams/[teamId]/competitions/series")
			revalidatePath(`/admin/teams/[teamId]/competitions/series/${input.groupId}`)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update competition series:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to update competition series")
		}
	})

/**
 * Delete a competition group
 */
export const deleteCompetitionGroupAction = createServerAction()
	.input(deleteCompetitionGroupSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has programming management permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteCompetitionGroup(input.groupId)

			// Revalidate competition pages
			revalidatePath("/admin/teams/[teamId]/competitions")
			revalidatePath("/admin/teams/[teamId]/competitions/series")

			return { success: true }
		} catch (error) {
			console.error("Failed to delete competition series:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to delete competition series")
		}
	})
