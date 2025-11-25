"use server"

import { revalidatePath } from "next/cache"
import { createServerAction, ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"
import { getSessionFromCookie } from "@/utils/auth"
import {
	cancelCompetitionRegistration,
	createCompetition,
	createCompetitionGroup,
	deleteCompetition,
	deleteCompetitionGroup,
	getCompetition,
	getCompetitionGroup,
	getCompetitionGroups,
	getCompetitionRegistrations,
	getCompetitions,
	getUserCompetitionRegistration,
	registerForCompetition,
	updateCompetition,
	updateCompetitionGroup,
} from "@/server/competitions"
import {
	cancelCompetitionRegistrationSchema,
	createCompetitionGroupSchema,
	createCompetitionSchema,
	deleteCompetitionGroupSchema,
	deleteCompetitionSchema,
	getCompetitionGroupSchema,
	getCompetitionGroupsSchema,
	getCompetitionRegistrationsSchema,
	getCompetitionSchema,
	getCompetitionsSchema,
	getUserCompetitionRegistrationSchema,
	registerForCompetitionSchema,
	updateCompetitionGroupSchema,
	updateCompetitionSchema,
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

/* -------------------------------------------------------------------------- */
/*                          Competition Actions                               */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition
 */
export const createCompetitionAction = createServerAction()
	.input(createCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has programming management permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const result = await createCompetition(input)

			// Revalidate competition pages
			revalidatePath("/admin/teams/[teamId]/competitions")
			if (input.groupId) {
				revalidatePath(`/admin/teams/[teamId]/competitions/series/${input.groupId}`)
			}

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to create competition")
		}
	})

/**
 * Get all competitions for an organizing team
 */
export const getCompetitionsAction = createServerAction()
	.input(getCompetitionsSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has access to team
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const competitions = await getCompetitions(input.organizingTeamId)

			return { success: true, data: competitions }
		} catch (error) {
			console.error("Failed to get competitions:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competitions")
		}
	})

/**
 * Get a single competition
 */
export const getCompetitionAction = createServerAction()
	.input(getCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			const competition = await getCompetition(input.idOrSlug)

			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			// Check if user has access to the organizing team
			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			return { success: true, data: competition }
		} catch (error) {
			console.error("Failed to get competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competition")
		}
	})

/**
 * Update a competition
 */
export const updateCompetitionAction = createServerAction()
	.input(updateCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has programming management permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const { organizingTeamId: _organizingTeamId, competitionId, ...rawUpdateData } = input
			// Convert null to undefined for fields that support it
			const updateData = {
				...rawUpdateData,
				description: rawUpdateData.description === null ? null : rawUpdateData.description,
				registrationOpensAt: rawUpdateData.registrationOpensAt === null ? null : rawUpdateData.registrationOpensAt,
				registrationClosesAt: rawUpdateData.registrationClosesAt === null ? null : rawUpdateData.registrationClosesAt,
				groupId: rawUpdateData.groupId === null || rawUpdateData.groupId === undefined ? null : rawUpdateData.groupId,
				settings: rawUpdateData.settings === null ? null : rawUpdateData.settings,
			}
			const result = await updateCompetition(competitionId, updateData)

			// Revalidate competition pages
			revalidatePath("/admin/teams/[teamId]/competitions")
			revalidatePath(`/admin/teams/[teamId]/competitions/${competitionId}`)
			if (result.groupId) {
				revalidatePath(`/admin/teams/[teamId]/competitions/series/${result.groupId}`)
			}

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to update competition")
		}
	})

/**
 * Delete a competition
 */
export const deleteCompetitionAction = createServerAction()
	.input(deleteCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			// Check if user has programming management permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteCompetition(input.competitionId)

			// Revalidate competition pages
			revalidatePath("/admin/teams/[teamId]/competitions")

			return { success: true }
		} catch (error) {
			console.error("Failed to delete competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to delete competition")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Registration Actions                               */
/* -------------------------------------------------------------------------- */

/**
 * Register for a competition
 */
export const registerForCompetitionAction = createServerAction()
	.input(registerForCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			// Get current user from session
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in to register")
			}

			// Validate user ID matches session
			if (input.userId !== session.userId) {
				throw new ZSAError("FORBIDDEN", "You can only register yourself")
			}

			const result = await registerForCompetition(input)

			// Revalidate competition pages
			revalidatePath(`/compete/${input.competitionId}`)
			revalidatePath("/compete/my-events")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to register for competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to register for competition")
		}
	})

/**
 * Get user's competition registration
 */
export const getUserCompetitionRegistrationAction = createServerAction()
	.input(getUserCompetitionRegistrationSchema)
	.handler(async ({ input }) => {
		try {
			// Get current user from session
			const session = await getSessionFromCookie()
			if (!session) {
				return { success: true, data: null }
			}

			// Validate user ID matches session
			if (input.userId !== session.userId) {
				throw new ZSAError("FORBIDDEN", "You can only view your own registration")
			}

			const registration = await getUserCompetitionRegistration(
				input.competitionId,
				input.userId,
			)

			return { success: true, data: registration }
		} catch (error) {
			console.error("Failed to get registration:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get registration")
		}
	})

/**
 * Get all registrations for a competition (admin only)
 */
export const getCompetitionRegistrationsAction = createServerAction()
	.input(getCompetitionRegistrationsSchema)
	.handler(async ({ input }) => {
		try {
			// Get competition first to verify permissions
			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			// Check if user has access to the organizing team
			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const registrations = await getCompetitionRegistrations(
				input.competitionId,
				input.divisionId,
			)

			return { success: true, data: registrations }
		} catch (error) {
			console.error("Failed to get competition registrations:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competition registrations")
		}
	})

/**
 * Cancel a competition registration
 */
export const cancelCompetitionRegistrationAction = createServerAction()
	.input(cancelCompetitionRegistrationSchema)
	.handler(async ({ input }) => {
		try {
			// Get current user from session
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in to cancel registration")
			}

			// Validate user ID matches session
			if (input.userId !== session.userId) {
				throw new ZSAError("FORBIDDEN", "You can only cancel your own registration")
			}

			const result = await cancelCompetitionRegistration(
				input.registrationId,
				input.userId,
			)

			// Revalidate competition pages
			revalidatePath(`/compete/${result.competitionId}`)
			revalidatePath("/compete")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to cancel registration:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to cancel registration")
		}
	})
