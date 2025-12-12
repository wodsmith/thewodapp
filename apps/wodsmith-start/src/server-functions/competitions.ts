import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { TEAM_PERMISSIONS } from "~/db/schemas/teams"
import {
	SCORE_TYPE_VALUES,
	TIEBREAK_SCHEME_VALUES,
	WORKOUT_SCHEME_VALUES,
} from "~/db/schemas/workouts"
import { logError } from "~/lib/logging/posthog-otel-logger"
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
} from "~/schemas/competitions"
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
} from "~/server/competitions"
import {
	getCompetitionLeaderboard,
	getEventLeaderboard,
} from "~/server/competition-leaderboard"
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
} from "~/server/competition-workouts"
import { getSessionFromCookie } from "~/utils/auth.server"
import { requireTeamPermission } from "~/utils/team-auth.server"
import { hasFeature } from "~/server/entitlements.server"
import { FEATURES } from "~/constants"

/* -------------------------------------------------------------------------- */
/*                         User Team Functions                                */
/* -------------------------------------------------------------------------- */

/**
 * Get teams where the current user has MANAGE_PROGRAMMING permission
 * AND the team has the HOST_COMPETITIONS feature enabled
 * These are the teams that can organize competitions
 */
export const getUserOrganizingTeamsFn = createServerFn({ method: "POST" })
	.handler(async () => {
		try {
			const session = await getSessionFromCookie()

			if (!session?.teams) {
				return { success: true, data: [] }
			}

			// Filter teams where user has MANAGE_PROGRAMMING permission
			const teamsWithPermission = session.teams.filter((team) =>
				team.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING),
			)

			// Check each team for HOST_COMPETITIONS feature
			const teamsWithFeature = await Promise.all(
				teamsWithPermission.map(async (team) => {
					const canHost = await hasFeature(team.id, FEATURES.HOST_COMPETITIONS)
					return canHost ? team : null
				}),
			)

			const organizingTeams = teamsWithFeature
				.filter((team): team is NonNullable<typeof team> => team !== null)
				.map((team) => ({
					id: team.id,
					name: team.name,
					type: team.type,
					slug: team.slug,
				}))

			return { success: true, data: organizingTeams }
		} catch (error) {
			logError({
				message:
					"[getUserOrganizingTeamsFn] Failed to get user organizing teams",
				error,
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get organizing teams")
		}
	})

/* -------------------------------------------------------------------------- */
/*                        Competition Group Functions                         */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition group (series)
 */
export const createCompetitionGroupFn = createServerFn({ method: "POST" })
	.validator(createCompetitionGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const result = await createCompetitionGroup(input)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					"[createCompetitionGroupFn] Failed to create competition series",
				error,
				attributes: { teamId: input.organizingTeamId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to create competition series")
		}
	})

/**
 * Get all competition groups for an organizing team
 */
export const getCompetitionGroupsFn = createServerFn({ method: "POST" })
	.validator(getCompetitionGroupsSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const groups = await getCompetitionGroups(input.organizingTeamId)

			return { success: true, data: groups }
		} catch (error) {
			logError({
				message: "[getCompetitionGroupsFn] Failed to get competition groups",
				error,
				attributes: { teamId: input.organizingTeamId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition series")
		}
	})

/**
 * Get a single competition group
 */
export const getCompetitionGroupFn = createServerFn({ method: "POST" })
	.validator(getCompetitionGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			const group = await getCompetitionGroup(input.groupId)

			if (!group) {
				throw new Error("Competition series not found")
			}

			await requireTeamPermission(
				group.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			return { success: true, data: group }
		} catch (error) {
			logError({
				message: "[getCompetitionGroupFn] Failed to get competition group",
				error,
				attributes: { groupId: input.groupId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition series")
		}
	})

/**
 * Update a competition group
 */
export const updateCompetitionGroupFn = createServerFn({ method: "POST" })
	.validator(updateCompetitionGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const { organizingTeamId: _organizingTeamId, ...updateData } = input
			const result = await updateCompetitionGroup(input.groupId, updateData)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					"[updateCompetitionGroupFn] Failed to update competition series",
				error,
				attributes: { teamId: input.organizingTeamId, groupId: input.groupId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to update competition series")
		}
	})

/**
 * Delete a competition group
 */
export const deleteCompetitionGroupFn = createServerFn({ method: "POST" })
	.validator(deleteCompetitionGroupSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteCompetitionGroup(input.groupId)

			return { success: true }
		} catch (error) {
			logError({
				message:
					"[deleteCompetitionGroupFn] Failed to delete competition series",
				error,
				attributes: { teamId: input.organizingTeamId, groupId: input.groupId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to delete competition series")
		}
	})

/* -------------------------------------------------------------------------- */
/*                          Competition Functions                             */
/* -------------------------------------------------------------------------- */

/**
 * Create a new competition
 */
export const createCompetitionFn = createServerFn({ method: "POST" })
	.validator(createCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const result = await createCompetition(input)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message: "[createCompetitionFn] Failed to create competition",
				error,
				attributes: { teamId: input.organizingTeamId, name: input.name },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to create competition")
		}
	})

/**
 * Get all competitions for an organizing team
 */
export const getCompetitionsFn = createServerFn({ method: "POST" })
	.validator(getCompetitionsSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const competitions = await getCompetitions(input.organizingTeamId)

			return { success: true, data: competitions }
		} catch (error) {
			logError({
				message: "[getCompetitionsFn] Failed to get competitions",
				error,
				attributes: { teamId: input.organizingTeamId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competitions")
		}
	})

/**
 * Get a single competition
 */
export const getCompetitionFn = createServerFn({ method: "POST" })
	.validator(getCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			const competition = await getCompetition(input.idOrSlug)

			if (!competition) {
				throw new Error("Competition not found")
			}

			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			return { success: true, data: competition }
		} catch (error) {
			logError({
				message: "[getCompetitionFn] Failed to get competition",
				error,
				attributes: { idOrSlug: input.idOrSlug },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition")
		}
	})

/**
 * Update a competition
 */
export const updateCompetitionFn = createServerFn({ method: "POST" })
	.validator(updateCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const {
				organizingTeamId: _organizingTeamId,
				competitionId,
				...rawUpdateData
			} = input
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

			return { success: true, data: result }
		} catch (error) {
			logError({
				message: "[updateCompetitionFn] Failed to update competition",
				error,
				attributes: {
					teamId: input.organizingTeamId,
					competitionId: input.competitionId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to update competition")
		}
	})

/**
 * Delete a competition
 */
export const deleteCompetitionFn = createServerFn({ method: "POST" })
	.validator(deleteCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await deleteCompetition(input.competitionId)

			return { success: true }
		} catch (error) {
			logError({
				message: "[deleteCompetitionFn] Failed to delete competition",
				error,
				attributes: {
					teamId: input.organizingTeamId,
					competitionId: input.competitionId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to delete competition")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Registration Functions                             */
/* -------------------------------------------------------------------------- */

/**
 * Register for a competition
 */
export const registerForCompetitionFn = createServerFn({ method: "POST" })
	.validator(registerForCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("You must be logged in to register")
			}

			if (input.userId !== session.userId) {
				throw new Error("You can only register yourself")
			}

			const result = await registerForCompetition(input)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					"[registerForCompetitionFn] Failed to register for competition",
				error,
				attributes: {
					competitionId: input.competitionId,
					userId: input.userId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to register for competition")
		}
	})

/**
 * Get user's competition registration
 */
export const getUserCompetitionRegistrationFn = createServerFn({
	method: "POST",
})
	.validator(getUserCompetitionRegistrationSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				return { success: true, data: null }
			}

			if (input.userId !== session.userId) {
				throw new Error("You can only view your own registration")
			}

			const registration = await getUserCompetitionRegistration(
				input.competitionId,
				input.userId,
			)

			return { success: true, data: registration }
		} catch (error) {
			logError({
				message:
					"[getUserCompetitionRegistrationFn] Failed to get registration",
				error,
				attributes: {
					competitionId: input.competitionId,
					userId: input.userId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get registration")
		}
	})

/**
 * Get all registrations for a competition (admin only)
 */
export const getCompetitionRegistrationsFn = createServerFn({ method: "POST" })
	.validator(getCompetitionRegistrationsSchema)
	.handler(async ({ data: input }) => {
		try {
			const competition = await getCompetition(input.competitionId)
			if (!competition) {
				throw new Error("Competition not found")
			}

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
			logError({
				message:
					"[getCompetitionRegistrationsFn] Failed to get competition registrations",
				error,
				attributes: {
					competitionId: input.competitionId,
					divisionId: input.divisionId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition registrations")
		}
	})

/**
 * Cancel a competition registration
 */
export const cancelCompetitionRegistrationFn = createServerFn({
	method: "POST",
})
	.validator(cancelCompetitionRegistrationSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("You must be logged in to cancel registration")
			}

			if (input.userId !== session.userId) {
				throw new Error("You can only cancel your own registration")
			}

			const result = await cancelCompetitionRegistration(
				input.registrationId,
				input.userId,
			)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					"[cancelCompetitionRegistrationFn] Failed to cancel registration",
				error,
				attributes: {
					registrationId: input.registrationId,
					userId: input.userId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to cancel registration")
		}
	})

/**
 * Update registration affiliate
 */
export const updateRegistrationAffiliateFn = createServerFn({ method: "POST" })
	.validator(updateRegistrationAffiliateSchema)
	.handler(async ({ data: input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session) {
				throw new Error("You must be logged in")
			}

			if (input.userId !== session.userId) {
				throw new Error("You can only update your own registration")
			}

			const result = await updateRegistrationAffiliate(input)

			return { success: true, data: result }
		} catch (error) {
			logError({
				message: "[updateRegistrationAffiliateFn] Failed to update affiliate",
				error,
				attributes: { userId: input.userId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to update affiliate")
		}
	})

/* -------------------------------------------------------------------------- */
/*                     Competition Workout Functions                          */
/* -------------------------------------------------------------------------- */

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
	tagIds: z.array(z.string()).optional(),
	tagNames: z.array(z.string()).optional(),
	movementIds: z.array(z.string()).optional(),
	sourceWorkoutId: z.string().nullable().optional(),
})

const saveCompetitionEventSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID"),
	name: z.string().min(1, "Name is required").max(200),
	description: z.string().max(5000).optional(),
	scheme: z.enum(WORKOUT_SCHEME_VALUES),
	scoreType: z.enum(SCORE_TYPE_VALUES).nullable().optional(),
	roundsToScore: z.number().int().min(1).nullable().optional(),
	repsPerRound: z.number().int().min(1).nullable().optional(),
	tiebreakScheme: z.enum(TIEBREAK_SCHEME_VALUES).nullable().optional(),
	timeCap: z.number().int().min(1).nullable().optional(),
	movementIds: z.array(z.string()).optional(),
	pointsMultiplier: z.number().int().min(1).optional(),
	notes: z.string().max(1000).nullable().optional(),
	sponsorId: z.string().nullable().optional(),
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
export const addWorkoutToCompetitionFn = createServerFn({ method: "POST" })
	.validator(addWorkoutToCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

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

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					"[addWorkoutToCompetitionFn] Failed to add workout to competition",
				error,
				attributes: {
					competitionId: input.competitionId,
					workoutId: input.workoutId,
					teamId: input.organizingTeamId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to add workout to competition")
		}
	})

/**
 * Get all workouts for a competition (public)
 */
export const getCompetitionWorkoutsFn = createServerFn({ method: "POST" })
	.validator(getCompetitionWorkoutsSchema)
	.handler(async ({ data: input }) => {
		try {
			const workouts = await getCompetitionWorkouts(input.competitionId)
			return { success: true, data: workouts }
		} catch (error) {
			logError({
				message:
					"[getCompetitionWorkoutsFn] Failed to get competition workouts",
				error,
				attributes: { competitionId: input.competitionId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition workouts")
		}
	})

/**
 * Update a competition workout
 */
export const updateCompetitionWorkoutFn = createServerFn({ method: "POST" })
	.validator(updateCompetitionWorkoutSchema)
	.handler(async ({ data: input }) => {
		try {
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

			return { success: true }
		} catch (error) {
			logError({
				message:
					"[updateCompetitionWorkoutFn] Failed to update competition workout",
				error,
				attributes: {
					trackWorkoutId: input.trackWorkoutId,
					teamId: input.organizingTeamId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to update competition workout")
		}
	})

/**
 * Remove a workout from a competition
 */
export const removeWorkoutFromCompetitionFn = createServerFn({ method: "POST" })
	.validator(removeWorkoutFromCompetitionSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await removeWorkoutFromCompetition(input.trackWorkoutId)

			return { success: true }
		} catch (error) {
			logError({
				message:
					"[removeWorkoutFromCompetitionFn] Failed to remove workout from competition",
				error,
				attributes: {
					trackWorkoutId: input.trackWorkoutId,
					teamId: input.organizingTeamId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to remove workout from competition")
		}
	})

/**
 * Reorder competition events
 */
export const reorderCompetitionEventsFn = createServerFn({ method: "POST" })
	.validator(reorderCompetitionEventsSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const updateCount = await reorderCompetitionEvents(
				input.competitionId,
				input.updates,
			)

			return { success: true, updateCount }
		} catch (error) {
			logError({
				message:
					"[reorderCompetitionEventsFn] Failed to reorder competition events",
				error,
				attributes: {
					competitionId: input.competitionId,
					teamId: input.organizingTeamId,
					updateCount: input.updates.length,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to reorder competition events")
		}
	})

/**
 * Create a new competition event (creates workout and adds to track)
 */
export const createCompetitionEventFn = createServerFn({ method: "POST" })
	.validator(createCompetitionEventSchema)
	.handler(async ({ data: input }) => {
		try {
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
				tagIds: input.tagIds,
				tagNames: input.tagNames,
				movementIds: input.movementIds,
				sourceWorkoutId: input.sourceWorkoutId ?? undefined,
			})

			return { success: true, data: result }
		} catch (error) {
			logError({
				message:
					"[createCompetitionEventFn] Failed to create competition event",
				error,
				attributes: {
					competitionId: input.competitionId,
					teamId: input.organizingTeamId,
					eventName: input.name,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to create competition event")
		}
	})

/**
 * Save all competition event details in a single operation.
 */
export const saveCompetitionEventFn = createServerFn({ method: "POST" })
	.validator(saveCompetitionEventSchema)
	.handler(async ({ data: input }) => {
		try {
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
				movementIds: input.movementIds,
				pointsMultiplier: input.pointsMultiplier,
				notes: input.notes,
				sponsorId: input.sponsorId,
				divisionDescriptions: input.divisionDescriptions,
			})

			return { success: true }
		} catch (error) {
			logError({
				message: "[saveCompetitionEventFn] Failed to save competition event",
				error,
				attributes: {
					trackWorkoutId: input.trackWorkoutId,
					workoutId: input.workoutId,
					teamId: input.organizingTeamId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to save competition event")
		}
	})

/* -------------------------------------------------------------------------- */
/*                      Competition Leaderboard Functions                     */
/* -------------------------------------------------------------------------- */

/**
 * Get competition leaderboard (public)
 */
export const getCompetitionLeaderboardFn = createServerFn({ method: "POST" })
	.validator(getCompetitionLeaderboardSchema)
	.handler(async ({ data: input }) => {
		try {
			const leaderboard = await getCompetitionLeaderboard({
				competitionId: input.competitionId,
				divisionId: input.divisionId,
			})

			return { success: true, data: leaderboard }
		} catch (error) {
			logError({
				message:
					"[getCompetitionLeaderboardFn] Failed to get competition leaderboard",
				error,
				attributes: {
					competitionId: input.competitionId,
					divisionId: input.divisionId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competition leaderboard")
		}
	})

/**
 * Get event leaderboard (public)
 */
export const getEventLeaderboardFn = createServerFn({ method: "POST" })
	.validator(getEventLeaderboardSchema)
	.handler(async ({ data: input }) => {
		try {
			const leaderboard = await getEventLeaderboard({
				competitionId: input.competitionId,
				trackWorkoutId: input.trackWorkoutId,
				divisionId: input.divisionId,
			})

			return { success: true, data: leaderboard }
		} catch (error) {
			logError({
				message: "[getEventLeaderboardFn] Failed to get event leaderboard",
				error,
				attributes: {
					competitionId: input.competitionId,
					trackWorkoutId: input.trackWorkoutId,
					divisionId: input.divisionId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get event leaderboard")
		}
	})

/* -------------------------------------------------------------------------- */
/*                     Division Descriptions Functions                        */
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
export const updateDivisionDescriptionsFn = createServerFn({ method: "POST" })
	.validator(updateDivisionDescriptionsSchema)
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await updateWorkoutDivisionDescriptions({
				workoutId: input.workoutId,
				teamId: input.organizingTeamId,
				descriptions: input.descriptions,
			})

			return { success: true }
		} catch (error) {
			logError({
				message:
					"[updateDivisionDescriptionsFn] Failed to update division descriptions",
				error,
				attributes: {
					workoutId: input.workoutId,
					teamId: input.organizingTeamId,
				},
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to update division descriptions")
		}
	})

/* -------------------------------------------------------------------------- */
/*                         Public Competition Functions                       */
/* -------------------------------------------------------------------------- */

/**
 * Get all public competitions (for athletes)
 */
export const getPublicCompetitionsFn = createServerFn({ method: "POST" })
	.validator(z.object({}))
	.handler(async () => {
		try {
			const competitions = await getPublicCompetitions()
			return { success: true, data: competitions }
		} catch (error) {
			logError({
				message: "[getPublicCompetitionsFn] Failed to get public competitions",
				error,
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competitions")
		}
	})

/**
 * Get all competitions for an organizer
 */
export const getCompetitionsForOrganizerFn = createServerFn({ method: "POST" })
	.validator(z.object({ teamId: z.string().min(1, "Team ID is required") }))
	.handler(async ({ data: input }) => {
		try {
			await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const competitions = await getCompetitions(input.teamId)
			return { success: true, data: competitions }
		} catch (error) {
			logError({
				message:
					"[getCompetitionsForOrganizerFn] Failed to get organizer competitions",
				error,
				attributes: { teamId: input.teamId },
			})
			if (error instanceof Error) throw error
			throw new Error("Failed to get competitions")
		}
	})
