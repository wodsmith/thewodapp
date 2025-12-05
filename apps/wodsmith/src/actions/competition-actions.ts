"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { revalidatePath } from "next/cache"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	SCORE_TYPE_VALUES,
	SECONDARY_SCHEME_VALUES,
	TIEBREAK_SCHEME_VALUES,
	WORKOUT_SCHEME_VALUES,
} from "@/db/schemas/workouts"
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
	updateRegistrationAffiliateSchema,
} from "@/schemas/competitions"
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
	updateRegistrationAffiliate,
} from "@/server/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

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
			revalidatePath("/compete/organizer")
			revalidatePath("/compete/organizer/series")

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
			const result = await updateCompetitionGroup(input.groupId, updateData)

			// Revalidate competition pages
			revalidatePath("/compete/organizer")
			revalidatePath("/compete/organizer/series")
			revalidatePath(`/compete/organizer/series/${input.groupId}`)

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
			revalidatePath("/compete/organizer")
			revalidatePath("/compete/organizer/series")

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
			revalidatePath("/compete/organizer")
			if (input.groupId) {
				revalidatePath(`/compete/organizer/series/${input.groupId}`)
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

			const {
				organizingTeamId: _organizingTeamId,
				competitionId,
				...rawUpdateData
			} = input
			// Convert null to undefined for fields that support it
			const updateData = {
				...rawUpdateData,
				description:
					rawUpdateData.description === null ? null : rawUpdateData.description,
				registrationOpensAt:
					rawUpdateData.registrationOpensAt === null
						? null
						: rawUpdateData.registrationOpensAt,
				registrationClosesAt:
					rawUpdateData.registrationClosesAt === null
						? null
						: rawUpdateData.registrationClosesAt,
				groupId:
					rawUpdateData.groupId === null || rawUpdateData.groupId === undefined
						? null
						: rawUpdateData.groupId,
				settings:
					rawUpdateData.settings === null ? null : rawUpdateData.settings,
				profileImageUrl:
					rawUpdateData.profileImageUrl === null
						? null
						: rawUpdateData.profileImageUrl,
				bannerImageUrl:
					rawUpdateData.bannerImageUrl === null
						? null
						: rawUpdateData.bannerImageUrl,
			}
			const result = await updateCompetition(competitionId, updateData)

			// Revalidate competition pages
			revalidatePath("/compete/organizer")
			revalidatePath(`/compete/organizer/${competitionId}`)
			if (result.groupId) {
				revalidatePath(`/compete/organizer/series/${result.groupId}`)
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
			revalidatePath("/compete/organizer")

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
				throw new ZSAError(
					"NOT_AUTHORIZED",
					"You must be logged in to register",
				)
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
				throw new ZSAError(
					"FORBIDDEN",
					"You can only view your own registration",
				)
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
				throw new ZSAError(
					"NOT_AUTHORIZED",
					"You must be logged in to cancel registration",
				)
			}

			// Validate user ID matches session
			if (input.userId !== session.userId) {
				throw new ZSAError(
					"FORBIDDEN",
					"You can only cancel your own registration",
				)
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

/**
 * Update registration affiliate
 */
export const updateRegistrationAffiliateAction = createServerAction()
	.input(updateRegistrationAffiliateSchema)
	.handler(async ({ input }) => {
		try {
			// Get current user from session
			const session = await getSessionFromCookie()
			if (!session) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in")
			}

			// Validate user ID matches session
			if (input.userId !== session.userId) {
				throw new ZSAError(
					"FORBIDDEN",
					"You can only update your own registration",
				)
			}

			const result = await updateRegistrationAffiliate(input)

			// Revalidate pages
			revalidatePath("/compete")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to update affiliate:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to update affiliate")
		}
	})

/* -------------------------------------------------------------------------- */
/*                     Competition Workout Actions                             */
/* -------------------------------------------------------------------------- */

import { z } from "zod"
import {
	getCompetitionLeaderboard,
	getEventLeaderboard,
} from "@/server/competition-leaderboard"
import {
	addWorkoutToCompetition,
	createCompetitionEvent,
	getCompetitionWorkouts,
	getNextCompetitionEventOrder,
	removeWorkoutFromCompetition,
	reorderCompetitionEvents,
	saveCompetitionEvent,
	updateCompetitionWorkout,
	updateWorkoutDivisionDescriptions,
} from "@/server/competition-workouts"

// Competition Workout Schemas
const addWorkoutToCompetitionSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	workoutId: z.string().min(1, "Workout ID is required"),
	trackOrder: z.number().int().min(1).optional(),
	pointsMultiplier: z.number().int().min(1).default(100),
	notes: z.string().max(1000).optional(),
})

const updateCompetitionWorkoutSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	trackOrder: z.number().int().min(1).optional(),
	pointsMultiplier: z.number().int().min(1).optional(),
	notes: z.string().max(1000).nullable().optional(),
	heatStatus: z.enum(["draft", "published"]).optional(),
	eventStatus: z.enum(["draft", "published"]).optional(),
})

const removeWorkoutFromCompetitionSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const reorderCompetitionEventsSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	updates: z
		.array(
			z.object({
				trackWorkoutId: z.string().min(1),
				trackOrder: z.number().int().min(1),
			}),
		)
		.min(1, "At least one update required"),
})

const getCompetitionWorkoutsSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const getCompetitionLeaderboardSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	divisionId: z.string().optional(),
})

const getEventLeaderboardSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	divisionId: z.string().optional(),
})

const createCompetitionEventSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	name: z.string().min(1, "Name is required").max(200),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
	description: z.string().max(5000).optional(),
	roundsToScore: z.number().int().min(1).nullable().optional(),
	repsPerRound: z.number().int().min(1).nullable().optional(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
	secondaryScheme: z.enum(SECONDARY_SCHEME_VALUES).nullable().optional(),
	tagIds: z.array(z.string()).optional(),
	tagNames: z.array(z.string()).optional(), // For creating new tags
	movementIds: z.array(z.string()).optional(),
	sourceWorkoutId: z.string().nullable().optional(), // For remixing existing workouts
})

const saveCompetitionEventSchema = z.object({
	// Identifiers
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	// Workout details
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().max(5000).optional(),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
	roundsToScore: z.number().int().min(1).nullable().optional(),
	repsPerRound: z.number().int().min(1).nullable().optional(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
	timeCap: z.number().int().min(1).nullable().optional(),
	secondaryScheme: z.enum(SECONDARY_SCHEME_VALUES).nullable().optional(),
	movementIds: z.array(z.string()).optional(),
	// Track workout details
	pointsMultiplier: z.number().int().min(1).optional(),
	notes: z.string().max(1000).nullable().optional(),
	sponsorId: z.string().nullable().optional(),
	// Division descriptions
	divisionDescriptions: z
		.array(
			z.object({
				divisionId: z.string().min(1, "Division ID is required"),
				description: z.string().max(2000).nullable(),
			}),
		)
		.optional(),
})

/**
 * Add a workout to a competition
 */
export const addWorkoutToCompetitionAction = createServerAction()
	.input(addWorkoutToCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			// Get next order if not provided
			const trackOrder =
				input.trackOrder ??
				(await getNextCompetitionEventOrder(input.competitionId))

			const result = await addWorkoutToCompetition({
				competitionId: input.competitionId,
				workoutId: input.workoutId,
				trackOrder,
				pointsMultiplier: input.pointsMultiplier,
				notes: input.notes,
			})

			// Revalidate
			revalidatePath(`/compete/organizer/${input.competitionId}`)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to add workout to competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to add workout to competition")
		}
	})

/**
 * Get all workouts for a competition (public)
 */
export const getCompetitionWorkoutsAction = createServerAction()
	.input(getCompetitionWorkoutsSchema)
	.handler(async ({ input }) => {
		try {
			const workouts = await getCompetitionWorkouts(input.competitionId)
			return { success: true, data: workouts }
		} catch (error) {
			console.error("Failed to get competition workouts:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competition workouts")
		}
	})

/**
 * Update a competition workout
 */
export const updateCompetitionWorkoutAction = createServerAction()
	.input(updateCompetitionWorkoutSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateCompetitionWorkout({
				trackWorkoutId: input.trackWorkoutId,
				trackOrder: input.trackOrder,
				pointsMultiplier: input.pointsMultiplier,
				notes: input.notes,
				heatStatus: input.heatStatus,
				eventStatus: input.eventStatus,
			})

			// Revalidate
			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to update competition workout:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to update competition workout")
		}
	})

/**
 * Remove a workout from a competition
 */
export const removeWorkoutFromCompetitionAction = createServerAction()
	.input(removeWorkoutFromCompetitionSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await removeWorkoutFromCompetition(input.trackWorkoutId)

			// Revalidate
			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to remove workout from competition:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to remove workout from competition")
		}
	})

/**
 * Reorder competition events
 */
export const reorderCompetitionEventsAction = createServerAction()
	.input(reorderCompetitionEventsSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const updateCount = await reorderCompetitionEvents(
				input.competitionId,
				input.updates,
			)

			// Revalidate
			revalidatePath(`/compete/organizer/${input.competitionId}`)

			return { success: true, updateCount }
		} catch (error) {
			console.error("Failed to reorder competition events:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to reorder competition events")
		}
	})

/**
 * Create a new competition event (creates workout and adds to track)
 */
export const createCompetitionEventAction = createServerAction()
	.input(createCompetitionEventSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const result = await createCompetitionEvent({
				competitionId: input.competitionId,
				teamId: input.organizingTeamId,
				name: input.name,
				scheme: input.scheme,
				scoreType: input.scoreType ?? undefined,
				description: input.description,
				roundsToScore: input.roundsToScore ?? undefined,
				repsPerRound: input.repsPerRound ?? undefined,
				tiebreakScheme: input.tiebreakScheme ?? undefined,
				secondaryScheme: input.secondaryScheme ?? undefined,
				tagIds: input.tagIds,
				tagNames: input.tagNames,
				movementIds: input.movementIds,
				sourceWorkoutId: input.sourceWorkoutId ?? undefined,
			})

			// Revalidate
			revalidatePath(`/compete/organizer/${input.competitionId}`)

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to create competition event:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to create competition event")
		}
	})

/**
 * Save all competition event details in a single operation.
 * This consolidates workout updates, track workout updates, and division descriptions
 * into a single server call for better performance.
 */
export const saveCompetitionEventAction = createServerAction()
	.input(saveCompetitionEventSchema)
	.handler(async ({ input }) => {
		try {
			// Single permission check
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await saveCompetitionEvent({
				trackWorkoutId: input.trackWorkoutId,
				workoutId: input.workoutId,
				teamId: input.organizingTeamId,
				name: input.name,
				description: input.description,
				scheme: input.scheme,
				scoreType: input.scoreType,
				roundsToScore: input.roundsToScore,
				repsPerRound: input.repsPerRound,
				tiebreakScheme: input.tiebreakScheme,
				timeCap: input.timeCap,
				secondaryScheme: input.secondaryScheme,
				movementIds: input.movementIds,
				pointsMultiplier: input.pointsMultiplier,
				notes: input.notes,
				sponsorId: input.sponsorId,
				divisionDescriptions: input.divisionDescriptions,
			})

			// Single revalidation
			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to save competition event:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to save competition event")
		}
	})

/* -------------------------------------------------------------------------- */
/*                      Competition Leaderboard Actions                        */
/* -------------------------------------------------------------------------- */

/**
 * Get competition leaderboard (public)
 */
export const getCompetitionLeaderboardAction = createServerAction()
	.input(getCompetitionLeaderboardSchema)
	.handler(async ({ input }) => {
		try {
			const leaderboard = await getCompetitionLeaderboard({
				competitionId: input.competitionId,
				divisionId: input.divisionId,
			})

			return { success: true, data: leaderboard }
		} catch (error) {
			console.error("Failed to get competition leaderboard:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get competition leaderboard")
		}
	})

/**
 * Get event leaderboard (public)
 */
export const getEventLeaderboardAction = createServerAction()
	.input(getEventLeaderboardSchema)
	.handler(async ({ input }) => {
		try {
			const leaderboard = await getEventLeaderboard({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				divisionId: input.divisionId,
			})

			return { success: true, data: leaderboard }
		} catch (error) {
			console.error("Failed to get event leaderboard:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to get event leaderboard")
		}
	})

/* -------------------------------------------------------------------------- */
/*                     Division Descriptions Actions                           */
/* -------------------------------------------------------------------------- */

const updateDivisionDescriptionsSchema = z.object({
	workoutId: z.string().min(1, "Workout ID is required"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	descriptions: z.array(
		z.object({
			divisionId: z.string().min(1, "Division ID is required"),
			description: z.string().max(2000).nullable(),
		}),
	),
})

/**
 * Update division-specific descriptions for a competition event
 */
export const updateDivisionDescriptionsAction = createServerAction()
	.input(updateDivisionDescriptionsSchema)
	.handler(async ({ input }) => {
		try {
			// Check permission
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateWorkoutDivisionDescriptions({
				workoutId: input.workoutId,
				teamId: input.organizingTeamId,
				descriptions: input.descriptions,
			})

			// Revalidate
			revalidatePath("/compete/organizer")

			return { success: true }
		} catch (error) {
			console.error("Failed to update division descriptions:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			if (error instanceof Error) {
				throw new ZSAError("ERROR", error.message)
			}
			throw new ZSAError("ERROR", "Failed to update division descriptions")
		}
	})
