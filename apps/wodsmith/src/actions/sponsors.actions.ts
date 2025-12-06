"use server"

import { revalidatePath } from "next/cache"
import { createServerAction, ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	assignWorkoutSponsorSchema,
	createSponsorGroupSchema,
	createSponsorSchema,
	deleteSponsorGroupSchema,
	deleteSponsorSchema,
	reorderSponsorGroupsSchema,
	reorderSponsorsSchema,
	updateSponsorGroupSchema,
	updateSponsorSchema,
} from "@/schemas/sponsors.schema"
import {
	assignWorkoutSponsor,
	createSponsor,
	createSponsorGroup,
	deleteSponsor,
	deleteSponsorGroup,
	getCompetitionSponsorGroups,
	getCompetitionSponsors,
	getSponsor,
	getUserSponsors,
	reorderSponsorGroups,
	reorderSponsors,
	updateSponsor,
	updateSponsorGroup,
} from "@/server/sponsors"
import { getCompetition } from "@/server/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { z } from "zod"

/* -------------------------------------------------------------------------- */
/*                           Query Actions                                     */
/* -------------------------------------------------------------------------- */

/**
 * Get all sponsors for a competition, organized by groups
 */
export const getCompetitionSponsorsAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			// No auth required for reading - sponsors are public
			const result = await getCompetitionSponsors(input.competitionId)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get competition sponsors:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get competition sponsors",
			)
		}
	})

/**
 * Get all sponsor groups for a competition
 */
export const getCompetitionSponsorGroupsAction = createServerAction()
	.input(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const groups = await getCompetitionSponsorGroups(input.competitionId)
			return { success: true, data: groups }
		} catch (error) {
			console.error("Failed to get sponsor groups:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get sponsor groups",
			)
		}
	})

/**
 * Get all sponsors for the current user (athlete sponsors)
 */
export const getUserSponsorsAction = createServerAction()
	.input(z.object({}))
	.handler(async () => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const sponsors = await getUserSponsors(session.user.id)
			return { success: true, data: sponsors }
		} catch (error) {
			console.error("Failed to get user sponsors:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get user sponsors")
		}
	})

/**
 * Get a single sponsor
 */
export const getSponsorAction = createServerAction()
	.input(
		z.object({
			sponsorId: z.string().min(1, "Sponsor ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		try {
			const sponsor = await getSponsor(input.sponsorId)
			if (!sponsor) {
				throw new ZSAError("NOT_FOUND", "Sponsor not found")
			}
			return { success: true, data: sponsor }
		} catch (error) {
			console.error("Failed to get sponsor:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get sponsor")
		}
	})

/* -------------------------------------------------------------------------- */
/*                           Sponsor Group Actions                             */
/* -------------------------------------------------------------------------- */

/**
 * Create a sponsor group
 */
export const createSponsorGroupAction = createServerAction()
	.input(createSponsorGroupSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check permission via competition's organizing team
			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to manage this competition")
			}

			const group = await createSponsorGroup(input)

			revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)

			return { success: true, data: group }
		} catch (error) {
			console.error("Failed to create sponsor group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create sponsor group",
			)
		}
	})

/**
 * Update a sponsor group
 */
export const updateSponsorGroupAction = createServerAction()
	.input(updateSponsorGroupSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to manage this competition")
			}

			const group = await updateSponsorGroup(input)
			if (!group) {
				throw new ZSAError("NOT_FOUND", "Sponsor group not found")
			}

			revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)

			return { success: true, data: group }
		} catch (error) {
			console.error("Failed to update sponsor group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update sponsor group",
			)
		}
	})

/**
 * Delete a sponsor group
 */
export const deleteSponsorGroupAction = createServerAction()
	.input(deleteSponsorGroupSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to manage this competition")
			}

			const result = await deleteSponsorGroup(input)
			if (!result.success) {
				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					result.error || "Failed to delete",
				)
			}

			revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)

			return { success: true }
		} catch (error) {
			console.error("Failed to delete sponsor group:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete sponsor group",
			)
		}
	})

/**
 * Reorder sponsor groups
 */
export const reorderSponsorGroupsAction = createServerAction()
	.input(reorderSponsorGroupsSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to manage this competition")
			}

			await reorderSponsorGroups(input)

			revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder sponsor groups:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to reorder sponsor groups",
			)
		}
	})

/* -------------------------------------------------------------------------- */
/*                           Sponsor Actions                                   */
/* -------------------------------------------------------------------------- */

/**
 * Create a sponsor (competition or user)
 */
export const createSponsorAction = createServerAction()
	.input(createSponsorSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Validate authorization
			if (input.competitionId) {
				const competition = await getCompetition(input.competitionId)
				if (!competition) {
					throw new ZSAError("NOT_FOUND", "Competition not found")
				}

				const hasAccess = await hasTeamPermission(
					competition.organizingTeamId,
					TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
				)

				if (!hasAccess) {
					throw new ZSAError(
						"FORBIDDEN",
						"No access to manage this competition",
					)
				}
			} else if (input.userId) {
				// User sponsors can only be created for the current user
				if (input.userId !== session.user.id) {
					throw new ZSAError(
						"FORBIDDEN",
						"Cannot create sponsors for other users",
					)
				}
			} else {
				throw new ZSAError(
					"INPUT_PARSE_ERROR",
					"Either competitionId or userId is required",
				)
			}

			const sponsor = await createSponsor(input)

			if (input.competitionId) {
				revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)
			} else {
				revalidatePath("/compete/athlete")
			}

			return { success: true, data: sponsor }
		} catch (error) {
			console.error("Failed to create sponsor:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create sponsor")
		}
	})

/**
 * Update a sponsor
 */
export const updateSponsorAction = createServerAction()
	.input(updateSponsorSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Get existing sponsor to check ownership
			const existing = await getSponsor(input.sponsorId)
			if (!existing) {
				throw new ZSAError("NOT_FOUND", "Sponsor not found")
			}

			// Validate authorization
			if (existing.competitionId) {
				const competition = await getCompetition(existing.competitionId)
				if (!competition) {
					throw new ZSAError("NOT_FOUND", "Competition not found")
				}

				const hasAccess = await hasTeamPermission(
					competition.organizingTeamId,
					TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
				)

				if (!hasAccess) {
					throw new ZSAError(
						"FORBIDDEN",
						"No access to manage this competition",
					)
				}
			} else if (existing.userId) {
				if (existing.userId !== session.user.id) {
					throw new ZSAError(
						"FORBIDDEN",
						"Cannot update sponsors for other users",
					)
				}
			}

			const sponsor = await updateSponsor(input)
			if (!sponsor) {
				throw new ZSAError("NOT_FOUND", "Sponsor not found")
			}

			if (existing.competitionId) {
				revalidatePath(`/compete/organizer/${existing.competitionId}/sponsors`)
			} else {
				revalidatePath("/compete/athlete")
			}

			return { success: true, data: sponsor }
		} catch (error) {
			console.error("Failed to update sponsor:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update sponsor")
		}
	})

/**
 * Delete a sponsor
 */
export const deleteSponsorAction = createServerAction()
	.input(deleteSponsorSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Get existing sponsor to check ownership
			const existing = await getSponsor(input.sponsorId)
			if (!existing) {
				return { success: true } // Already deleted
			}

			// Validate authorization
			if (existing.competitionId) {
				const competition = await getCompetition(existing.competitionId)
				if (!competition) {
					throw new ZSAError("NOT_FOUND", "Competition not found")
				}

				const hasAccess = await hasTeamPermission(
					competition.organizingTeamId,
					TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
				)

				if (!hasAccess) {
					throw new ZSAError(
						"FORBIDDEN",
						"No access to manage this competition",
					)
				}
			} else if (existing.userId) {
				if (existing.userId !== session.user.id) {
					throw new ZSAError(
						"FORBIDDEN",
						"Cannot delete sponsors for other users",
					)
				}
			}

			const result = await deleteSponsor(input)
			if (!result.success) {
				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					result.error || "Failed to delete",
				)
			}

			if (existing.competitionId) {
				revalidatePath(`/compete/organizer/${existing.competitionId}/sponsors`)
			} else {
				revalidatePath("/compete/athlete")
			}

			return { success: true }
		} catch (error) {
			console.error("Failed to delete sponsor:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to delete sponsor")
		}
	})

/**
 * Reorder sponsors within a competition
 */
export const reorderSponsorsAction = createServerAction()
	.input(reorderSponsorsSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to manage this competition")
			}

			await reorderSponsors(input)

			revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder sponsors:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to reorder sponsors")
		}
	})

/* -------------------------------------------------------------------------- */
/*                           Workout Sponsor Actions                           */
/* -------------------------------------------------------------------------- */

/**
 * Assign a sponsor to a workout ("Presented by")
 */
export const assignWorkoutSponsorAction = createServerAction()
	.input(assignWorkoutSponsorSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new ZSAError("NOT_FOUND", "Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new ZSAError("FORBIDDEN", "No access to manage this competition")
			}

			const result = await assignWorkoutSponsor(input)
			if (!result.success) {
				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					result.error || "Failed to assign sponsor",
				)
			}

			revalidatePath(`/compete/organizer/${input.competitionId}/events`)
			revalidatePath(`/compete/organizer/${input.competitionId}/sponsors`)

			return { success: true }
		} catch (error) {
			console.error("Failed to assign workout sponsor:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to assign workout sponsor",
			)
		}
	})
