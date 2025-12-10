import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray } from "drizzle-orm"
import { ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import { autochunk } from "@/utils/batch-query"
import {
	competitionRegistrationsTable,
	scalingLevelsTable,
	scoresTable,
	scoreRoundsTable,
	teamMembershipTable,
	trackWorkoutsTable,
	userTable,
	type ScoreStatus,
	type WorkoutScheme,
	type ScoreType,
	type TiebreakScheme,
	type SecondaryScheme,
} from "@/db/schema"
import {
	processScoresToSetsAndWodScore,
	type WorkoutScoreInfo,
	type NormalizedScoreEntry,
} from "@/server/logs"
import { getSessionFromCookie } from "@/utils/auth"
import {
	logInfo,
	logWarning,
	logError,
} from "@/lib/logging/posthog-otel-logger"
import { getHeatsForWorkout } from "./competition-heats"
import { encodeScore, encodeRounds, computeSortKey, decodeScore, sortKeyToString, getDefaultScoreType, encodeRoundsReps } from "@/lib/scoring"
import { STATUS_ORDER } from "@/lib/scoring/constants"
import { convertLegacyToNew } from "@/utils/score-adapter"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map ScoreStatus to statusOrder for the new scores table.
 * The old results table uses more status values, but the new scores table
 * uses a simplified set focused on competition scoring.
 */
function getStatusOrder(status: ScoreStatus): number {
	// Map old status values to new simplified set
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
 * Map ScoreStatus to the simplified status type for new scores table.
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

/**
 * Convert legacy set data to encoded value for new scores table.
 * Uses the first set's score/reps for the primary value.
 */
function convertSetsToEncodedValue(
	setsData: Array<{
		score: number | null
		reps: number | null
		time: number | null
	}>,
	scheme: WorkoutScheme,
): number | null {
	if (setsData.length === 0) return null

	const firstSet = setsData[0]
	if (!firstSet) return null

	// For rounds-reps, use score (rounds) and reps
	if (scheme === "rounds-reps") {
		const rounds = firstSet.score ?? 0
		const reps = firstSet.reps ?? 0
		// Legacy: rounds * 1000 + reps
		const legacyValue = rounds * 1000 + reps
		return convertLegacyToNew(legacyValue, scheme)
	}

	// For time-based schemes, use time in seconds (legacy format)
	if (
		scheme === "time" ||
		scheme === "time-with-cap" ||
		scheme === "emom"
	) {
		const timeInSeconds = firstSet.time ?? 0
		return convertLegacyToNew(timeInSeconds, scheme)
	}

	// For other schemes, use score directly
	const value = firstSet.score ?? null
	if (value === null) return null
	return convertLegacyToNew(value, scheme)
}

// ============================================================================
// Heat-Based Score Entry Types
// ============================================================================

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
// Verification Functions
// ============================================================================

/**
 * Verify that a track workout belongs to the specified competition team.
 * This provides defense-in-depth security by validating ownership at the data layer.
 */
async function verifyTrackWorkoutOwnership(
	trackWorkoutId: string,
	competitionTeamId: string,
): Promise<void> {
	const db = getDb()

	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, trackWorkoutId),
		with: {
			track: {
				columns: {
					ownerTeamId: true,
				},
			},
		},
	})

	if (!trackWorkout) {
		throw new ZSAError("NOT_FOUND", "Event not found")
	}

	if (trackWorkout.track?.ownerTeamId !== competitionTeamId) {
		throw new ZSAError(
			"NOT_AUTHORIZED",
			"Not authorized to access this competition event",
		)
	}
}

/** Round score data for multi-round workouts */
export interface RoundScoreData {
	score: string
	/** For rounds+reps format: [rounds, reps] */
	parts?: [string, string]
}

/** Existing set data from the sets table */
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
			secondaryScheme: SecondaryScheme | null
			repsPerRound: number | null
			roundsToScore: number | null
		}
	}
	athletes: EventScoreEntryAthlete[]
	divisions: Array<{ id: string; label: string; position: number }>
}

/**
 * Get athletes and existing scores for a competition event
 */
export async function getEventScoreEntryData(params: {
	competitionId: string
	trackWorkoutId: string
	competitionTeamId: string
	divisionId?: string
}): Promise<EventScoreEntryData> {
	// Defense-in-depth: Verify session exists
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
	}

	// Defense-in-depth: Verify team ownership
	await verifyTrackWorkoutOwnership(
		params.trackWorkoutId,
		params.competitionTeamId,
	)

	const db = getDb()

	// Get the track workout (event) with workout details
	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, params.trackWorkoutId),
		with: {
			workout: true,
		},
	})

	if (!trackWorkout || !trackWorkout.workout) {
		throw new ZSAError("NOT_FOUND", "Event not found")
	}

	// Get all registrations for this competition
	const registrationsQuery = db
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
		.where(eq(competitionRegistrationsTable.eventId, params.competitionId))

	const registrations = await registrationsQuery

	// Filter by division if specified
	const filteredRegistrations = params.divisionId
		? registrations.filter(
				(r) => r.registration.divisionId === params.divisionId,
			)
		: registrations

	// Get existing scores for this event from new scores table (chunked to avoid D1 parameter limit)
	const userIds = filteredRegistrations.map((r) => r.user.id)
	const existingScores =
		userIds.length > 0
			? await autochunk(
					{ items: userIds, otherParametersCount: 1 },
					async (chunk) =>
						db
							.select()
							.from(scoresTable)
							.where(
								and(
									eq(scoresTable.competitionEventId, params.trackWorkoutId),
									inArray(scoresTable.userId, chunk),
								),
							),
				)
			: []

	// Get score_rounds for all existing scores (chunked to avoid D1 parameter limit)
	const scoreIds = existingScores.map((s) => s.id)
	const existingRounds =
		scoreIds.length > 0
			? await autochunk({ items: scoreIds }, async (chunk) =>
					db
						.select({
							scoreId: scoreRoundsTable.scoreId,
							roundNumber: scoreRoundsTable.roundNumber,
							value: scoreRoundsTable.value,
						})
						.from(scoreRoundsTable)
						.where(inArray(scoreRoundsTable.scoreId, chunk)),
				)
			: []

	// Group rounds by scoreId and convert to legacy format
	const setsByScoreId = new Map<string, ExistingSetData[]>()
	for (const round of existingRounds) {
		const existing = setsByScoreId.get(round.scoreId) || []
		
		// Convert from new encoding back to legacy format for display
		// IMPORTANT: For time schemes, we need to keep in seconds (not formatted string)
		// because the UI's parseScore function expects numeric seconds as input.
		// For rounds-reps: extract rounds and reps from encoded value
		// For other schemes: use value as-is
		const scheme = existingScores.find(s => s.id === round.scoreId)?.scheme
		let score: number | null = null
		let reps: number | null = null
		
		if (scheme === "rounds-reps") {
			// Encoded as rounds*100000+reps, extract both
			const rounds = Math.floor(round.value / 100000)
			reps = round.value % 100000
			score = rounds
		} else if (scheme === "time" || scheme === "time-with-cap" || scheme === "emom") {
			// Convert milliseconds to seconds
			// The UI will format this as HH:MM:SS using parseScore
			score = Math.round(round.value / 1000)
		} else if (scheme === "load") {
			// Convert grams to pounds (assuming US/imperial by default)
			score = Math.round(round.value / 453.592)
		} else if (scheme === "meters") {
			// Millimeters to meters
			score = Math.round(round.value / 1000)
		} else if (scheme === "feet") {
			// Millimeters to feet  
			score = Math.round(round.value / 304.8)
		} else {
			// For reps, calories, points, pass-fail: value is already correct
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
			? await autochunk({ items: divisionIds }, async (chunk) =>
					db
						.select({
							id: scalingLevelsTable.id,
							label: scalingLevelsTable.label,
							position: scalingLevelsTable.position,
						})
						.from(scalingLevelsTable)
						.where(inArray(scalingLevelsTable.id, chunk)),
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
			? await autochunk({ items: athleteTeamIds }, async (chunk) =>
					db
						.select({
							teamId: teamMembershipTable.teamId,
							userId: teamMembershipTable.userId,
							firstName: userTable.firstName,
							lastName: userTable.lastName,
						})
						.from(teamMembershipTable)
						.innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
						.where(inArray(teamMembershipTable.teamId, chunk)),
				)
			: []

	// Group team members by teamId
	const membersByTeamId = new Map<
		string,
		Array<{ userId: string; firstName: string | null; lastName: string | null }>
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

			// Decode scores from new encoding to display format
			let wodScore = ""
			let tieBreakScore: string | null = null
			let secondaryScore: string | null = null
			
			if (existingScore) {
				// Decode primary score (show milliseconds for time-based schemes)
				if (existingScore.scoreValue !== null) {
					wodScore = decodeScore(existingScore.scoreValue, existingScore.scheme, { compact: false })
				}
				
				// Decode tiebreak score if present (show milliseconds for time)
				if (existingScore.tiebreakValue && existingScore.tiebreakScheme) {
					tieBreakScore = decodeScore(existingScore.tiebreakValue, existingScore.tiebreakScheme, { compact: false })
				}
				
				// Decode secondary score if present (show milliseconds for time)
				if (existingScore.secondaryValue && existingScore.secondaryScheme) {
					secondaryScore = decodeScore(existingScore.secondaryValue, existingScore.secondaryScheme, { compact: false })
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
			workout: {
				id: trackWorkout.workout.id,
				name: trackWorkout.workout.name,
				description: trackWorkout.workout.description,
				scheme: trackWorkout.workout.scheme as WorkoutScheme,
				scoreType: trackWorkout.workout.scoreType as ScoreType | null,
				tiebreakScheme: trackWorkout.workout
					.tiebreakScheme as TiebreakScheme | null,
				timeCap: trackWorkout.workout.timeCap,
				secondaryScheme: trackWorkout.workout
					.secondaryScheme as SecondaryScheme | null,
				repsPerRound: trackWorkout.workout.repsPerRound,
				roundsToScore: trackWorkout.workout.roundsToScore,
			},
		},
		athletes,
		divisions: divisions.sort((a, b) => a.position - b.position),
	}
}

/**
 * Get score entry data with heat groupings for a competition event.
 * This extends getEventScoreEntryData with heat assignment information.
 */
export async function getEventScoreEntryDataWithHeats(params: {
	competitionId: string
	trackWorkoutId: string
	competitionTeamId: string
	divisionId?: string
}): Promise<EventScoreEntryDataWithHeats> {
	// Get the base score entry data
	const baseData = await getEventScoreEntryData(params)

	// Get heats for this workout
	const heatsWithAssignments = await getHeatsForWorkout(params.trackWorkoutId)

	// Build a set of all assigned registration IDs
	const assignedRegistrationIds = new Set<string>()
	for (const heat of heatsWithAssignments) {
		for (const assignment of heat.assignments) {
			assignedRegistrationIds.add(assignment.registration.id)
		}
	}

	// Find unassigned registration IDs (athletes in baseData but not in any heat)
	const allRegistrationIds = new Set(baseData.athletes.map((a) => a.registrationId))
	const unassignedRegistrationIds = [...allRegistrationIds].filter(
		(id) => !assignedRegistrationIds.has(id),
	)

	// Transform heats to simplified format for UI
	const heats: HeatScoreGroup[] = heatsWithAssignments.map((heat) => ({
		heatId: heat.id,
		heatNumber: heat.heatNumber,
		scheduledTime: heat.scheduledTime,
		venue: heat.venue ? { id: heat.venue.id, name: heat.venue.name } : null,
		division: heat.division,
		assignments: heat.assignments.map((a) => ({
			laneNumber: a.laneNumber,
			registrationId: a.registration.id,
		})),
	}))

	// Sort heats by number
	heats.sort((a, b) => a.heatNumber - b.heatNumber)

	return {
		...baseData,
		heats,
		unassignedRegistrationIds,
	}
}

/**
 * Convert RoundScoreData to NormalizedScoreEntry format used by shared functions
 */
function convertToNormalizedEntries(
	roundScores: RoundScoreData[],
): NormalizedScoreEntry[] {
	return roundScores.map((round) => ({
		score: round.score,
		parts: round.parts,
		timeCapped: false, // Competition scores don't currently track per-round time cap
	}))
}

/**
 * Save a single athlete's competition score
 * Uses the same score processing logic as submitLogForm via shared functions
 *
 * TODO Phase 4: Dual-write to new scores table
 * After Phase 4 migration:
 * 1. Use encodeScore() to encode the primary score to new format
 * 2. Use encodeRounds() for round-by-round data
 * 3. Insert into scores table alongside results table
 * 4. Populate sortKey column using computeSortKey()
 * 5. Eventually remove results+sets writes after verification
 */
export async function saveCompetitionScore(params: {
	competitionId: string
	trackWorkoutId: string
	registrationId: string
	userId: string
	divisionId: string | null
	workoutId: string
	score: string
	scoreStatus: ScoreStatus
	tieBreakScore?: string | null
	secondaryScore?: string | null
	/** Round scores for multi-round workouts - stored in sets table */
	roundScores?: RoundScoreData[]
	/** Workout info for proper score processing */
	workout?: WorkoutScoreInfo
	enteredBy: string
}): Promise<{ resultId: string; isNew: boolean }> {
	const db = getDb()

	logInfo({
		message: "[competition-scores] saveCompetitionScore called",
		attributes: {
			competitionId: params.competitionId,
			registrationId: params.registrationId,
			userId: params.userId,
			workoutId: params.workoutId,
			trackWorkoutId: params.trackWorkoutId,
			scoreStatus: params.scoreStatus,
		},
	})

	let finalWodScore = params.score
	let setsToInsert: Array<{
		id: string
		resultId: string
		setNumber: number
		score: number | null
		reps: number | null
		time: number | null
		weight: number | null
		distance: number | null
		status: "pass" | "fail" | null
	}> = []

	// Process round scores if provided using shared functions
	// TODO Phase 4: Also encode using encodeScore() and encodeRounds() here
	if (params.roundScores && params.roundScores.length > 0 && params.workout) {
		// Convert to normalized format used by shared functions
		const normalizedEntries = convertToNormalizedEntries(params.roundScores)

		// Use shared processing function from logs.ts
		const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
			normalizedEntries,
			params.workout,
		)

		finalWodScore = wodScore

		// Prepare sets for insertion (resultId will be set below)
		setsToInsert = setsForDb.map((set, index) => ({
			id: `set_${createId()}`,
			resultId: "", // Will be set after we have the result ID
			setNumber: index + 1,
			score: set.score ?? null,
			reps: set.reps ?? null,
			time: set.time ?? null,
			weight: set.weight ?? null,
			distance: set.distance ?? null,
			status: (set.status as "pass" | "fail" | null) ?? null,
		}))
	} else if (params.roundScores && params.roundScores.length > 0) {
		// Fallback: no workout info, use simple formatting (legacy behavior)
		const formattedRounds = params.roundScores.map((round) => {
			if (round.parts) {
				return `${round.parts[0] || "0"}+${round.parts[1] || "0"}`
			}
			return round.score || "0"
		})
		finalWodScore = formattedRounds.join(", ")

		// Simple sets without proper processing
		setsToInsert = params.roundScores.map((round, index) => {
			const scoreNum = parseInt(round.parts ? round.parts[0] : round.score, 10)
			const repsNum = round.parts?.[1] ? parseInt(round.parts[1], 10) : NaN
			return {
				id: `set_${createId()}`,
				resultId: "",
				setNumber: index + 1,
				score: Number.isNaN(scoreNum) ? null : scoreNum,
				reps: Number.isNaN(repsNum) ? null : repsNum,
				time: null,
				weight: null,
				distance: null,
				status: null,
			}
		})
	} else if (params.score && params.workout) {
		// Single score (no roundScores array) - still create a set
		const normalizedEntries: NormalizedScoreEntry[] = [
			{ score: params.score, parts: undefined, timeCapped: false },
		]

		const { setsForDb, wodScore } = processScoresToSetsAndWodScore(
			normalizedEntries,
			params.workout,
		)

		finalWodScore = wodScore

		setsToInsert = setsForDb.map((set, index) => ({
			id: `set_${createId()}`,
			resultId: "",
			setNumber: index + 1,
			score: set.score ?? null,
			reps: set.reps ?? null,
			time: set.time ?? null,
			weight: set.weight ?? null,
			distance: set.distance ?? null,
			status: (set.status as "pass" | "fail" | null) ?? null,
		}))
	}

	// Validate workout info is provided
	if (!params.workout) {
		throw new ZSAError("ERROR", "Workout info is required to save competition score")
	}

	// Write to new scores table
	try {
		const scheme = params.workout.scheme as WorkoutScheme
		const scoreType = params.workout.scoreType || getDefaultScoreType(scheme)

		// Encode score using new encoding
		let encodedValue: number | null = null
		
		if (params.roundScores && params.roundScores.length > 0) {
			// Multi-round: encode each round and aggregate
			const roundInputs = params.roundScores.map((rs) => ({ raw: rs.score }))
			const result = encodeRounds(roundInputs, scheme, scoreType)
			encodedValue = result.aggregated
		} else if (params.score && params.score.trim()) {
			// Single score: encode directly
			encodedValue = encodeScore(params.score, scheme)
		}

		// Map status to new simplified type
		const newStatus = mapToNewStatus(params.scoreStatus)

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
		const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
			where: eq(trackWorkoutsTable.id, params.trackWorkoutId),
			with: {
				track: {
					columns: {
						ownerTeamId: true,
					},
				},
			},
		})

		if (!trackWorkout?.track?.ownerTeamId) {
			throw new ZSAError("ERROR", "Could not determine team ownership for competition")
		}

		const teamId = trackWorkout.track.ownerTeamId

		// Encode tiebreak if provided
		let tiebreakValue: number | null = null
		if (params.tieBreakScore && params.workout.tiebreakScheme) {
			try {
				tiebreakValue = encodeScore(
					params.tieBreakScore,
					params.workout.tiebreakScheme,
				)
			} catch (error) {
				logWarning({
					message: "[competition-scores] Failed to encode tiebreak",
					attributes: {
						tieBreakScore: params.tieBreakScore,
						tiebreakScheme: params.workout.tiebreakScheme,
						error: error instanceof Error ? error.message : String(error),
					},
				})
			}
		}

		// Insert/update scores table
		await db
			.insert(scoresTable)
			.values({
				userId: params.userId,
				teamId,
				workoutId: params.workoutId,
				competitionEventId: params.trackWorkoutId,
				scheme,
				scoreType,
				scoreValue: encodedValue,
				status: newStatus,
				statusOrder: getStatusOrder(params.scoreStatus),
				sortKey: sortKey ? sortKeyToString(sortKey) : null,
				tiebreakScheme: params.workout.tiebreakScheme ?? null,
				tiebreakValue,
				scalingLevelId: params.divisionId,
				asRx: true,
				recordedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [scoresTable.competitionEventId, scoresTable.userId],
				set: {
					scoreValue: encodedValue,
					status: newStatus,
					statusOrder: getStatusOrder(params.scoreStatus),
					sortKey: sortKey ? sortKeyToString(sortKey) : null,
					tiebreakValue,
					scalingLevelId: params.divisionId,
					updatedAt: new Date(),
				},
			})

		// Get the final score ID (either new or existing)
		const [finalScore] = await db
			.select({ id: scoresTable.id })
			.from(scoresTable)
			.where(
				and(
					eq(scoresTable.competitionEventId, params.trackWorkoutId),
					eq(scoresTable.userId, params.userId),
				),
			)
			.limit(1)

		if (!finalScore) {
			throw new ZSAError("ERROR", "Failed to retrieve score after upsert")
		}

		const scoreId = finalScore.id
		
		logInfo({
			message: "[competition-scores] Saved score to new scores table",
			attributes: {
				scoreId,
				userId: params.userId,
				competitionEventId: params.trackWorkoutId,
			},
		})

		// Handle score_rounds - delete existing and insert new
		if (setsToInsert.length > 0) {
			// Delete existing rounds
			await db
				.delete(scoreRoundsTable)
				.where(eq(scoreRoundsTable.scoreId, scoreId))

			// Convert and insert new rounds
			const roundsToInsert = setsToInsert.map((set, index) => {
				// Convert each round's value using the adapter
				let roundValue: number

				if (scheme === "rounds-reps") {
					const rounds = set.score ?? 0
					const reps = set.reps ?? 0
					const legacyValue = rounds * 1000 + reps
					roundValue = convertLegacyToNew(legacyValue, scheme)
				} else if (
					scheme === "time" ||
					scheme === "time-with-cap" ||
					scheme === "emom"
				) {
					const timeInSeconds = set.time ?? 0
					roundValue = convertLegacyToNew(timeInSeconds, scheme)
				} else {
					const value = set.score ?? 0
					roundValue = convertLegacyToNew(value, scheme)
				}

				return {
					id: `scrd_${createId()}`,
					scoreId,
					roundNumber: index + 1,
					value: roundValue,
					status: null, // Individual round status not tracked in competitions yet
				}
			})

			await db.insert(scoreRoundsTable).values(roundsToInsert)

			logInfo({
				message: "[competition-scores] Saved score rounds",
				attributes: {
					scoreId,
					roundCount: roundsToInsert.length,
				},
			})
		}

		const isNew = true // Always true since we're using upsert pattern
		return { resultId: scoreId, isNew }
	} catch (error) {
		logError({
			message: "[competition-scores] Failed to save competition score",
			attributes: {
				userId: params.userId,
				competitionEventId: params.trackWorkoutId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
		})
		throw new ZSAError("ERROR", "Failed to save competition score")
	}
}

/**
 * Batch save multiple competition scores
 */
export async function saveCompetitionScores(params: {
	competitionId: string
	trackWorkoutId: string
	competitionTeamId: string
	workoutId: string
	scores: Array<{
		registrationId: string
		userId: string
		divisionId: string | null
		score: string
		scoreStatus: ScoreStatus
		tieBreakScore?: string | null
	}>
	enteredBy: string
}): Promise<{
	savedCount: number
	errors: Array<{ userId: string; error: string }>
}> {
	// Defense-in-depth: Verify session exists
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
	}

	// Defense-in-depth: Verify team ownership
	await verifyTrackWorkoutOwnership(
		params.trackWorkoutId,
		params.competitionTeamId,
	)

	const errors: Array<{ userId: string; error: string }> = []
	let savedCount = 0

	for (const scoreData of params.scores) {
		try {
			await saveCompetitionScore({
				competitionId: params.competitionId,
				trackWorkoutId: params.trackWorkoutId,
				workoutId: params.workoutId,
				registrationId: scoreData.registrationId,
				userId: scoreData.userId,
				divisionId: scoreData.divisionId,
				score: scoreData.score,
				scoreStatus: scoreData.scoreStatus,
				tieBreakScore: scoreData.tieBreakScore,
				enteredBy: params.enteredBy,
			})
			savedCount++
		} catch (error) {
			errors.push({
				userId: scoreData.userId,
				error: error instanceof Error ? error.message : "Unknown error",
			})
		}
	}

	return { savedCount, errors }
}

/**
 * Delete a competition score (mark as no result)
 */
export async function deleteCompetitionScore(params: {
	trackWorkoutId: string
	userId: string
	competitionTeamId: string
}): Promise<void> {
	// Defense-in-depth: Verify session exists
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new ZSAError("NOT_AUTHORIZED", "Must be logged in")
	}

	// Defense-in-depth: Verify team ownership
	await verifyTrackWorkoutOwnership(
		params.trackWorkoutId,
		params.competitionTeamId,
	)

	const db = getDb()

	// Delete from new scores table
	await db
		.delete(scoresTable)
		.where(
			and(
				eq(scoresTable.competitionEventId, params.trackWorkoutId),
				eq(scoresTable.userId, params.userId),
			),
		)
	
	logInfo({
		message: "[competition-scores] Deleted competition score",
		attributes: {
			competitionEventId: params.trackWorkoutId,
			userId: params.userId,
		},
	})
}
