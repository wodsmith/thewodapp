import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
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

/* -------------------------------------------------------------------------- */
/*                           Query Functions                                   */
/* -------------------------------------------------------------------------- */

/**
 * Get all sponsors for a competition, organized by groups
 */
export const getCompetitionSponsorsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const result = await getCompetitionSponsors(input.competitionId)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get competition sponsors:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition sponsors")
		}
	})

/**
 * Get all sponsor groups for a competition
 */
export const getCompetitionSponsorGroupsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string().min(1, "Competition ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const groups = await getCompetitionSponsorGroups(input.competitionId)
			return { success: true, data: groups }
		} catch (error) {
			console.error("Failed to get sponsor groups:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get sponsor groups")
		}
	})

/**
 * Get all sponsors for the current user (athlete sponsors)
 */
export const getUserSponsorsFn = createServerFn({ method: "POST" })
	.validator(z.object({}))
	.handler(async () => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const sponsors = await getUserSponsors(session.user.id)
			return { success: true, data: sponsors }
		} catch (error) {
			console.error("Failed to get user sponsors:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get user sponsors")
		}
	})

/**
 * Get a single sponsor
 */
export const getSponsorFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			sponsorId: z.string().min(1, "Sponsor ID is required"),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const sponsor = await getSponsor(input.sponsorId)
			if (!sponsor) {
				throw new Error("Sponsor not found")
			}
			return { success: true, data: sponsor }
		} catch (error) {
			console.error("Failed to get sponsor:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to get sponsor")
		}
	})

/* -------------------------------------------------------------------------- */
/*                           Sponsor Group Functions                           */
/* -------------------------------------------------------------------------- */

/**
 * Create a sponsor group
 */
export const createSponsorGroupFn = createServerFn({ method: "POST" })
	.validator(createSponsorGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No access to manage this competition")
			}

			const group = await createSponsorGroup(input)

			return { success: true, data: group }
		} catch (error) {
			console.error("Failed to create sponsor group:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to create sponsor group")
		}
	})

/**
 * Update a sponsor group
 */
export const updateSponsorGroupFn = createServerFn({ method: "POST" })
	.validator(updateSponsorGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No access to manage this competition")
			}

			const group = await updateSponsorGroup(input)
			if (!group) {
				throw new Error("Sponsor group not found")
			}

			return { success: true, data: group }
		} catch (error) {
			console.error("Failed to update sponsor group:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update sponsor group")
		}
	})

/**
 * Delete a sponsor group
 */
export const deleteSponsorGroupFn = createServerFn({ method: "POST" })
	.validator(deleteSponsorGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No access to manage this competition")
			}

			const result = await deleteSponsorGroup(input)
			if (!result.success) {
				throw new Error(result.error || "Failed to delete")
			}

			return { success: true }
		} catch (error) {
			console.error("Failed to delete sponsor group:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to delete sponsor group")
		}
	})

/**
 * Reorder sponsor groups
 */
export const reorderSponsorGroupsFn = createServerFn({ method: "POST" })
	.validator(reorderSponsorGroupsSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No access to manage this competition")
			}

			await reorderSponsorGroups(input)

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder sponsor groups:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to reorder sponsor groups")
		}
	})

/* -------------------------------------------------------------------------- */
/*                           Sponsor Functions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Create a sponsor (competition or user)
 */
export const createSponsorFn = createServerFn({ method: "POST" })
	.validator(createSponsorSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			if (input.competitionId) {
				const competition = await getCompetition(input.competitionId)
				if (!competition) {
					throw new Error("Competition not found")
				}

				const hasAccess = await hasTeamPermission(
					competition.organizingTeamId,
					TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
				)

				if (!hasAccess) {
					throw new Error("No access to manage this competition")
				}
			} else if (input.userId) {
				if (input.userId !== session.user.id) {
					throw new Error("Cannot create sponsors for other users")
				}
			} else {
				throw new Error("Either competitionId or userId is required")
			}

			const sponsor = await createSponsor(input)

			return { success: true, data: sponsor }
		} catch (error) {
			console.error("Failed to create sponsor:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to create sponsor")
		}
	})

/**
 * Update a sponsor
 */
export const updateSponsorFn = createServerFn({ method: "POST" })
	.validator(updateSponsorSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const existing = await getSponsor(input.sponsorId)
			if (!existing) {
				throw new Error("Sponsor not found")
			}

			if (existing.competitionId) {
				const competition = await getCompetition(existing.competitionId)
				if (!competition) {
					throw new Error("Competition not found")
				}

				const hasAccess = await hasTeamPermission(
					competition.organizingTeamId,
					TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
				)

				if (!hasAccess) {
					throw new Error("No access to manage this competition")
				}
			} else if (existing.userId) {
				if (existing.userId !== session.user.id) {
					throw new Error("Cannot update sponsors for other users")
				}
			}

			const sponsor = await updateSponsor(input)
			if (!sponsor) {
				throw new Error("Sponsor not found")
			}

			return { success: true, data: sponsor }
		} catch (error) {
			console.error("Failed to update sponsor:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to update sponsor")
		}
	})

/**
 * Delete a sponsor
 */
export const deleteSponsorFn = createServerFn({ method: "POST" })
	.validator(deleteSponsorSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const existing = await getSponsor(input.sponsorId)
			if (!existing) {
				return { success: true }
			}

			if (existing.competitionId) {
				const competition = await getCompetition(existing.competitionId)
				if (!competition) {
					throw new Error("Competition not found")
				}

				const hasAccess = await hasTeamPermission(
					competition.organizingTeamId,
					TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
				)

				if (!hasAccess) {
					throw new Error("No access to manage this competition")
				}
			} else if (existing.userId) {
				if (existing.userId !== session.user.id) {
					throw new Error("Cannot delete sponsors for other users")
				}
			}

			const result = await deleteSponsor(input)
			if (!result.success) {
				throw new Error(result.error || "Failed to delete")
			}

			return { success: true }
		} catch (error) {
			console.error("Failed to delete sponsor:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to delete sponsor")
		}
	})

/**
 * Reorder sponsors within a competition
 */
export const reorderSponsorsFn = createServerFn({ method: "POST" })
	.validator(reorderSponsorsSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No access to manage this competition")
			}

			await reorderSponsors(input)

			return { success: true }
		} catch (error) {
			console.error("Failed to reorder sponsors:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to reorder sponsors")
		}
	})

/* -------------------------------------------------------------------------- */
/*                           Workout Sponsor Functions                         */
/* -------------------------------------------------------------------------- */

/**
 * Assign a sponsor to a workout ("Presented by")
 */
export const assignWorkoutSponsorFn = createServerFn({ method: "POST" })
	.validator(assignWorkoutSponsorSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("Not authenticated")
			}

			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

			const hasAccess = await hasTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!hasAccess) {
				throw new Error("No access to manage this competition")
			}

			const result = await assignWorkoutSponsor(input)
			if (!result.success) {
				throw new Error(result.error || "Failed to assign sponsor")
			}

			return { success: true }
		} catch (error) {
			console.error("Failed to assign workout sponsor:", error)
			if (error instanceof Error) throw error
			throw new Error("Failed to assign workout sponsor")
		}
	})
