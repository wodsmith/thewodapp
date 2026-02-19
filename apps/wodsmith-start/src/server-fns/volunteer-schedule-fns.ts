/**
 * Volunteer Schedule Server Functions for TanStack Start
 * Functions for fetching volunteer's own schedule data
 *
 * Ported from:
 * - apps/wodsmith/src/app/(compete)/compete/(public)/[slug]/my-schedule/page.tsx
 * - apps/wodsmith/src/server/judge-schedule.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionDivisionsTable,
	competitionHeatAssignmentsTable,
	competitionHeatsTable,
	competitionJudgeRotationsTable,
	competitionRegistrationsTable,
	scalingLevelsTable,
	teamMembershipTable,
	trackWorkoutsTable,
	volunteerShiftAssignmentsTable,
	volunteerShiftsTable,
	workoutScalingDescriptionsTable,
	workouts,
} from "@/db/schema"
import { eventJudgingSheetsTable } from "@/db/schemas/judging-sheets"
import type {
	LaneShiftPattern,
	VolunteerMembershipMetadata,
	VolunteerRoleType,
} from "@/db/schemas/volunteers"
import type {
	ScoreType,
	TiebreakScheme,
	WorkoutScheme,
} from "@/db/schemas/workouts"
import { autochunk } from "@/utils/batch-query"

// ============================================================================
// Types
// ============================================================================

export interface WorkoutDetails {
	description: string | null
	scheme: WorkoutScheme
	scoreType: ScoreType | null
	timeCap: number | null
	repsPerRound: number | null
	roundsToScore: number | null
	tiebreakScheme: TiebreakScheme | null
}

export interface HeatAssignment {
	heatNumber: number
	divisionId: string | null
	divisionName: string | null
	scheduledTime: Date | null
	durationMinutes: number | null
}

export interface DivisionDescription {
	divisionId: string
	divisionLabel: string
	description: string | null
	position: number
}

export interface JudgingSheet {
	id: string
	title: string
	url: string
	originalFilename: string
	fileSize: number
}

export interface EnrichedRotation {
	rotation: {
		id: string
		competitionId: string
		trackWorkoutId: string
		membershipId: string
		startingHeat: number
		startingLane: number
		heatsCount: number
		laneShiftPattern: LaneShiftPattern
		notes: string | null
		createdAt: Date
		updatedAt: Date
		updateCounter: number | null
	}
	eventName: string
	eventNotes: string | null
	timeWindow: string | null
	estimatedDuration: number | null
	isUpcoming: boolean
	divisionDescriptions: DivisionDescription[]
	judgingSheets: JudgingSheet[]
	workout: WorkoutDetails
	heats: HeatAssignment[]
	lane: number
	heatsCount: number
	startingHeat: number
}

export interface EventWithRotations {
	trackWorkoutId: string
	eventName: string
	eventNotes: string | null
	workout: WorkoutDetails
	divisionDescriptions: DivisionDescription[]
	judgingSheets: JudgingSheet[]
	rotations: EnrichedRotation[]
}

export interface VolunteerShiftData {
	id: string
	name: string
	roleType: VolunteerRoleType
	startTime: Date
	endTime: Date
	location: string | null
	notes: string | null
}

export interface VolunteerScheduleData {
	events: EventWithRotations[]
	shifts: VolunteerShiftData[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const getVolunteerMembershipInputSchema = z.object({
	competitionTeamId: z.string().min(1, "Competition team ID is required"),
	userId: z.string().min(1, "User ID is required"),
})

const getVolunteerScheduleDataInputSchema = z.object({
	membershipId: z.string().startsWith("tmem_", "Invalid membership ID"),
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse volunteer metadata from membership record
 */
function parseVolunteerMetadata(
	metadata: Record<string, unknown> | null | undefined,
): VolunteerMembershipMetadata | null {
	if (!metadata) return null
	return metadata as unknown as VolunteerMembershipMetadata
}

/**
 * Group enriched rotations by event (trackWorkoutId).
 */
function groupRotationsByEvent(
	rotations: EnrichedRotation[],
): EventWithRotations[] {
	const eventMap = new Map<string, EventWithRotations>()

	for (const rotation of rotations) {
		const key = rotation.rotation.trackWorkoutId
		const existing = eventMap.get(key)

		if (existing) {
			existing.rotations.push(rotation)
		} else {
			eventMap.set(key, {
				trackWorkoutId: key,
				eventName: rotation.eventName,
				eventNotes: rotation.eventNotes,
				workout: rotation.workout,
				divisionDescriptions: rotation.divisionDescriptions,
				judgingSheets: rotation.judgingSheets,
				rotations: [rotation],
			})
		}
	}

	// Sort rotations within each event by starting heat
	for (const event of eventMap.values()) {
		event.rotations.sort((a, b) => a.startingHeat - b.startingHeat)
	}

	// Return events sorted by first rotation's upcoming status and heat number
	return Array.from(eventMap.values()).sort((a, b) => {
		const aFirst = a.rotations[0]
		const bFirst = b.rotations[0]

		if (!aFirst || !bFirst) return 0

		// Prioritize events with upcoming rotations
		if (aFirst.isUpcoming !== bFirst.isUpcoming) {
			return aFirst.isUpcoming ? -1 : 1
		}

		// Then sort by first heat number
		return aFirst.startingHeat - bFirst.startingHeat
	})
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get volunteer's membership in a competition team
 */
export const getVolunteerMembershipFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getVolunteerMembershipInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const membership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, data.competitionTeamId),
				eq(teamMembershipTable.userId, data.userId),
			),
		})

		if (!membership) {
			return { membership: null, volunteerMetadata: null }
		}

		// Parse volunteer metadata
		const volunteerMetadata = parseVolunteerMetadata(membership.metadata)

		return {
			membership: {
				id: membership.id,
				teamId: membership.teamId,
				userId: membership.userId,
			},
			volunteerMetadata,
		}
	})

/**
 * Get enriched schedule data for a volunteer
 * Returns events with rotations grouped and enriched with workout/heat info,
 * plus time-based shift assignments
 */
export const getVolunteerScheduleDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getVolunteerScheduleDataInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<VolunteerScheduleData> => {
		const db = getDb()

		// Get competition divisions for scaling level descriptions
		const divisions = await db
			.select({ id: competitionDivisionsTable.divisionId })
			.from(competitionDivisionsTable)
			.where(eq(competitionDivisionsTable.competitionId, data.competitionId))

		const divisionIds = divisions.map((d) => d.id)

		// Get base rotations for this judge
		const rotations = await db
			.select()
			.from(competitionJudgeRotationsTable)
			.where(
				and(
					eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
					eq(competitionJudgeRotationsTable.competitionId, data.competitionId),
				),
			)

		// Query volunteer's shift assignments with shift details
		const shiftAssignments = await db
			.select({
				shift: {
					id: volunteerShiftsTable.id,
					name: volunteerShiftsTable.name,
					roleType: volunteerShiftsTable.roleType,
					startTime: volunteerShiftsTable.startTime,
					endTime: volunteerShiftsTable.endTime,
					location: volunteerShiftsTable.location,
					notes: volunteerShiftsTable.notes,
				},
			})
			.from(volunteerShiftAssignmentsTable)
			.innerJoin(
				volunteerShiftsTable,
				eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
			)
			.where(
				and(
					eq(volunteerShiftAssignmentsTable.membershipId, data.membershipId),
					eq(volunteerShiftsTable.competitionId, data.competitionId),
				),
			)

		// Build shifts array, ordered by startTime
		const shifts: VolunteerShiftData[] = shiftAssignments
			.map((sa) => ({
				id: sa.shift.id,
				name: sa.shift.name,
				roleType: sa.shift.roleType,
				startTime: sa.shift.startTime,
				endTime: sa.shift.endTime,
				location: sa.shift.location,
				notes: sa.shift.notes,
			}))
			.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

		// If no rotations, return just the shifts with empty events
		if (rotations.length === 0) {
			return { events: [], shifts }
		}

		// Extract unique track workout IDs
		const trackWorkoutIds = [...new Set(rotations.map((r) => r.trackWorkoutId))]

		// Batch-fetch trackWorkouts
		const trackWorkouts = await autochunk(
			{ items: trackWorkoutIds },
			async (chunk) => {
				return db
					.select({
						id: trackWorkoutsTable.id,
						workoutId: trackWorkoutsTable.workoutId,
						notes: trackWorkoutsTable.notes,
						eventStatus: trackWorkoutsTable.eventStatus,
					})
					.from(trackWorkoutsTable)
					.where(inArray(trackWorkoutsTable.id, chunk))
			},
		)

		const trackWorkoutMap = new Map(trackWorkouts.map((tw) => [tw.id, tw]))

		// Extract unique workout IDs and batch-fetch workouts
		const workoutIds = [
			...new Set(trackWorkouts.map((tw) => tw.workoutId).filter(Boolean)),
		]

		const workoutsList = await autochunk(
			{ items: workoutIds },
			async (chunk) => {
				return db
					.select({
						id: workouts.id,
						name: workouts.name,
						description: workouts.description,
						scheme: workouts.scheme,
						scoreType: workouts.scoreType,
						timeCap: workouts.timeCap,
						repsPerRound: workouts.repsPerRound,
						roundsToScore: workouts.roundsToScore,
						tiebreakScheme: workouts.tiebreakScheme,
						teamId: workouts.teamId,
					})
					.from(workouts)
					.where(inArray(workouts.id, chunk))
			},
		)

		const workoutMap = new Map(workoutsList.map((w) => [w.id, w]))

		// Batch-fetch judging sheets for all trackWorkouts
		const judgingSheetsData = await autochunk(
			{ items: trackWorkoutIds },
			async (chunk) => {
				return db
					.select({
						id: eventJudgingSheetsTable.id,
						trackWorkoutId: eventJudgingSheetsTable.trackWorkoutId,
						title: eventJudgingSheetsTable.title,
						url: eventJudgingSheetsTable.url,
						originalFilename: eventJudgingSheetsTable.originalFilename,
						fileSize: eventJudgingSheetsTable.fileSize,
					})
					.from(eventJudgingSheetsTable)
					.where(inArray(eventJudgingSheetsTable.trackWorkoutId, chunk))
			},
		)

		// Group judging sheets by trackWorkoutId
		const judgingSheetsByTrackWorkout = new Map<string, JudgingSheet[]>()
		for (const sheet of judgingSheetsData) {
			const existing =
				judgingSheetsByTrackWorkout.get(sheet.trackWorkoutId) || []
			existing.push({
				id: sheet.id,
				title: sheet.title,
				url: sheet.url,
				originalFilename: sheet.originalFilename,
				fileSize: sheet.fileSize,
			})
			judgingSheetsByTrackWorkout.set(sheet.trackWorkoutId, existing)
		}

		// Batch-fetch heats for all trackWorkouts
		const heatsData = await autochunk(
			{ items: trackWorkoutIds },
			async (chunk) => {
				return db
					.select({
						id: competitionHeatsTable.id,
						trackWorkoutId: competitionHeatsTable.trackWorkoutId,
						heatNumber: competitionHeatsTable.heatNumber,
						scheduledTime: competitionHeatsTable.scheduledTime,
						durationMinutes: competitionHeatsTable.durationMinutes,
						divisionId: competitionHeatsTable.divisionId,
					})
					.from(competitionHeatsTable)
					.where(inArray(competitionHeatsTable.trackWorkoutId, chunk))
			},
		)

		// Fetch heat assignments to derive division from registrations
		const heatIds = heatsData.map((h) => h.id)
		const assignmentsData =
			heatIds.length > 0
				? await autochunk({ items: heatIds }, async (chunk) => {
						return db
							.select({
								heatId: competitionHeatAssignmentsTable.heatId,
								registrationId: competitionHeatAssignmentsTable.registrationId,
							})
							.from(competitionHeatAssignmentsTable)
							.where(inArray(competitionHeatAssignmentsTable.heatId, chunk))
					})
				: []

		// Fetch registrations to get division IDs
		const registrationIds = [
			...new Set(assignmentsData.map((a) => a.registrationId)),
		]
		const registrationsData =
			registrationIds.length > 0
				? await autochunk({ items: registrationIds }, async (chunk) => {
						return db
							.select({
								id: competitionRegistrationsTable.id,
								divisionId: competitionRegistrationsTable.divisionId,
							})
							.from(competitionRegistrationsTable)
							.where(inArray(competitionRegistrationsTable.id, chunk))
					})
				: []

		const registrationDivisionMap = new Map(
			registrationsData.map((r) => [r.id, r.divisionId]),
		)

		// Build a map of heatId -> most common divisionId from assignments
		const heatDerivedDivisionMap = new Map<string, string | null>()
		const assignmentsByHeat = new Map<string, string[]>()

		for (const assignment of assignmentsData) {
			const existing = assignmentsByHeat.get(assignment.heatId) || []
			const divisionId = registrationDivisionMap.get(assignment.registrationId)
			if (divisionId) {
				existing.push(divisionId)
			}
			assignmentsByHeat.set(assignment.heatId, existing)
		}

		for (const [heatId, divisionIds] of assignmentsByHeat) {
			if (divisionIds.length === 0) {
				heatDerivedDivisionMap.set(heatId, null)
				continue
			}
			// Find most common division (or first if all same)
			const counts = new Map<string, number>()
			for (const id of divisionIds) {
				counts.set(id, (counts.get(id) || 0) + 1)
			}
			let maxCount = 0
			let mostCommon: string | null = null
			for (const [id, count] of counts) {
				if (count > maxCount) {
					maxCount = count
					mostCommon = id
				}
			}
			heatDerivedDivisionMap.set(heatId, mostCommon)
		}

		// Collect unique division IDs from heats AND derived from registrations
		const allDivisionIds = new Set<string>()
		for (const heat of heatsData) {
			if (heat.divisionId) allDivisionIds.add(heat.divisionId)
		}
		for (const divisionId of heatDerivedDivisionMap.values()) {
			if (divisionId) allDivisionIds.add(divisionId)
		}

		// Batch-fetch division names (scaling levels)
		const divisionNames =
			allDivisionIds.size > 0
				? await autochunk({ items: [...allDivisionIds] }, async (chunk) => {
						return db
							.select({
								id: scalingLevelsTable.id,
								label: scalingLevelsTable.label,
							})
							.from(scalingLevelsTable)
							.where(inArray(scalingLevelsTable.id, chunk))
					})
				: []

		const divisionNameMap = new Map(divisionNames.map((d) => [d.id, d.label]))

		// Group heats by trackWorkoutId
		const heatsByTrackWorkout = new Map<
			string,
			Array<{
				heatNumber: number
				scheduledTime: Date | null
				durationMinutes: number | null
				divisionId: string | null
				divisionName: string | null
			}>
		>()

		for (const heat of heatsData) {
			const existing = heatsByTrackWorkout.get(heat.trackWorkoutId) || []
			// Use heat's divisionId if set, otherwise derive from assignments
			const effectiveDivisionId =
				heat.divisionId || heatDerivedDivisionMap.get(heat.id) || null
			existing.push({
				heatNumber: heat.heatNumber,
				scheduledTime: heat.scheduledTime,
				durationMinutes: heat.durationMinutes,
				divisionId: effectiveDivisionId,
				divisionName: effectiveDivisionId
					? divisionNameMap.get(effectiveDivisionId) || null
					: null,
			})
			heatsByTrackWorkout.set(heat.trackWorkoutId, existing)
		}

		// Fetch division descriptions for all workouts
		const divisionDescriptionsByWorkout = new Map<
			string,
			DivisionDescription[]
		>()

		for (const workout of workoutsList) {
			if (!workout.teamId || divisionIds.length === 0) {
				divisionDescriptionsByWorkout.set(workout.id, [])
				continue
			}

			try {
				// Get scaling levels
				const scalingLevels = await autochunk(
					{ items: divisionIds },
					async (chunk) => {
						return db
							.select({
								divisionId: scalingLevelsTable.id,
								divisionLabel: scalingLevelsTable.label,
								position: scalingLevelsTable.position,
							})
							.from(scalingLevelsTable)
							.where(inArray(scalingLevelsTable.id, chunk))
					},
				)

				// Get descriptions
				const descriptions = await autochunk(
					{ items: divisionIds, otherParametersCount: 1 },
					async (chunk) => {
						return db
							.select({
								scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
								description: workoutScalingDescriptionsTable.description,
							})
							.from(workoutScalingDescriptionsTable)
							.where(
								and(
									eq(workoutScalingDescriptionsTable.workoutId, workout.id),
									inArray(
										workoutScalingDescriptionsTable.scalingLevelId,
										chunk,
									),
								),
							)
					},
				)

				const descriptionMap = new Map(
					descriptions.map((d) => [d.scalingLevelId, d.description]),
				)

				const divisionDescs = scalingLevels.map((sl) => ({
					divisionId: sl.divisionId,
					divisionLabel: sl.divisionLabel,
					description: descriptionMap.get(sl.divisionId) ?? null,
					position: sl.position,
				}))

				divisionDescriptionsByWorkout.set(workout.id, divisionDescs)
			} catch {
				divisionDescriptionsByWorkout.set(workout.id, [])
			}
		}

		// Build enriched results
		const now = new Date()
		const enriched: EnrichedRotation[] = []

		for (const rotation of rotations) {
			const trackWorkout = trackWorkoutMap.get(rotation.trackWorkoutId)
			const workout = trackWorkout
				? workoutMap.get(trackWorkout.workoutId)
				: undefined
			const heats = heatsByTrackWorkout.get(rotation.trackWorkoutId) || []
			const divisionDescriptions = workout
				? divisionDescriptionsByWorkout.get(workout.id) || []
				: []
			const judgingSheets =
				judgingSheetsByTrackWorkout.get(rotation.trackWorkoutId) || []

			// Skip if track workout not found
			if (!trackWorkout) {
				continue
			}

			// Calculate time window and duration for this judge's rotation
			const judgeHeats = heats.filter(
				(h) =>
					h.heatNumber >= rotation.startingHeat &&
					h.heatNumber < rotation.startingHeat + rotation.heatsCount,
			)

			let timeWindow: string | null = null
			let estimatedDuration: number | null = null
			let isUpcoming = false

			if (judgeHeats.length > 0) {
				const scheduledHeats = judgeHeats.filter(
					(h) => h.scheduledTime && h.durationMinutes,
				)

				if (scheduledHeats.length > 0) {
					scheduledHeats.sort(
						(a, b) =>
							(a.scheduledTime?.getTime() ?? 0) -
							(b.scheduledTime?.getTime() ?? 0),
					)

					const firstHeat = scheduledHeats[0]
					const lastHeat = scheduledHeats[scheduledHeats.length - 1]

					if (firstHeat?.scheduledTime && lastHeat?.scheduledTime) {
						const startTime = firstHeat.scheduledTime
						const endTime = new Date(
							lastHeat.scheduledTime.getTime() +
								(lastHeat.durationMinutes || 0) * 60 * 1000,
						)

						const formatter = new Intl.DateTimeFormat("en-US", {
							hour: "numeric",
							minute: "2-digit",
							hour12: true,
						})

						timeWindow = `${formatter.format(startTime)} - ${formatter.format(endTime)}`
						estimatedDuration = Math.round(
							(endTime.getTime() - startTime.getTime()) / (60 * 1000),
						)
						isUpcoming = startTime > now
					}
				}
			}

			// Build heat assignments with division info
			const heatAssignments: HeatAssignment[] = judgeHeats
				.sort((a, b) => a.heatNumber - b.heatNumber)
				.map((h) => ({
					heatNumber: h.heatNumber,
					divisionId: h.divisionId,
					divisionName: h.divisionName,
					scheduledTime: h.scheduledTime,
					durationMinutes: h.durationMinutes,
				}))

			enriched.push({
				rotation: {
					id: rotation.id,
					competitionId: rotation.competitionId,
					trackWorkoutId: rotation.trackWorkoutId,
					membershipId: rotation.membershipId,
					startingHeat: rotation.startingHeat,
					startingLane: rotation.startingLane,
					heatsCount: rotation.heatsCount,
					laneShiftPattern: rotation.laneShiftPattern,
					notes: rotation.notes,
					createdAt: rotation.createdAt,
					updatedAt: rotation.updatedAt,
					updateCounter: rotation.updateCounter,
				},
				eventName: workout?.name || "Unknown Event",
				eventNotes: trackWorkout?.notes || null,
				workout: {
					description: workout?.description || null,
					scheme: workout?.scheme || "time",
					scoreType: workout?.scoreType || null,
					timeCap: workout?.timeCap || null,
					repsPerRound: workout?.repsPerRound || null,
					roundsToScore: workout?.roundsToScore || null,
					tiebreakScheme: workout?.tiebreakScheme || null,
				},
				heats: heatAssignments,
				timeWindow,
				estimatedDuration,
				isUpcoming,
				divisionDescriptions,
				judgingSheets,
				lane: rotation.startingLane,
				heatsCount: rotation.heatsCount,
				startingHeat: rotation.startingHeat,
			})
		}

		// Sort by time (upcoming first, then by start time)
		enriched.sort((a, b) => {
			if (a.isUpcoming !== b.isUpcoming) {
				return a.isUpcoming ? -1 : 1
			}
			return a.startingHeat - b.startingHeat
		})

		// Group rotations by event
		const events = groupRotationsByEvent(enriched)

		return { events, shifts }
	})
