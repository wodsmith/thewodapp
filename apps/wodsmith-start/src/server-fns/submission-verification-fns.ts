/**
 * Submission Verification Server Functions
 *
 * Server functions for organizers to view and verify athlete video submissions
 * for online competition events.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { workouts } from "@/db/schemas/workouts"
import { decodeScore, type WorkoutScheme } from "@/lib/scoring"
import { autochunk } from "@/utils/batch-query"

// ============================================================================
// Types
// ============================================================================

export interface SubmissionDetail {
	id: string
	athlete: {
		userId: string
		firstName: string
		lastName: string
		email: string
		avatar: string | null
		divisionId: string | null
		divisionLabel: string
		teamName: string | null
		registrationId: string
	}
	score: {
		displayValue: string
		rawValue: number | null
		status: string
		tiebreakValue: string | null
		secondaryValue: number | null
	}
	videoUrl: string | null
	submittedAt: Date
	notes: string | null
}

export interface EventDetails {
	id: string
	trackOrder: number
	workout: {
		id: string
		name: string
		description: string
		scheme: string
		timeCap: number | null
	}
	submissionWindow: {
		opensAt: string | null
		closesAt: string | null
	}
}

export interface SubmissionListItem {
	id: string
	athleteName: string
	teamName: string | null
	divisionLabel: string
	hasVideo: boolean
	scoreDisplay: string
	status: string
}

// ============================================================================
// Input Schemas
// ============================================================================

const getSubmissionDetailInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	scoreId: z.string().min(1),
})

const getEventSubmissionsInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
})

const getEventDetailsForVerificationInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get a single submission detail for verification
 */
export const getSubmissionDetailFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getSubmissionDetailInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{ submission: SubmissionDetail | null; event: EventDetails }> => {
			const db = getDb()

			// Get the score with user info
			const [score] = await db
				.select({
					id: scoresTable.id,
					userId: scoresTable.userId,
					scoreValue: scoresTable.scoreValue,
					status: scoresTable.status,
					scheme: scoresTable.scheme,
					tiebreakValue: scoresTable.tiebreakValue,
					tiebreakScheme: scoresTable.tiebreakScheme,
					secondaryValue: scoresTable.secondaryValue,
					notes: scoresTable.notes,
					recordedAt: scoresTable.recordedAt,
					scalingLevelId: scoresTable.scalingLevelId,
				})
				.from(scoresTable)
				.where(
					and(
						eq(scoresTable.id, data.scoreId),
						eq(scoresTable.competitionEventId, data.trackWorkoutId),
					),
				)
				.limit(1)

			// Get the event details
			const [trackWorkout] = await db
				.select({
					id: trackWorkoutsTable.id,
					trackOrder: trackWorkoutsTable.trackOrder,
					workoutId: workouts.id,
					workoutName: workouts.name,
					workoutDescription: workouts.description,
					workoutScheme: workouts.scheme,
					workoutTimeCap: workouts.timeCap,
				})
				.from(trackWorkoutsTable)
				.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
				.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
				.limit(1)

			if (!trackWorkout) {
				throw new Error("Event not found")
			}

			// Get submission window
			const [competitionEvent] = await db
				.select({
					submissionOpensAt: competitionEventsTable.submissionOpensAt,
					submissionClosesAt: competitionEventsTable.submissionClosesAt,
				})
				.from(competitionEventsTable)
				.where(
					and(
						eq(competitionEventsTable.competitionId, data.competitionId),
						eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
					),
				)
				.limit(1)

			const event: EventDetails = {
				id: trackWorkout.id,
				trackOrder: trackWorkout.trackOrder,
				workout: {
					id: trackWorkout.workoutId,
					name: trackWorkout.workoutName,
					description: trackWorkout.workoutDescription,
					scheme: trackWorkout.workoutScheme,
					timeCap: trackWorkout.workoutTimeCap,
				},
				submissionWindow: {
					opensAt: competitionEvent?.submissionOpensAt ?? null,
					closesAt: competitionEvent?.submissionClosesAt ?? null,
				},
			}

			if (!score) {
				return { submission: null, event }
			}

			// Get user info
			const [user] = await db
				.select({
					id: userTable.id,
					firstName: userTable.firstName,
					lastName: userTable.lastName,
					email: userTable.email,
					avatar: userTable.avatar,
				})
				.from(userTable)
				.where(eq(userTable.id, score.userId))
				.limit(1)

			if (!user) {
				return { submission: null, event }
			}

			// Get division info
			let divisionLabel = "Open"
			if (score.scalingLevelId) {
				const [division] = await db
					.select({ label: scalingLevelsTable.label })
					.from(scalingLevelsTable)
					.where(eq(scalingLevelsTable.id, score.scalingLevelId))
					.limit(1)
				if (division) {
					divisionLabel = division.label
				}
			}

			// Get registration info (for team name)
			const [registration] = await db
				.select({
					id: competitionRegistrationsTable.id,
					teamName: competitionRegistrationsTable.teamName,
				})
				.from(competitionRegistrationsTable)
				.where(
					and(
						eq(competitionRegistrationsTable.eventId, data.competitionId),
						eq(competitionRegistrationsTable.userId, score.userId),
					),
				)
				.limit(1)

			// Get video submission from video_submissions table
			let videoUrl: string | null = null
			if (registration) {
				const [videoSubmission] = await db
					.select({ videoUrl: videoSubmissionsTable.videoUrl })
					.from(videoSubmissionsTable)
					.where(
						and(
							eq(videoSubmissionsTable.registrationId, registration.id),
							eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
						),
					)
					.limit(1)
				if (videoSubmission) {
					videoUrl = videoSubmission.videoUrl
				}
			}

			// Decode score for display
			let displayValue = ""
			if (score.scoreValue !== null) {
				displayValue = decodeScore(
					score.scoreValue,
					score.scheme as WorkoutScheme,
					{ compact: false },
				)
			}

			// Decode tiebreak if present
			let tiebreakDisplay: string | null = null
			if (score.tiebreakValue !== null && score.tiebreakScheme) {
				tiebreakDisplay = decodeScore(
					score.tiebreakValue,
					score.tiebreakScheme as WorkoutScheme,
					{ compact: false },
				)
			}

			const submission: SubmissionDetail = {
				id: score.id,
				athlete: {
					userId: user.id,
					firstName: user.firstName || "",
					lastName: user.lastName || "",
					email: user.email || "",
					avatar: user.avatar,
					divisionId: score.scalingLevelId,
					divisionLabel,
					teamName: registration?.teamName ?? null,
					registrationId: registration?.id ?? "",
				},
				score: {
					displayValue,
					rawValue: score.scoreValue,
					status: score.status,
					tiebreakValue: tiebreakDisplay,
					secondaryValue: score.secondaryValue,
				},
				videoUrl,
				submittedAt: score.recordedAt,
				notes: score.notes,
			}

			return { submission, event }
		},
	)

/**
 * Get all submissions for an event (for navigation and list view)
 */
export const getEventSubmissionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventSubmissionsInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{ submissions: SubmissionListItem[] }> => {
			const db = getDb()

			// Get all scores for this event
			const scores = await db
				.select({
					id: scoresTable.id,
					userId: scoresTable.userId,
					scoreValue: scoresTable.scoreValue,
					status: scoresTable.status,
					scheme: scoresTable.scheme,
					scalingLevelId: scoresTable.scalingLevelId,
				})
				.from(scoresTable)
				.where(eq(scoresTable.competitionEventId, data.trackWorkoutId))

			if (scores.length === 0) {
				return { submissions: [] }
			}

			// Get user info for all scores
			const userIds = scores.map((s) => s.userId)
			const users = await autochunk({ items: userIds }, async (chunk) =>
				db
					.select({
						id: userTable.id,
						firstName: userTable.firstName,
						lastName: userTable.lastName,
					})
					.from(userTable)
					.where(inArray(userTable.id, chunk)),
			)
			const userMap = new Map(users.map((u) => [u.id, u]))

			// Get division info for all scores
			const divisionIds = scores
				.map((s) => s.scalingLevelId)
				.filter((id): id is string => id !== null)
			const divisions =
				divisionIds.length > 0
					? await autochunk({ items: [...new Set(divisionIds)] }, async (chunk) =>
							db
								.select({
									id: scalingLevelsTable.id,
									label: scalingLevelsTable.label,
								})
								.from(scalingLevelsTable)
								.where(inArray(scalingLevelsTable.id, chunk)),
						)
					: []
			const divisionMap = new Map(divisions.map((d) => [d.id, d]))

			// Get registration info (for team names)
			const registrations = await autochunk({ items: userIds }, async (chunk) =>
				db
					.select({
						userId: competitionRegistrationsTable.userId,
						teamName: competitionRegistrationsTable.teamName,
					})
					.from(competitionRegistrationsTable)
					.where(
						and(
							eq(competitionRegistrationsTable.eventId, data.competitionId),
							inArray(competitionRegistrationsTable.userId, chunk),
						),
					),
			)
			const registrationMap = new Map(registrations.map((r) => [r.userId, r]))

			// Get video submissions for this event
			const videoSubmissions = await db
				.select({ userId: videoSubmissionsTable.userId })
				.from(videoSubmissionsTable)
				.where(eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId))
			const usersWithVideo = new Set(videoSubmissions.map((vs) => vs.userId))

			// Build submission list
			const submissions: SubmissionListItem[] = scores.map((score) => {
				const user = userMap.get(score.userId)
				const division = score.scalingLevelId
					? divisionMap.get(score.scalingLevelId)
					: null
				const registration = registrationMap.get(score.userId)

				// Decode score for display
				let scoreDisplay = ""
				if (score.scoreValue !== null) {
					scoreDisplay = decodeScore(
						score.scoreValue,
						score.scheme as WorkoutScheme,
						{ compact: true },
					)
				}

				return {
					id: score.id,
					athleteName: user
						? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
						  "Unknown"
						: "Unknown",
					teamName: registration?.teamName ?? null,
					divisionLabel: division?.label ?? "Open",
					hasVideo: usersWithVideo.has(score.userId),
					scoreDisplay,
					status: score.status,
				}
			})

			// Sort by athlete name
			submissions.sort((a, b) => a.athleteName.localeCompare(b.athleteName))

			return { submissions }
		},
	)

/**
 * Get event details for verification page header
 */
export const getEventDetailsForVerificationFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getEventDetailsForVerificationInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<{ event: EventDetails | null }> => {
		const db = getDb()

		// Get the track workout with workout details
		const [trackWorkout] = await db
			.select({
				id: trackWorkoutsTable.id,
				trackOrder: trackWorkoutsTable.trackOrder,
				workoutId: workouts.id,
				workoutName: workouts.name,
				workoutDescription: workouts.description,
				workoutScheme: workouts.scheme,
				workoutTimeCap: workouts.timeCap,
			})
			.from(trackWorkoutsTable)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
			.limit(1)

		if (!trackWorkout) {
			return { event: null }
		}

		// Get submission window
		const [competitionEvent] = await db
			.select({
				submissionOpensAt: competitionEventsTable.submissionOpensAt,
				submissionClosesAt: competitionEventsTable.submissionClosesAt,
			})
			.from(competitionEventsTable)
			.where(
				and(
					eq(competitionEventsTable.competitionId, data.competitionId),
					eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
				),
			)
			.limit(1)

		return {
			event: {
				id: trackWorkout.id,
				trackOrder: trackWorkout.trackOrder,
				workout: {
					id: trackWorkout.workoutId,
					name: trackWorkout.workoutName,
					description: trackWorkout.workoutDescription,
					scheme: trackWorkout.workoutScheme,
					timeCap: trackWorkout.workoutTimeCap,
				},
				submissionWindow: {
					opensAt: competitionEvent?.submissionOpensAt ?? null,
					closesAt: competitionEvent?.submissionClosesAt ?? null,
				},
			},
		}
	})
