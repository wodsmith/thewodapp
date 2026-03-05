/**
 * Video Submission Server Functions for TanStack Start
 * Handles athlete video submissions for online competition events.
 * Includes claimed score submission alongside video.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, inArray, isNotNull, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
	competitionsTable,
	REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable } from "@/db/schemas/scores"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import {
	createVideoSubmissionId,
	videoSubmissionsTable,
} from "@/db/schemas/video-submissions"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import { workouts } from "@/db/schemas/workouts"
import {
	computeSortKey,
	decodeScore,
	encodeScore,
	getDefaultScoreType,
	parseScore,
	type ScoreType,
	STATUS_ORDER,
	sortKeyToString,
	type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getVideoSubmissionInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getOrganizerSubmissionsInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionFilter: z.string().optional(),
	statusFilter: z.enum(["all", "pending", "reviewed"]).optional(),
})

const submitVideoInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	videoUrl: z.string().url("Please enter a valid URL").max(2000),
	notes: z.string().max(1000).optional(),
	// Score fields
	score: z.string().optional(),
	scoreStatus: z.enum(["scored", "cap"]).optional(),
	secondaryScore: z.string().optional(),
	tiebreakScore: z.string().optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map status to the simplified type for scores table.
 */
function getStatusOrder(status: "scored" | "cap"): number {
	switch (status) {
		case "scored":
			return STATUS_ORDER.scored
		case "cap":
			return STATUS_ORDER.cap
		default:
			return STATUS_ORDER.scored
	}
}

/**
 * Check if current time is within the event's submission window.
 * Only applies to online competitions.
 */
async function checkSubmissionWindow(
	competitionId: string,
	trackWorkoutId: string,
): Promise<{
	allowed: boolean
	reason?: string
	opensAt?: Date
	closesAt?: Date
}> {
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
		return {
			allowed: false,
			reason: "Video submissions are only for online competitions",
		}
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

	// Parse dates
	const now = new Date()
	const opensAt = new Date(event.submissionOpensAt)
	const closesAt = new Date(event.submissionClosesAt)

	if (now < opensAt) {
		return {
			allowed: false,
			reason: "Submission window has not opened yet",
			opensAt,
			closesAt,
		}
	}

	if (now > closesAt) {
		return {
			allowed: false,
			reason: "Submission window has closed",
			opensAt,
			closesAt,
		}
	}

	return { allowed: true, opensAt, closesAt }
}

/**
 * Get the athlete's registration for a competition.
 */
async function getAthleteRegistration(
	competitionId: string,
	userId: string,
): Promise<{ id: string; divisionId: string | null } | null> {
	const db = getDb()

	const [registration] = await db
		.select({
			id: competitionRegistrationsTable.id,
			divisionId: competitionRegistrationsTable.divisionId,
		})
		.from(competitionRegistrationsTable)
		.where(
			and(
				eq(competitionRegistrationsTable.eventId, competitionId),
				eq(competitionRegistrationsTable.userId, userId),
				ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
			),
		)
		.limit(1)

	return registration ?? null
}

/**
 * Get workout details needed for score submission.
 */
async function getWorkoutDetails(trackWorkoutId: string) {
	const db = getDb()

	const [result] = await db
		.select({
			workoutId: workouts.id,
			name: workouts.name,
			scheme: workouts.scheme,
			scoreType: workouts.scoreType,
			timeCap: workouts.timeCap,
			tiebreakScheme: workouts.tiebreakScheme,
			repsPerRound: workouts.repsPerRound,
			trackId: trackWorkoutsTable.trackId,
		})
		.from(trackWorkoutsTable)
		.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))
		.limit(1)

	return result ?? null
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the current user's video submission for an event.
 * Returns the submission if it exists, along with submission window status
 * and workout details for score input.
 */
export const getVideoSubmissionFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getVideoSubmissionInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			return {
				submission: null,
				canSubmit: false,
				reason: "Not authenticated",
				isRegistered: false,
				workout: null,
				existingScore: null,
			}
		}

		const db = getDb()

		// Check if user is registered for this competition
		const registration = await getAthleteRegistration(
			data.competitionId,
			session.userId,
		)

		if (!registration) {
			return {
				submission: null,
				canSubmit: false,
				reason: "You must be registered for this competition to submit a video",
				isRegistered: false,
				workout: null,
				existingScore: null,
			}
		}

		// Check submission window
		const windowCheck = await checkSubmissionWindow(
			data.competitionId,
			data.trackWorkoutId,
		)

		// Get existing submission
		const [submission] = await db
			.select({
				id: videoSubmissionsTable.id,
				videoUrl: videoSubmissionsTable.videoUrl,
				notes: videoSubmissionsTable.notes,
				submittedAt: videoSubmissionsTable.submittedAt,
				updatedAt: videoSubmissionsTable.updatedAt,
			})
			.from(videoSubmissionsTable)
			.where(
				and(
					eq(videoSubmissionsTable.registrationId, registration.id),
					eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
				),
			)
			.limit(1)

		// Get workout details for score input
		const workout = await getWorkoutDetails(data.trackWorkoutId)

		// Get existing score if any
		let existingScore: {
			scoreValue: number | null
			displayScore: string | null
			status: string | null
			secondaryValue: number | null
			tiebreakValue: number | null
		} | null = null

		const [score] = await db
			.select({
				scoreValue: scoresTable.scoreValue,
				status: scoresTable.status,
				secondaryValue: scoresTable.secondaryValue,
				tiebreakValue: scoresTable.tiebreakValue,
				scheme: scoresTable.scheme,
			})
			.from(scoresTable)
			.where(
				and(
					eq(scoresTable.competitionEventId, data.trackWorkoutId),
					eq(scoresTable.userId, session.userId),
				),
			)
			.limit(1)

		if (score) {
			let displayScore: string | null = null
			if (score.scoreValue !== null && score.scheme) {
				displayScore = decodeScore(
					score.scoreValue,
					score.scheme as WorkoutScheme,
					{ compact: false },
				)
			}

			existingScore = {
				scoreValue: score.scoreValue,
				displayScore,
				status: score.status,
				secondaryValue: score.secondaryValue,
				tiebreakValue: score.tiebreakValue,
			}
		}

		return {
			submission: submission ?? null,
			canSubmit: windowCheck.allowed,
			reason: windowCheck.reason,
			isRegistered: true,
			submissionWindow:
				windowCheck.opensAt && windowCheck.closesAt
					? {
							opensAt: windowCheck.opensAt.toISOString(),
							closesAt: windowCheck.closesAt.toISOString(),
						}
					: null,
			workout: workout
				? {
						workoutId: workout.workoutId,
						name: workout.name,
						scheme: workout.scheme as WorkoutScheme,
						scoreType: workout.scoreType as ScoreType | null,
						timeCap: workout.timeCap,
						tiebreakScheme: workout.tiebreakScheme,
						repsPerRound: workout.repsPerRound,
					}
				: null,
			existingScore,
		}
	})

/**
 * Batch-check submission status for multiple track workouts.
 * Returns a map of trackWorkoutId -> { hasSubmitted, canSubmit }
 * Only meaningful for online competitions with a registered athlete.
 */
export const getBatchSubmissionStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: z.string().min(1),
				trackWorkoutIds: z.array(z.string().min(1)).min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		type Status = { hasSubmitted: boolean; canSubmit: boolean }
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			return { statuses: {} as Record<string, Status> }
		}

		const db = getDb()

		const registration = await getAthleteRegistration(
			data.competitionId,
			session.userId,
		)
		if (!registration) {
			return { statuses: {} as Record<string, Status> }
		}

		// Fetch submission windows and existing submissions in parallel
		const [events, submissions] = await Promise.all([
			db
				.select({
					trackWorkoutId: competitionEventsTable.trackWorkoutId,
					submissionOpensAt: competitionEventsTable.submissionOpensAt,
					submissionClosesAt: competitionEventsTable.submissionClosesAt,
				})
				.from(competitionEventsTable)
				.where(
					and(
						eq(competitionEventsTable.competitionId, data.competitionId),
						inArray(
							competitionEventsTable.trackWorkoutId,
							data.trackWorkoutIds,
						),
					),
				),
			db
				.select({
					trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
				})
				.from(videoSubmissionsTable)
				.where(
					and(
						eq(videoSubmissionsTable.registrationId, registration.id),
						inArray(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutIds),
					),
				),
		])

		const submissionSet = new Set(submissions.map((s) => s.trackWorkoutId))
		const eventMap = new Map(events.map((e) => [e.trackWorkoutId, e]))
		const now = new Date()

		const statuses: Record<string, Status> = {}

		for (const twId of data.trackWorkoutIds) {
			const event = eventMap.get(twId)
			let canSubmit = true

			if (event?.submissionOpensAt && event?.submissionClosesAt) {
				const opensAt = new Date(event.submissionOpensAt)
				const closesAt = new Date(event.submissionClosesAt)
				canSubmit = now >= opensAt && now <= closesAt
			}

			statuses[twId] = {
				hasSubmitted: submissionSet.has(twId),
				canSubmit,
			}
		}

		return { statuses }
	})

/**
 * Submit or update a video submission for an event.
 * Also saves the claimed score to the scores table.
 * Athletes can re-submit until the submission window closes.
 */
export const submitVideoFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => submitVideoInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const db = getDb()

		// Check if user is registered for this competition
		const registration = await getAthleteRegistration(
			data.competitionId,
			session.userId,
		)

		if (!registration) {
			throw new Error(
				"You must be registered for this competition to submit a video",
			)
		}

		// Check submission window
		const windowCheck = await checkSubmissionWindow(
			data.competitionId,
			data.trackWorkoutId,
		)

		if (!windowCheck.allowed) {
			throw new Error(windowCheck.reason ?? "Cannot submit video at this time")
		}

		// Check for existing video submission
		const [existingSubmission] = await db
			.select({ id: videoSubmissionsTable.id })
			.from(videoSubmissionsTable)
			.where(
				and(
					eq(videoSubmissionsTable.registrationId, registration.id),
					eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
				),
			)
			.limit(1)

		const now = new Date()

		// Save or update video submission
		let submissionId: string

		if (existingSubmission) {
			// Update existing submission
			await db
				.update(videoSubmissionsTable)
				.set({
					videoUrl: data.videoUrl,
					notes: data.notes ?? null,
					submittedAt: now,
					updatedAt: now,
				})
				.where(eq(videoSubmissionsTable.id, existingSubmission.id))

			submissionId = existingSubmission.id
		} else {
			// Create new submission - Generate ID first, insert, then query back
			const id = createVideoSubmissionId()
			await db.insert(videoSubmissionsTable).values({
				id,
				registrationId: registration.id,
				trackWorkoutId: data.trackWorkoutId,
				userId: session.userId,
				videoUrl: data.videoUrl,
				notes: data.notes ?? null,
				submittedAt: now,
			})

			submissionId = id
		}

		// Save claimed score if provided
		if (data.score) {
			// Get workout details for encoding
			const workout = await getWorkoutDetails(data.trackWorkoutId)

			if (!workout) {
				throw new Error("Workout not found")
			}

			const scheme = workout.scheme as WorkoutScheme
			const scoreType =
				(workout.scoreType as ScoreType) || getDefaultScoreType(scheme)

			// Parse and validate the score
			const parseResult = parseScore(data.score, scheme)
			if (!parseResult.isValid) {
				throw new Error(
					`Invalid score format: ${parseResult.error || "Please check your entry"}`,
				)
			}

			// Encode the score
			let encodedValue: number | null = encodeScore(data.score, scheme)

			// Derive status server-side (ignore client-provided scoreStatus)
			// For time-with-cap, any time >= cap is treated as capped
			let status: "scored" | "cap" = "scored"
			let secondaryValue: number | null = null

			if (
				scheme === "time-with-cap" &&
				workout.timeCap &&
				encodedValue !== null
			) {
				const capMs = workout.timeCap * 1000
				if (encodedValue >= capMs) {
					status = "cap"
					// Normalize over-cap submissions to exactly the cap time
					encodedValue = capMs

					// Parse secondary score (reps at cap) only when capped
					if (data.secondaryScore) {
						const trimmed = data.secondaryScore.trim()
						if (trimmed) {
							const parsed = Number.parseInt(trimmed, 10)
							// Validate: must be a non-negative integer
							if (!Number.isNaN(parsed) && parsed >= 0) {
								secondaryValue = parsed
							}
							// Invalid values are silently ignored (clamped to null)
						}
					}
				}
			}

			// Parse tiebreak score
			let tiebreakValue: number | null = null
			if (data.tiebreakScore && workout.tiebreakScheme) {
				tiebreakValue = encodeScore(
					data.tiebreakScore,
					workout.tiebreakScheme as WorkoutScheme,
				)
				if (tiebreakValue === null) {
					throw new Error(
						`Invalid tiebreak score format: "${data.tiebreakScore}". Please check your entry.`,
					)
				}
			}

			// Time cap in milliseconds
			const timeCapMs = workout.timeCap ? workout.timeCap * 1000 : null

			// Compute sort key (includes secondary_value and tiebreak for proper ordering)
			const sortKey =
				encodedValue !== null
					? computeSortKey({
							value: encodedValue,
							status,
							scheme,
							scoreType,
							timeCap:
								status === "cap" && secondaryValue !== null
									? { ms: timeCapMs ?? 0, secondaryValue }
									: undefined,
							tiebreak:
								tiebreakValue !== null && workout.tiebreakScheme
									? {
											scheme: workout.tiebreakScheme as "time" | "reps",
											value: tiebreakValue,
										}
									: undefined,
						})
					: null

			// Get teamId from track
			const [track] = await db
				.select({
					ownerTeamId: programmingTracksTable.ownerTeamId,
				})
				.from(programmingTracksTable)
				.where(eq(programmingTracksTable.id, workout.trackId))
				.limit(1)

			if (!track?.ownerTeamId) {
				throw new Error("Could not determine team ownership")
			}

			// Upsert the score
			await db
				.insert(scoresTable)
				.values({
					userId: session.userId,
					teamId: track.ownerTeamId,
					workoutId: workout.workoutId,
					competitionEventId: data.trackWorkoutId,
					scheme,
					scoreType,
					scoreValue: encodedValue,
					status,
					statusOrder: getStatusOrder(status),
					sortKey: sortKey ? sortKeyToString(sortKey) : null,
					tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
					tiebreakValue,
					timeCapMs,
					secondaryValue,
					scalingLevelId: registration.divisionId,
					asRx: true,
					recordedAt: now,
				})
				.onDuplicateKeyUpdate({
					set: {
						scoreValue: encodedValue,
						status,
						statusOrder: getStatusOrder(status),
						sortKey: sortKey ? sortKeyToString(sortKey) : null,
						tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
						tiebreakValue,
						timeCapMs,
						secondaryValue,
						scalingLevelId: registration.divisionId,
						updatedAt: now,
					},
				})
		}

		return {
			success: true,
			submissionId,
			isUpdate: !!existingSubmission,
		}
	})

/**
 * Get all video submissions for an event (organizer view).
 * Includes athlete info, division, and review status (based on whether a verified score exists).
 */
export const getOrganizerSubmissionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getOrganizerSubmissionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user is authenticated and has organizer permission
		const [competition] = await db
			.select({ organizingTeamId: competitionsTable.organizingTeamId })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("NOT_FOUND: Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Get all video submissions for this event with athlete and registration info
		const submissions = await db
			.select({
				id: videoSubmissionsTable.id,
				videoUrl: videoSubmissionsTable.videoUrl,
				notes: videoSubmissionsTable.notes,
				submittedAt: videoSubmissionsTable.submittedAt,
				reviewedAt: videoSubmissionsTable.reviewedAt,
				registrationId: videoSubmissionsTable.registrationId,
				userId: videoSubmissionsTable.userId,
				// Athlete info
				athleteFirstName: userTable.firstName,
				athleteLastName: userTable.lastName,
				athleteEmail: userTable.email,
				athleteAvatar: userTable.avatar,
				// Division info
				divisionId: competitionRegistrationsTable.divisionId,
				divisionLabel: scalingLevelsTable.label,
				// Team name (for team divisions)
				teamName: competitionRegistrationsTable.teamName,
			})
			.from(videoSubmissionsTable)
			.innerJoin(
				competitionRegistrationsTable,
				eq(
					videoSubmissionsTable.registrationId,
					competitionRegistrationsTable.id,
				),
			)
			.innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
			.leftJoin(
				scalingLevelsTable,
				eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
			)
			.where(eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId))

		// Get scores for all submissions to determine review status
		// A submission is "reviewed" if there's a corresponding score entry
		const submissionUserIds = submissions.map((s) => s.userId)

		const scoresMap: Record<
			string,
			{ scoreValue: number | null; status: string; displayScore: string | null }
		> = {}

		if (submissionUserIds.length > 0) {
			const scores = await db
				.select({
					userId: scoresTable.userId,
					scoreValue: scoresTable.scoreValue,
					status: scoresTable.status,
					scheme: scoresTable.scheme,
				})
				.from(scoresTable)
				.where(eq(scoresTable.competitionEventId, data.trackWorkoutId))

			for (const score of scores) {
				let displayScore: string | null = null
				if (score.scoreValue !== null && score.scheme) {
					displayScore = decodeScore(
						score.scoreValue,
						score.scheme as WorkoutScheme,
						{ compact: false },
					)
				}
				scoresMap[score.userId] = {
					scoreValue: score.scoreValue,
					status: score.status,
					displayScore,
				}
			}
		}

		// Combine submissions with scores
		const result = submissions.map((submission) => {
			const score = scoresMap[submission.userId]
			return {
				id: submission.id,
				videoUrl: submission.videoUrl,
				notes: submission.notes,
				submittedAt: submission.submittedAt,
				registrationId: submission.registrationId,
				athlete: {
					id: submission.userId,
					firstName: submission.athleteFirstName,
					lastName: submission.athleteLastName,
					email: submission.athleteEmail,
					avatar: submission.athleteAvatar,
				},
				division: submission.divisionId
					? {
							id: submission.divisionId,
							label: submission.divisionLabel,
						}
					: null,
				teamName: submission.teamName,
				score: score
					? {
							value: score.scoreValue,
							displayScore: score.displayScore,
							status: score.status,
						}
					: null,
				// Review status based on whether an organizer has reviewed
				reviewStatus: submission.reviewedAt
					? ("reviewed" as const)
					: ("pending" as const),
			}
		})

		// Apply filters
		let filtered = result

		// Division filter
		if (data.divisionFilter) {
			filtered = filtered.filter((s) => s.division?.id === data.divisionFilter)
		}

		// Status filter
		if (data.statusFilter && data.statusFilter !== "all") {
			filtered = filtered.filter((s) => s.reviewStatus === data.statusFilter)
		}

		// Calculate totals
		const totalSubmissions = result.length
		const reviewedCount = result.filter(
			(s) => s.reviewStatus === "reviewed",
		).length
		const pendingCount = totalSubmissions - reviewedCount

		return {
			submissions: filtered,
			totals: {
				total: totalSubmissions,
				reviewed: reviewedCount,
				pending: pendingCount,
			},
		}
	})

/**
 * Get submission counts grouped by trackWorkoutId for the review index page.
 * Returns total submissions and reviewed count (users with scores) per event.
 */
export const getSubmissionCountsByEventFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				trackWorkoutIds: z.array(z.string().min(1)).min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Query 1: total submissions per trackWorkoutId
		const submissionCounts = await autochunk(
			{ items: data.trackWorkoutIds },
			async (chunk) =>
				db
					.select({
						trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
						total: count(),
					})
					.from(videoSubmissionsTable)
					.where(inArray(videoSubmissionsTable.trackWorkoutId, chunk))
					.groupBy(videoSubmissionsTable.trackWorkoutId),
		)

		// Query 2: reviewed count — submissions where reviewedAt is set
		const reviewedCounts = await autochunk(
			{ items: data.trackWorkoutIds },
			async (chunk) =>
				db
					.select({
						trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
						reviewed: count(),
					})
					.from(videoSubmissionsTable)
					.where(
						and(
							inArray(videoSubmissionsTable.trackWorkoutId, chunk),
							isNotNull(videoSubmissionsTable.reviewedAt),
						),
					)
					.groupBy(videoSubmissionsTable.trackWorkoutId),
		)

		// Build result map
		const subMap = new Map(
			submissionCounts.map((r) => [r.trackWorkoutId, r.total]),
		)
		const revMap = new Map(
			reviewedCounts.map((r) => [r.trackWorkoutId, r.reviewed]),
		)

		const counts: Record<
			string,
			{ total: number; reviewed: number; pending: number }
		> = {}

		for (const twId of data.trackWorkoutIds) {
			const total = subMap.get(twId) ?? 0
			const reviewed = revMap.get(twId) ?? 0
			counts[twId] = { total, reviewed, pending: total - reviewed }
		}

		return { counts }
	})

/**
 * Get a single video submission by ID for organizer review.
 */
export const getOrganizerSubmissionDetailFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				submissionId: z.string().min(1),
				competitionId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify user has organizer permission for this competition
		const [competition] = await db
			.select({ organizingTeamId: competitionsTable.organizingTeamId })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("NOT_FOUND: Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const [submission] = await db
			.select({
				id: videoSubmissionsTable.id,
				videoUrl: videoSubmissionsTable.videoUrl,
				notes: videoSubmissionsTable.notes,
				submittedAt: videoSubmissionsTable.submittedAt,
				reviewedAt: videoSubmissionsTable.reviewedAt,
				reviewedBy: videoSubmissionsTable.reviewedBy,
				trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
				registrationId: videoSubmissionsTable.registrationId,
				userId: videoSubmissionsTable.userId,
				// Athlete info
				athleteFirstName: userTable.firstName,
				athleteLastName: userTable.lastName,
				athleteEmail: userTable.email,
				athleteAvatar: userTable.avatar,
				// Division info
				divisionId: competitionRegistrationsTable.divisionId,
				divisionLabel: scalingLevelsTable.label,
				// Team name
				teamName: competitionRegistrationsTable.teamName,
			})
			.from(videoSubmissionsTable)
			.innerJoin(
				competitionRegistrationsTable,
				eq(
					videoSubmissionsTable.registrationId,
					competitionRegistrationsTable.id,
				),
			)
			.innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
			.leftJoin(
				scalingLevelsTable,
				eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
			)
			.where(eq(videoSubmissionsTable.id, data.submissionId))
			.limit(1)

		if (!submission) {
			return { submission: null }
		}

		// Get score for this user + event
		const [score] = await db
			.select({
				id: scoresTable.id,
				scoreValue: scoresTable.scoreValue,
				status: scoresTable.status,
				scheme: scoresTable.scheme,
			})
			.from(scoresTable)
			.where(
				and(
					eq(scoresTable.competitionEventId, submission.trackWorkoutId),
					eq(scoresTable.userId, submission.userId),
				),
			)
			.limit(1)

		let displayScore: string | null = null
		if (
			score?.scoreValue !== null &&
			score?.scoreValue !== undefined &&
			score?.scheme
		) {
			displayScore = decodeScore(
				score.scoreValue,
				score.scheme as WorkoutScheme,
				{ compact: false },
			)
		}

		return {
			submission: {
				id: submission.id,
				videoUrl: submission.videoUrl,
				notes: submission.notes,
				submittedAt: submission.submittedAt,
				reviewedAt: submission.reviewedAt,
				reviewedBy: submission.reviewedBy,
				trackWorkoutId: submission.trackWorkoutId,
				athlete: {
					id: submission.userId,
					firstName: submission.athleteFirstName,
					lastName: submission.athleteLastName,
					email: submission.athleteEmail,
					avatar: submission.athleteAvatar,
				},
				division: submission.divisionId
					? {
							id: submission.divisionId,
							label: submission.divisionLabel,
						}
					: null,
				teamName: submission.teamName,
				scoreId: score?.id ?? null,
			score: score
					? {
							value: score.scoreValue,
							displayScore,
							status: score.status,
						}
					: null,
				reviewStatus: submission.reviewedAt
					? ("reviewed" as const)
					: ("pending" as const),
			},
		}
	})

/**
 * Mark a video submission as reviewed by an organizer.
 */
export const markSubmissionReviewedFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				submissionId: z.string().min(1),
				competitionId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const db = getDb()

		// Verify organizer permission
		const [competition] = await db
			.select({ organizingTeamId: competitionsTable.organizingTeamId })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("NOT_FOUND: Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		await db
			.update(videoSubmissionsTable)
			.set({
				reviewedAt: new Date(),
				reviewedBy: session.userId,
			})
			.where(eq(videoSubmissionsTable.id, data.submissionId))

		return { success: true }
	})

/**
 * Unmark a video submission review (set back to pending).
 */
export const unmarkSubmissionReviewedFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				submissionId: z.string().min(1),
				competitionId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const db = getDb()

		// Verify organizer permission
		const [competition] = await db
			.select({ organizingTeamId: competitionsTable.organizingTeamId })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("NOT_FOUND: Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		await db
			.update(videoSubmissionsTable)
			.set({
				reviewedAt: null,
				reviewedBy: null,
			})
			.where(eq(videoSubmissionsTable.id, data.submissionId))

		return { success: true }
	})
