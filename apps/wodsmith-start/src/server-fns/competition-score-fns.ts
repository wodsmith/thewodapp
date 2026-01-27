/**
 * Competition Score Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-scores.ts and
 * apps/wodsmith/src/actions/competition-score-actions.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	type CompetitionHeat,
	competitionEventsTable,
	competitionHeatAssignmentsTable,
	competitionHeatsTable,
	competitionRegistrationsTable,
	competitionsTable,
	competitionVenuesTable,
} from "@/db/schemas/competitions"
import { entitlementTable } from "@/db/schemas/entitlements"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"
import {
	SCORE_STATUS_VALUES,
	type ScoreStatus,
	type ScoreType,
	type TiebreakScheme,
	type WorkoutScheme,
	workouts,
} from "@/db/schemas/workouts"
import {
	computeSortKey,
	decodeScore,
	encodeRounds,
	encodeScore,
	getDefaultScoreType,
	type WorkoutScheme as ScoringWorkoutScheme,
	STATUS_ORDER,
	sortKeyToString,
} from "@/lib/scoring"
import { autochunk, chunk, SQL_BATCH_SIZE } from "@/utils/batch-query"

const BATCH_SIZE = SQL_BATCH_SIZE

// ============================================================================
// Types
// ============================================================================

/** Round score data for multi-round workouts */
export interface RoundScoreData {
	score: string
	/** For rounds+reps format: [rounds, reps] */
	parts?: [string, string]
}

/** Existing set data from the score_rounds table */
export interface ExistingSetData {
	setNumber: number
	score: number | null
	reps: number | null
}

/** Team member info for team competitions */
export interface TeamMemberInfo {
	userId: string
	firstName: string
	lastName: string
	isCaptain: boolean
}

export interface EventScoreEntryAthlete {
	registrationId: string
	userId: string
	firstName: string
	lastName: string
	email: string
	divisionId: string | null
	divisionLabel: string
	/** Team name for team competitions (null for individuals) */
	teamName: string | null
	/** Team members including captain (empty for individuals) */
	teamMembers: TeamMemberInfo[]
	existingResult: {
		resultId: string
		wodScore: string | null
		scoreStatus: ScoreStatus | null
		tieBreakScore: string | null
		secondaryScore: string | null
		/** Existing sets for multi-round workouts */
		sets: ExistingSetData[]
	} | null
}

export interface EventScoreEntryData {
	event: {
		id: string
		trackOrder: number
		pointsMultiplier: number | null
		workout: {
			id: string
			name: string
			description: string
			scheme: WorkoutScheme
			scoreType: ScoreType | null
			tiebreakScheme: TiebreakScheme | null
			timeCap: number | null
			repsPerRound: number | null
			roundsToScore: number | null
		}
	}
	athletes: EventScoreEntryAthlete[]
	divisions: Array<{ id: string; label: string; position: number }>
}

/** Heat info with assignment context for score entry UI */
export interface HeatScoreGroup {
	heatId: string
	heatNumber: number
	scheduledTime: Date | null
	venue: { id: string; name: string } | null
	division: { id: string; label: string } | null
	/** Lane assignments with registration IDs for linking to athletes */
	assignments: Array<{
		laneNumber: number
		registrationId: string
	}>
}

/** Response for heat-grouped score entry data */
export interface EventScoreEntryDataWithHeats extends EventScoreEntryData {
	heats: HeatScoreGroup[]
	/** Registration IDs that are not assigned to any heat */
	unassignedRegistrationIds: string[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if current time is within the event's submission window.
 * Only applies to online competitions.
 */
async function isWithinSubmissionWindow(
	competitionId: string,
	trackWorkoutId: string,
): Promise<{ allowed: boolean; reason?: string }> {
	const db = getDb()

	// Get competition type
	const [competition] = await db
		.select({
			competitionType: competitionsTable.competitionType,
		})
		.from(competitionsTable)
		.where(eq(competitionsTable.id, competitionId))
		.limit(1)

	if (!competition) {
		return { allowed: false, reason: "Competition not found" }
	}

	// Only check submission windows for online competitions
	if (competition.competitionType !== "online") {
		return { allowed: true }
	}

	// Get competition event with submission window
	const [event] = await db
		.select({
			submissionOpensAt: competitionEventsTable.submissionOpensAt,
			submissionClosesAt: competitionEventsTable.submissionClosesAt,
		})
		.from(competitionEventsTable)
		.where(
			and(
				eq(competitionEventsTable.competitionId, competitionId),
				eq(competitionEventsTable.trackWorkoutId, trackWorkoutId),
			),
		)
		.limit(1)

	// If no event record exists, allow submission (backward compatibility)
	if (!event) {
		return { allowed: true }
	}

	// If no submission window is configured, allow submission
	if (!event.submissionOpensAt || !event.submissionClosesAt) {
		return { allowed: true }
	}

	// Check if current time is within the window
	const now = new Date()
	const opensAt = new Date(event.submissionOpensAt)
	const closesAt = new Date(event.submissionClosesAt)

	if (now < opensAt) {
		return {
			allowed: false,
			reason: `Submission window opens at ${opensAt.toISOString()}`,
		}
	}

	if (now > closesAt) {
		return {
			allowed: false,
			reason: `Submission window closed at ${closesAt.toISOString()}`,
		}
	}

	return { allowed: true }
}

/**
 * Map ScoreStatus to statusOrder for the scores table.
 */
function getStatusOrder(status: ScoreStatus): number {
	switch (status) {
		case "scored":
			return STATUS_ORDER.scored // 0
		case "cap":
			return STATUS_ORDER.cap // 1
		case "dq":
			return STATUS_ORDER.dq // 2
		case "withdrawn":
		case "dns":
		case "dnf":
			return STATUS_ORDER.withdrawn // 3
		default:
			return STATUS_ORDER.scored // 0 - default to scored
	}
}

/**
 * Map ScoreStatus to the simplified status type for scores table.
 */
function mapToNewStatus(
	status: ScoreStatus,
): "scored" | "cap" | "dq" | "withdrawn" {
	switch (status) {
		case "scored":
			return "scored"
		case "cap":
			return "cap"
		case "dq":
			return "dq"
		case "withdrawn":
		case "dns":
		case "dnf":
			return "withdrawn"
		default:
			return "scored"
	}
}

// ============================================================================
// Input Schemas
// ============================================================================

const getEventScoreEntryDataInputSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	divisionId: z.string().optional(),
})

/** Schema for round score data */
const roundScoreSchema = z.object({
	score: z.string(),
	parts: z.tuple([z.string(), z.string()]).optional(),
})

/** Schema for workout info needed for proper score processing */
const workoutInfoSchema = z.object({
	scheme: z.string(),
	scoreType: z.string().nullable(),
	repsPerRound: z.number().nullable(),
	roundsToScore: z.number().nullable(),
	timeCap: z.number().nullable(),
	tiebreakScheme: z.string().nullable().optional(),
})

const saveCompetitionScoreInputSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	workoutId: z.string().min(1),
	registrationId: z.string().min(1),
	userId: z.string().min(1),
	divisionId: z.string().nullable(),
	score: z.string(),
	scoreStatus: z.enum(SCORE_STATUS_VALUES),
	tieBreakScore: z.string().nullable().optional(),
	secondaryScore: z.string().nullable().optional(),
	/** Round scores for multi-round workouts */
	roundScores: z.array(roundScoreSchema).optional(),
	/** Workout info for proper score processing */
	workout: workoutInfoSchema.optional(),
})

const saveCompetitionScoresInputSchema = z.object({
	competitionId: z.string().min(1),
	organizingTeamId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	workoutId: z.string().min(1),
	scores: z.array(
		z.object({
			registrationId: z.string().min(1),
			userId: z.string().min(1),
			divisionId: z.string().nullable(),
			score: z.string(),
			scoreStatus: z.enum(SCORE_STATUS_VALUES),
			tieBreakScore: z.string().nullable().optional(),
			secondaryScore: z.string().nullable().optional(),
		}),
	),
})

const deleteCompetitionScoreInputSchema = z.object({
	organizingTeamId: z.string().min(1),
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	userId: z.string().min(1),
})

// ============================================================================
// Internal Helper: Get heats for a workout
// ============================================================================

interface HeatWithAssignmentsInternal extends CompetitionHeat {
	venue: { id: string; name: string } | null
	division: { id: string; label: string } | null
	assignments: Array<{
		laneNumber: number
		registrationId: string
	}>
}

async function getHeatsForWorkoutInternal(
	trackWorkoutId: string,
): Promise<HeatWithAssignmentsInternal[]> {
	const db = getDb()

	// Get heats
	const heats = await db
		.select()
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))

	if (heats.length === 0) {
		return []
	}

	// Get venue IDs and division IDs
	const venueIds = heats
		.map((h) => h.venueId)
		.filter((id): id is string => id !== null)
	const divisionIds = heats
		.map((h) => h.divisionId)
		.filter((id): id is string => id !== null)

	// Fetch venues
	const venues =
		venueIds.length > 0
			? await db
					.select({
						id: competitionVenuesTable.id,
						name: competitionVenuesTable.name,
					})
					.from(competitionVenuesTable)
					.where(inArray(competitionVenuesTable.id, venueIds))
			: []
	const venueMap = new Map(venues.map((v) => [v.id, v]))

	// Fetch divisions
	const divisions =
		divisionIds.length > 0
			? await db
					.select({
						id: scalingLevelsTable.id,
						label: scalingLevelsTable.label,
					})
					.from(scalingLevelsTable)
					.where(inArray(scalingLevelsTable.id, divisionIds))
			: []
	const divisionMap = new Map(divisions.map((d) => [d.id, d]))

	// Fetch assignments in batches
	const heatIds = heats.map((h) => h.id)
	const assignmentBatches = await Promise.all(
		chunk(heatIds, BATCH_SIZE).map((batch) =>
			db
				.select({
					heatId: competitionHeatAssignmentsTable.heatId,
					laneNumber: competitionHeatAssignmentsTable.laneNumber,
					registrationId: competitionHeatAssignmentsTable.registrationId,
				})
				.from(competitionHeatAssignmentsTable)
				.where(inArray(competitionHeatAssignmentsTable.heatId, batch)),
		),
	)
	const assignments = assignmentBatches.flat()

	// Group assignments by heat
	const assignmentsByHeat = new Map<string, typeof assignments>()
	for (const assignment of assignments) {
		const existing = assignmentsByHeat.get(assignment.heatId) ?? []
		existing.push(assignment)
		assignmentsByHeat.set(assignment.heatId, existing)
	}

	// Build result
	return heats.map((heat) => ({
		...heat,
		venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
		division: heat.divisionId
			? (divisionMap.get(heat.divisionId) ?? null)
			: null,
		assignments: (assignmentsByHeat.get(heat.id) ?? []).map((a) => ({
			laneNumber: a.laneNumber,
			registrationId: a.registrationId,
		})),
	}))
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get athletes and existing scores for a competition event
 */
export const getEventScoreEntryDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getEventScoreEntryDataInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventScoreEntryData> => {
		const db = getDb()

		// Get the track workout (event) with workout details
		const [result] = await db
			.select({
				trackWorkoutId: trackWorkoutsTable.id,
				trackOrder: trackWorkoutsTable.trackOrder,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				workoutId: workouts.id,
				workoutName: workouts.name,
				workoutDescription: workouts.description,
				workoutScheme: workouts.scheme,
				workoutScoreType: workouts.scoreType,
				workoutTiebreakScheme: workouts.tiebreakScheme,
				workoutTimeCap: workouts.timeCap,
				workoutRepsPerRound: workouts.repsPerRound,
				workoutRoundsToScore: workouts.roundsToScore,
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
			.limit(1)

		if (!result) {
			throw new Error("Event not found")
		}

		// Restructure to match expected format
		const trackWorkout = {
			id: result.trackWorkoutId,
			trackOrder: result.trackOrder,
			pointsMultiplier: result.pointsMultiplier,
			workout: {
				id: result.workoutId,
				name: result.workoutName,
				description: result.workoutDescription,
				scheme: result.workoutScheme as WorkoutScheme,
				scoreType: result.workoutScoreType as ScoreType | null,
				tiebreakScheme: result.workoutTiebreakScheme as TiebreakScheme | null,
				timeCap: result.workoutTimeCap,
				repsPerRound: result.workoutRepsPerRound,
				roundsToScore: result.workoutRoundsToScore,
			},
		}

		// Get all registrations for this competition
		const registrations = await db
			.select({
				registration: competitionRegistrationsTable,
				user: userTable,
				division: scalingLevelsTable,
			})
			.from(competitionRegistrationsTable)
			.innerJoin(
				userTable,
				eq(competitionRegistrationsTable.userId, userTable.id),
			)
			.leftJoin(
				scalingLevelsTable,
				eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
			)
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

		// Filter by division if specified
		const filteredRegistrations = data.divisionId
			? registrations.filter(
					(r) => r.registration.divisionId === data.divisionId,
				)
			: registrations

		// Get existing scores for this event from scores table (chunked to avoid D1 parameter limit)
		const userIds = filteredRegistrations.map((r) => r.user.id)
		const existingScores =
			userIds.length > 0
				? await autochunk(
						{ items: userIds, otherParametersCount: 1 },
						async (userChunk) =>
							db
								.select()
								.from(scoresTable)
								.where(
									and(
										eq(scoresTable.competitionEventId, data.trackWorkoutId),
										inArray(scoresTable.userId, userChunk),
									),
								),
					)
				: []

		// Get score_rounds for all existing scores (chunked to avoid D1 parameter limit)
		const scoreIds = existingScores.map((s) => s.id)
		const existingRounds =
			scoreIds.length > 0
				? await autochunk({ items: scoreIds }, async (scoreChunk) =>
						db
							.select({
								scoreId: scoreRoundsTable.scoreId,
								roundNumber: scoreRoundsTable.roundNumber,
								value: scoreRoundsTable.value,
							})
							.from(scoreRoundsTable)
							.where(inArray(scoreRoundsTable.scoreId, scoreChunk)),
					)
				: []

		// Group rounds by scoreId and convert to legacy format
		const setsByScoreId = new Map<string, ExistingSetData[]>()
		for (const round of existingRounds) {
			const existing = setsByScoreId.get(round.scoreId) || []

			const scheme = existingScores.find((s) => s.id === round.scoreId)?.scheme
			let score: number | null = null
			let reps: number | null = null

			if (scheme === "rounds-reps") {
				const rounds = Math.floor(round.value / 100000)
				reps = round.value % 100000
				score = rounds
			} else if (
				scheme === "time" ||
				scheme === "time-with-cap" ||
				scheme === "emom"
			) {
				score = Math.round(round.value / 1000)
			} else if (scheme === "load") {
				score = Math.round(round.value / 453.592)
			} else if (scheme === "meters") {
				score = Math.round(round.value / 1000)
			} else if (scheme === "feet") {
				score = Math.round(round.value / 304.8)
			} else {
				score = round.value
			}

			existing.push({
				setNumber: round.roundNumber,
				score,
				reps,
			})
			setsByScoreId.set(round.scoreId, existing)
		}

		// Create a map of userId to score
		const scoresByUserId = new Map(existingScores.map((s) => [s.userId, s]))

		// Get unique divisions for the filter dropdown
		const divisionIds = [
			...new Set(
				registrations
					.map((r) => r.registration.divisionId)
					.filter((id): id is string => id !== null),
			),
		]

		const divisions =
			divisionIds.length > 0
				? await autochunk({ items: divisionIds }, async (divChunk) =>
						db
							.select({
								id: scalingLevelsTable.id,
								label: scalingLevelsTable.label,
								position: scalingLevelsTable.position,
							})
							.from(scalingLevelsTable)
							.where(inArray(scalingLevelsTable.id, divChunk)),
					)
				: []

		// Get team members for team registrations
		const athleteTeamIds = [
			...new Set(
				filteredRegistrations
					.map((r) => r.registration.athleteTeamId)
					.filter((id): id is string => id !== null),
			),
		]

		// Fetch team memberships with user info for all athlete teams
		const teamMemberships =
			athleteTeamIds.length > 0
				? await autochunk({ items: athleteTeamIds }, async (teamChunk) =>
						db
							.select({
								teamId: teamMembershipTable.teamId,
								userId: teamMembershipTable.userId,
								firstName: userTable.firstName,
								lastName: userTable.lastName,
							})
							.from(teamMembershipTable)
							.innerJoin(
								userTable,
								eq(teamMembershipTable.userId, userTable.id),
							)
							.where(inArray(teamMembershipTable.teamId, teamChunk)),
					)
				: []

		// Group team members by teamId
		const membersByTeamId = new Map<
			string,
			Array<{
				userId: string
				firstName: string | null
				lastName: string | null
			}>
		>()
		for (const membership of teamMemberships) {
			const existing = membersByTeamId.get(membership.teamId) || []
			existing.push({
				userId: membership.userId,
				firstName: membership.firstName,
				lastName: membership.lastName,
			})
			membersByTeamId.set(membership.teamId, existing)
		}

		// Build athletes array
		const athletes: EventScoreEntryAthlete[] = filteredRegistrations.map(
			(reg) => {
				const existingScore = scoresByUserId.get(reg.user.id)
				const scoreSets = existingScore
					? (setsByScoreId.get(existingScore.id) || []).sort(
							(a, b) => a.setNumber - b.setNumber,
						)
					: []

				// Get team members if this is a team registration
				const athleteTeamId = reg.registration.athleteTeamId
				const captainUserId = reg.registration.captainUserId || reg.user.id
				const teamMembers: TeamMemberInfo[] = athleteTeamId
					? (membersByTeamId.get(athleteTeamId) || []).map((member) => ({
							userId: member.userId,
							firstName: member.firstName || "",
							lastName: member.lastName || "",
							isCaptain: member.userId === captainUserId,
						}))
					: []

				// Sort team members: captain first, then alphabetically by last name
				teamMembers.sort((a, b) => {
					if (a.isCaptain && !b.isCaptain) return -1
					if (!a.isCaptain && b.isCaptain) return 1
					return a.lastName.localeCompare(b.lastName)
				})

				// Decode scores from encoding to display format
				let wodScore = ""
				let tieBreakScore: string | null = null
				let secondaryScore: string | null = null

				if (existingScore) {
					// Decode primary score
					if (existingScore.scoreValue !== null) {
						wodScore = decodeScore(
							existingScore.scoreValue,
							existingScore.scheme as ScoringWorkoutScheme,
							{ compact: false },
						)
					}

					// Decode tiebreak score if present
					if (
						existingScore.tiebreakValue !== null &&
						existingScore.tiebreakScheme
					) {
						tieBreakScore = decodeScore(
							existingScore.tiebreakValue,
							existingScore.tiebreakScheme as ScoringWorkoutScheme,
							{ compact: false },
						)
					}

					// Decode secondary score if present
					if (existingScore.secondaryValue !== null) {
						secondaryScore = String(existingScore.secondaryValue)
					}
				}

				return {
					registrationId: reg.registration.id,
					userId: reg.user.id,
					firstName: reg.user.firstName || "",
					lastName: reg.user.lastName || "",
					email: reg.user.email || "",
					divisionId: reg.registration.divisionId,
					divisionLabel: reg.division?.label || "Open",
					teamName: reg.registration.teamName || null,
					teamMembers,
					existingResult: existingScore
						? {
								resultId: existingScore.id,
								wodScore,
								scoreStatus: existingScore.status as ScoreStatus | null,
								tieBreakScore,
								secondaryScore,
								sets: scoreSets,
							}
						: null,
				}
			},
		)

		// Sort by division label, then by team name (or last name for individuals)
		athletes.sort((a, b) => {
			if (a.divisionLabel !== b.divisionLabel) {
				return a.divisionLabel.localeCompare(b.divisionLabel)
			}
			const aName = a.teamName || a.lastName
			const bName = b.teamName || b.lastName
			return aName.localeCompare(bName)
		})

		return {
			event: {
				id: trackWorkout.id,
				trackOrder: trackWorkout.trackOrder,
				pointsMultiplier: trackWorkout.pointsMultiplier,
				workout: trackWorkout.workout,
			},
			athletes,
			divisions: divisions.sort((a, b) => a.position - b.position),
		}
	})

/**
 * Get score entry data with heat groupings for a competition event.
 * This extends getEventScoreEntryData with heat assignment information.
 */
export const getEventScoreEntryDataWithHeatsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getEventScoreEntryDataInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EventScoreEntryDataWithHeats> => {
		// Get the base score entry data
		const baseData = await getEventScoreEntryDataFn({ data })

		// Get heats for this workout
		const heatsWithAssignments = await getHeatsForWorkoutInternal(
			data.trackWorkoutId,
		)

		// Build a set of all assigned registration IDs
		const assignedRegistrationIds = new Set<string>()
		for (const heat of heatsWithAssignments) {
			for (const assignment of heat.assignments) {
				assignedRegistrationIds.add(assignment.registrationId)
			}
		}

		// Find unassigned registration IDs (athletes in baseData but not in any heat)
		const allRegistrationIds = new Set(
			baseData.athletes.map((a) => a.registrationId),
		)
		const unassignedRegistrationIds = [...allRegistrationIds].filter(
			(id) => !assignedRegistrationIds.has(id),
		)

		// Transform heats to simplified format for UI
		const heats: HeatScoreGroup[] = heatsWithAssignments.map((heat) => ({
			heatId: heat.id,
			heatNumber: heat.heatNumber,
			scheduledTime: heat.scheduledTime,
			venue: heat.venue,
			division: heat.division,
			assignments: heat.assignments.map((a) => ({
				laneNumber: a.laneNumber,
				registrationId: a.registrationId,
			})),
		}))

		// Sort heats by number
		heats.sort((a, b) => a.heatNumber - b.heatNumber)

		return {
			...baseData,
			heats,
			unassignedRegistrationIds,
		}
	})

/**
 * Save a single athlete's competition score
 */
export const saveCompetitionScoreFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		saveCompetitionScoreInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			success: boolean
			data: { resultId: string; isNew: boolean }
		}> => {
			const db = getDb()

			// Check submission window for online competitions
			const submissionCheck = await isWithinSubmissionWindow(
				data.competitionId,
				data.trackWorkoutId,
			)

			if (!submissionCheck.allowed) {
				throw new Error(
					submissionCheck.reason || "Score submission not allowed at this time",
				)
			}

			// Validate workout info is provided
			if (!data.workout) {
				throw new Error("Workout info is required to save competition score")
			}

			const scheme = data.workout.scheme as ScoringWorkoutScheme
			const scoreType =
				(data.workout.scoreType as ScoreType) || getDefaultScoreType(scheme)

			// Encode score using encoding
			let encodedValue: number | null = null

			if (data.roundScores && data.roundScores.length > 0) {
				// Multi-round: encode each round and aggregate
				const roundInputs = data.roundScores.map((rs) => ({ raw: rs.score }))
				const result = encodeRounds(roundInputs, scheme, scoreType)
				encodedValue = result.aggregated
			} else if (data.score?.trim()) {
				// Single score: encode directly
				encodedValue = encodeScore(data.score, scheme)
			}

			// Map status to simplified type
			const newStatus = mapToNewStatus(data.scoreStatus)

			// Handle CAP status for time-with-cap workouts
			if (
				newStatus === "cap" &&
				scheme === "time-with-cap" &&
				data.workout.timeCap
			) {
				encodedValue = data.workout.timeCap * 1000
			}

			// Parse secondary score (reps completed at cap) if provided
			let secondaryValue: number | null = null
			if (data.secondaryScore && newStatus === "cap") {
				const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
				if (!Number.isNaN(parsed) && parsed >= 0) {
					secondaryValue = parsed
				}
			}

			// Store time cap in milliseconds for reference
			const timeCapMs = data.workout.timeCap
				? data.workout.timeCap * 1000
				: null

			// Compute sort key for efficient leaderboard queries
			const sortKey =
				encodedValue !== null
					? computeSortKey({
							value: encodedValue,
							status: newStatus,
							scheme,
							scoreType,
						})
					: null

			// Get teamId from competition context
			const [teamResult] = await db
				.select({
					ownerTeamId: programmingTracksTable.ownerTeamId,
				})
				.from(trackWorkoutsTable)
				.innerJoin(
					programmingTracksTable,
					eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
				)
				.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
				.limit(1)

			if (!teamResult?.ownerTeamId) {
				throw new Error("Could not determine team ownership for competition")
			}

			const teamId = teamResult.ownerTeamId

			// Encode tiebreak if provided
			let tiebreakValue: number | null = null
			if (data.tieBreakScore && data.workout.tiebreakScheme) {
				try {
					tiebreakValue = encodeScore(
						data.tieBreakScore,
						data.workout.tiebreakScheme as ScoringWorkoutScheme,
					)
				} catch (_error) {
					// Silently ignore tiebreak encoding errors
				}
			}

			// Insert/update scores table
			await db
				.insert(scoresTable)
				.values({
					userId: data.userId,
					teamId,
					workoutId: data.workoutId,
					competitionEventId: data.trackWorkoutId,
					scheme,
					scoreType,
					scoreValue: encodedValue,
					status: newStatus,
					statusOrder: getStatusOrder(data.scoreStatus),
					sortKey: sortKey ? sortKeyToString(sortKey) : null,
					tiebreakScheme:
						(data.workout.tiebreakScheme as TiebreakScheme) ?? null,
					tiebreakValue,
					timeCapMs,
					secondaryValue,
					scalingLevelId: data.divisionId,
					asRx: true,
					recordedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [scoresTable.competitionEventId, scoresTable.userId],
					set: {
						scoreValue: encodedValue,
						status: newStatus,
						statusOrder: getStatusOrder(data.scoreStatus),
						sortKey: sortKey ? sortKeyToString(sortKey) : null,
						tiebreakScheme:
							(data.workout.tiebreakScheme as TiebreakScheme) ?? null,
						tiebreakValue,
						timeCapMs,
						secondaryValue,
						scalingLevelId: data.divisionId,
						updatedAt: new Date(),
					},
				})

			// Get the final score ID (either new or existing)
			const [finalScore] = await db
				.select({ id: scoresTable.id })
				.from(scoresTable)
				.where(
					and(
						eq(scoresTable.competitionEventId, data.trackWorkoutId),
						eq(scoresTable.userId, data.userId),
					),
				)
				.limit(1)

			if (!finalScore) {
				throw new Error("Failed to retrieve score after upsert")
			}

			const scoreId = finalScore.id

			// Handle score_rounds - delete existing and insert new
			if (data.roundScores && data.roundScores.length > 0) {
				// Delete existing rounds
				await db
					.delete(scoreRoundsTable)
					.where(eq(scoreRoundsTable.scoreId, scoreId))

				// Convert and insert new rounds
				const roundsToInsert = data.roundScores.map((round, index) => {
					let roundValue: number

					if (scheme === "rounds-reps") {
						const roundsNum =
							Number.parseInt(round.parts?.[0] ?? round.score, 10) || 0
						const reps = Number.parseInt(round.parts?.[1] ?? "0", 10) || 0
						roundValue = roundsNum * 100000 + reps
					} else if (
						scheme === "time" ||
						scheme === "time-with-cap" ||
						scheme === "emom"
					) {
						roundValue = encodeScore(round.score, scheme) ?? 0
					} else {
						roundValue = encodeScore(round.score, scheme) ?? 0
					}

					return {
						scoreId,
						roundNumber: index + 1,
						value: roundValue,
						status: null,
					}
				})

				// Batch insert rounds
				const ROUND_BATCH_SIZE = 10
				await Promise.all(
					chunk(roundsToInsert, ROUND_BATCH_SIZE).map((batch) =>
						db.insert(scoreRoundsTable).values(batch),
					),
				)
			}

			return { success: true, data: { resultId: scoreId, isNew: true } }
		},
	)

/**
 * Batch save multiple competition scores
 */
export const saveCompetitionScoresFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		saveCompetitionScoresInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			success: boolean
			data: {
				savedCount: number
				errors: Array<{ userId: string; error: string }>
			}
		}> => {
			const errors: Array<{ userId: string; error: string }> = []
			let savedCount = 0

			// Check submission window for online competitions
			const submissionCheck = await isWithinSubmissionWindow(
				data.competitionId,
				data.trackWorkoutId,
			)

			if (!submissionCheck.allowed) {
				throw new Error(
					submissionCheck.reason || "Score submission not allowed at this time",
				)
			}

			// Get workout info for all scores
			const db = getDb()
			const [workoutResult] = await db
				.select({
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					repsPerRound: workouts.repsPerRound,
					roundsToScore: workouts.roundsToScore,
					timeCap: workouts.timeCap,
					tiebreakScheme: workouts.tiebreakScheme,
				})
				.from(workouts)
				.where(eq(workouts.id, data.workoutId))
				.limit(1)

			if (!workoutResult) {
				throw new Error("Workout not found")
			}

			for (const scoreData of data.scores) {
				try {
					await saveCompetitionScoreFn({
						data: {
							competitionId: data.competitionId,
							organizingTeamId: data.organizingTeamId,
							trackWorkoutId: data.trackWorkoutId,
							workoutId: data.workoutId,
							registrationId: scoreData.registrationId,
							userId: scoreData.userId,
							divisionId: scoreData.divisionId,
							score: scoreData.score,
							scoreStatus: scoreData.scoreStatus,
							tieBreakScore: scoreData.tieBreakScore,
							secondaryScore: scoreData.secondaryScore,
							workout: workoutResult,
						},
					})
					savedCount++
				} catch (error) {
					errors.push({
						userId: scoreData.userId,
						error: error instanceof Error ? error.message : "Unknown error",
					})
				}
			}

			return { success: true, data: { savedCount, errors } }
		},
	)

/**
 * Delete a competition score
 */
export const deleteCompetitionScoreFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		deleteCompetitionScoreInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<{ success: boolean }> => {
		const db = getDb()

		// Delete from scores table (score_rounds are cascade deleted)
		await db
			.delete(scoresTable)
			.where(
				and(
					eq(scoresTable.competitionEventId, data.trackWorkoutId),
					eq(scoresTable.userId, data.userId),
				),
			)

		return { success: true }
	})

// ============================================================================
// Volunteer Score Access Functions
// These functions check for score access entitlement instead of organizer permissions
// ============================================================================

/**
 * Check if the current user has score access for a competition team
 */
async function requireScoreAccess(competitionTeamId: string): Promise<void> {
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new Error("Not authenticated")
	}

	const db = getDb()
	const entitlements = await db.query.entitlementTable.findMany({
		where: and(
			eq(entitlementTable.userId, session.userId),
			eq(entitlementTable.teamId, competitionTeamId),
			eq(entitlementTable.entitlementTypeId, "competition_score_input"),
			isNull(entitlementTable.deletedAt),
			or(
				isNull(entitlementTable.expiresAt),
				gt(entitlementTable.expiresAt, new Date()),
			),
		),
	})

	if (entitlements.length === 0) {
		throw new Error("Missing score access permission")
	}
}

const volunteerScoreAccessInputSchema = z.object({
	competitionId: z.string().min(1),
	competitionTeamId: z.string().min(1),
})

/**
 * Get competition workouts for volunteers with score access
 * This is a simplified version that only requires score access entitlement
 */
export const getCompetitionWorkoutsForScoreEntryFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		volunteerScoreAccessInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Check score access permission
		await requireScoreAccess(data.competitionTeamId)

		const db = getDb()

		// Get the competition's programming track via programmingTracksTable
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		if (!track) {
			return { workouts: [] }
		}

		// Get all workouts for this track
		const trackWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				trackId: trackWorkoutsTable.trackId,
				workoutId: trackWorkoutsTable.workoutId,
				trackOrder: trackWorkoutsTable.trackOrder,
				notes: trackWorkoutsTable.notes,
				pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
				heatStatus: trackWorkoutsTable.heatStatus,
				eventStatus: trackWorkoutsTable.eventStatus,
				sponsorId: trackWorkoutsTable.sponsorId,
				createdAt: trackWorkoutsTable.createdAt,
				updatedAt: trackWorkoutsTable.updatedAt,
				workout: {
					id: workouts.id,
					name: workouts.name,
					description: workouts.description,
					scheme: workouts.scheme,
					scoreType: workouts.scoreType,
					roundsToScore: workouts.roundsToScore,
					repsPerRound: workouts.repsPerRound,
					tiebreakScheme: workouts.tiebreakScheme,
					timeCap: workouts.timeCap,
				},
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(eq(trackWorkoutsTable.trackId, track.id))
			.orderBy(trackWorkoutsTable.trackOrder)

		return { workouts: trackWorkouts }
	})

/**
 * Get competition divisions for volunteers with score access
 * This is a simplified version that only requires score access entitlement
 */
export const getCompetitionDivisionsForScoreEntryFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		volunteerScoreAccessInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Check score access permission
		await requireScoreAccess(data.competitionTeamId)

		const db = getDb()

		// Get competition settings to find the scaling group
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Parse settings to get scaling group ID
		let scalingGroupId: string | null = null
		if (competition.settings) {
			try {
				const settings = JSON.parse(competition.settings) as {
					divisions?: { scalingGroupId?: string }
				}
				scalingGroupId = settings?.divisions?.scalingGroupId ?? null
			} catch {
				// Ignore parse errors
			}
		}

		if (!scalingGroupId) {
			return { divisions: [] }
		}

		// Get divisions
		const divisions = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
			})
			.from(scalingLevelsTable)
			.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
			.orderBy(scalingLevelsTable.position)

		return { divisions }
	})
