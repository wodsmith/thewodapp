/**
 * Submission Verification Server Functions
 *
 * Server functions for organizers to view and verify athlete video submissions
 * for online competition events.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoreVerificationLogsTable, scoresTable } from "@/db/schemas/scores"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { workouts } from "@/db/schemas/workouts"
import { logInfo } from "@/lib/logging"
import {
	computeSortKey,
	decodeScore,
	encodeScore,
	sortKeyToString,
	type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface VerificationInfo {
	status: "verified" | "adjusted" | null
	verifiedAt: Date | null
	verifiedByName: string | null
}

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
	verification: VerificationInfo
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

const getVerificationLogsInputSchema = z.object({
	scoreId: z.string().min(1),
	competitionId: z.string().min(1),
})

export interface VerificationLogEntry {
	id: string
	action: string
	performedByName: string
	performedAt: Date
	originalScoreValue: number | null
	originalStatus: string | null
	newScoreValue: number | null
	newStatus: string | null
	scheme: string | null
}

const verifySubmissionScoreInputSchema = z.object({
	competitionId: z.string().min(1),
	trackWorkoutId: z.string().min(1),
	scoreId: z.string().min(1),
	action: z.enum(["verify", "adjust"]),
	// Required only when action === "adjust"
	adjustedScore: z.string().optional(),
	adjustedScoreStatus: z.enum(["scored", "cap"]).optional(),
	secondaryScore: z.string().optional(),
	tieBreakScore: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Verify or adjust a submitted competition score
 */
export const verifySubmissionScoreFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		verifySubmissionScoreInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{ success: boolean; verificationStatus: string }> => {
			const db = getDb()

			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			// Load competition to get organizingTeamId
			const [competition] = await db
				.select({ organizingTeamId: competitionsTable.organizingTeamId })
				.from(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))
				.limit(1)

			if (!competition) {
				throw new Error("Competition not found")
			}

			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			// Verify the event belongs to this competition
			const [competitionEvent] = await db
				.select({ id: competitionEventsTable.id })
				.from(competitionEventsTable)
				.where(
					and(
						eq(competitionEventsTable.competitionId, data.competitionId),
						eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
					),
				)
				.limit(1)

			if (!competitionEvent) {
				throw new Error("Event not found in this competition")
			}

			// Load the score (including current values for audit log)
			const [score] = await db
				.select({
					id: scoresTable.id,
					userId: scoresTable.userId,
					scheme: scoresTable.scheme,
					scoreType: scoresTable.scoreType,
					tiebreakScheme: scoresTable.tiebreakScheme,
					timeCapMs: scoresTable.timeCapMs,
					scoreValue: scoresTable.scoreValue,
					status: scoresTable.status,
					secondaryValue: scoresTable.secondaryValue,
					tiebreakValue: scoresTable.tiebreakValue,
				})
				.from(scoresTable)
				.where(
					and(
						eq(scoresTable.id, data.scoreId),
						eq(scoresTable.competitionEventId, data.trackWorkoutId),
					),
				)
				.limit(1)

			if (!score) {
				throw new Error("Score not found")
			}

			const now = new Date()

			if (data.action === "verify") {
				await db
					.update(scoresTable)
					.set({
						verificationStatus: "verified",
						verifiedAt: now,
						verifiedByUserId: session.userId,
						updatedAt: now,
					})
					.where(eq(scoresTable.id, data.scoreId))

				await db.insert(scoreVerificationLogsTable).values({
					scoreId: data.scoreId,
					competitionId: data.competitionId,
					trackWorkoutId: data.trackWorkoutId,
					athleteUserId: score.userId,
					action: "verified",
					performedByUserId: session.userId,
					performedAt: now,
				})

				logInfo({
					message: "[Score] Organizer verified score",
					attributes: {
						scoreId: data.scoreId,
						competitionId: data.competitionId,
						verifiedByUserId: session.userId,
					},
				})

				return { success: true, verificationStatus: "verified" }
			}

			// action === "adjust"
			if (!data.adjustedScore || !data.adjustedScoreStatus) {
				throw new Error(
					"adjustedScore and adjustedScoreStatus are required for adjust action",
				)
			}

			const scheme = score.scheme as WorkoutScheme
			const newStatus = data.adjustedScoreStatus

			// Encode the adjusted score
			let encodedValue: number | null = null
			if (newStatus === "cap" && score.timeCapMs) {
				encodedValue = score.timeCapMs
			} else {
				encodedValue = encodeScore(data.adjustedScore, scheme)
			}

			// Parse secondary value (reps at cap)
			let secondaryValue: number | null = null
			if (data.secondaryScore && newStatus === "cap") {
				const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
				if (!Number.isNaN(parsed) && parsed >= 0) {
					secondaryValue = parsed
				}
			}

			// Encode tiebreak if provided
			let tiebreakValue: number | null = null
			if (data.tieBreakScore && score.tiebreakScheme) {
				try {
					tiebreakValue = encodeScore(
						data.tieBreakScore,
						score.tiebreakScheme as WorkoutScheme,
					)
				} catch {
					// Ignore tiebreak encoding errors
				}
			}

			// Compute sort key
			const statusOrder = newStatus === "cap" ? 1 : 0
			const sortKey =
				encodedValue !== null
					? computeSortKey({
							value: encodedValue,
							status: newStatus,
							scheme,
							scoreType: (score.scoreType as "max" | "min") ?? "max",
							timeCap:
								newStatus === "cap" &&
								score.timeCapMs &&
								secondaryValue !== null
									? { ms: score.timeCapMs, secondaryValue }
									: undefined,
							tiebreak:
								tiebreakValue !== null && score.tiebreakScheme
									? {
											scheme: score.tiebreakScheme as "time" | "reps",
											value: tiebreakValue,
										}
									: undefined,
						})
					: null

			await db
				.update(scoresTable)
				.set({
					scoreValue: encodedValue,
					status: newStatus,
					statusOrder,
					sortKey: sortKey ? sortKeyToString(sortKey) : null,
					secondaryValue,
					tiebreakValue,
					verificationStatus: "adjusted",
					verifiedAt: now,
					verifiedByUserId: session.userId,
					updatedAt: now,
				})
				.where(eq(scoresTable.id, data.scoreId))

			await db.insert(scoreVerificationLogsTable).values({
				scoreId: data.scoreId,
				competitionId: data.competitionId,
				trackWorkoutId: data.trackWorkoutId,
				athleteUserId: score.userId,
				action: "adjusted",
				originalScoreValue: score.scoreValue,
				originalStatus: score.status,
				originalSecondaryValue: score.secondaryValue,
				originalTiebreakValue: score.tiebreakValue,
				newScoreValue: encodedValue,
				newStatus,
				newSecondaryValue: secondaryValue,
				newTiebreakValue: tiebreakValue,
				performedByUserId: session.userId,
				performedAt: now,
			})

			logInfo({
				message: "[Score] Organizer adjusted score",
				attributes: {
					scoreId: data.scoreId,
					competitionId: data.competitionId,
					verifiedByUserId: session.userId,
					newStatus,
					encodedValue,
				},
			})

			return { success: true, verificationStatus: "adjusted" }
		},
	)

/**
 * Get a single submission detail for verification
 */
export const getSubmissionDetailFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getSubmissionDetailInputSchema.parse(data))
	.handler(
		async ({
			data,
		}): Promise<{
			submission: SubmissionDetail | null
			event: EventDetails
		}> => {
			const db = getDb()

			const session = await getSessionFromCookie()
			if (!session?.userId) {
				throw new Error("Not authenticated")
			}

			const [competition] = await db
				.select({ organizingTeamId: competitionsTable.organizingTeamId })
				.from(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))
				.limit(1)

			if (!competition) {
				throw new Error("Competition not found")
			}

			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

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
					verificationStatus: scoresTable.verificationStatus,
					verifiedAt: scoresTable.verifiedAt,
					verifiedByUserId: scoresTable.verifiedByUserId,
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

			// Get verifier name if verified/adjusted
			let verifiedByName: string | null = null
			if (score.verifiedByUserId) {
				const [verifier] = await db
					.select({
						firstName: userTable.firstName,
						lastName: userTable.lastName,
					})
					.from(userTable)
					.where(eq(userTable.id, score.verifiedByUserId))
					.limit(1)
				if (verifier) {
					verifiedByName =
						`${verifier.firstName || ""} ${verifier.lastName || ""}`.trim() ||
						null
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
				verification: {
					status: (score.verificationStatus as "verified" | "adjusted") ?? null,
					verifiedAt: score.verifiedAt ?? null,
					verifiedByName,
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
	.handler(async ({ data }): Promise<{ submissions: SubmissionListItem[] }> => {
		const db = getDb()

		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const [competition] = await db
			.select({ organizingTeamId: competitionsTable.organizingTeamId })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Get all scores for this event
		const scores = await db
			.select({
				id: scoresTable.id,
				userId: scoresTable.userId,
				scoreValue: scoresTable.scoreValue,
				status: scoresTable.status,
				scheme: scoresTable.scheme,
				scalingLevelId: scoresTable.scalingLevelId,
				verificationStatus: scoresTable.verificationStatus,
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

			// Derive status from verificationStatus
			const reviewStatus =
				score.verificationStatus === "verified" ||
				score.verificationStatus === "adjusted"
					? "reviewed"
					: "pending"

			return {
				id: score.id,
				athleteName: user
					? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown"
					: "Unknown",
				teamName: registration?.teamName ?? null,
				divisionLabel: division?.label ?? "Open",
				hasVideo: usersWithVideo.has(score.userId),
				scoreDisplay,
				status: reviewStatus,
			}
		})

		// Sort by athlete name
		submissions.sort((a, b) => a.athleteName.localeCompare(b.athleteName))

		return { submissions }
	})

/**
 * Get event details for verification page header
 */
export const getEventDetailsForVerificationFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		getEventDetailsForVerificationInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<{ event: EventDetails | null }> => {
		const db = getDb()

		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		const [competition] = await db
			.select({ organizingTeamId: competitionsTable.organizingTeamId })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition) {
			throw new Error("Competition not found")
		}

		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

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

/**
 * Get verification audit logs for a score
 */
export const getVerificationLogsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getVerificationLogsInputSchema.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{ logs: VerificationLogEntry[] }> => {
			const db = getDb()

			// Verify organizer permission
			const [competition] = await db
				.select({ organizingTeamId: competitionsTable.organizingTeamId })
				.from(competitionsTable)
				.where(eq(competitionsTable.id, data.competitionId))
				.limit(1)

			if (!competition) {
				return { logs: [] }
			}

			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
			)

			// Get logs for this score, newest first
			const logs = await db
				.select({
					id: scoreVerificationLogsTable.id,
					action: scoreVerificationLogsTable.action,
					performedByUserId: scoreVerificationLogsTable.performedByUserId,
					performedAt: scoreVerificationLogsTable.performedAt,
					originalScoreValue: scoreVerificationLogsTable.originalScoreValue,
					originalStatus: scoreVerificationLogsTable.originalStatus,
					newScoreValue: scoreVerificationLogsTable.newScoreValue,
					newStatus: scoreVerificationLogsTable.newStatus,
					trackWorkoutId: scoreVerificationLogsTable.trackWorkoutId,
				})
				.from(scoreVerificationLogsTable)
				.where(
					and(
						eq(scoreVerificationLogsTable.scoreId, data.scoreId),
						eq(scoreVerificationLogsTable.competitionId, data.competitionId),
					),
				)
				.orderBy(desc(scoreVerificationLogsTable.performedAt))

			if (logs.length === 0) {
				return { logs: [] }
			}

			// Get performer names
			const performerIds = [...new Set(logs.map((l) => l.performedByUserId))]
			const performers = await autochunk(
				{ items: performerIds },
				async (chunk) =>
					db
						.select({
							id: userTable.id,
							firstName: userTable.firstName,
							lastName: userTable.lastName,
						})
						.from(userTable)
						.where(inArray(userTable.id, chunk)),
			)
			const performerMap = new Map(performers.map((p) => [p.id, p]))

			// Get workout scheme for score decoding
			let scheme: string | null = null
			if (logs[0]?.trackWorkoutId) {
				const [tw] = await db
					.select({ scheme: workouts.scheme })
					.from(trackWorkoutsTable)
					.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
					.where(eq(trackWorkoutsTable.id, logs[0].trackWorkoutId))
					.limit(1)
				scheme = tw?.scheme ?? null
			}

			return {
				logs: logs.map((log) => {
					const performer = performerMap.get(log.performedByUserId)
					const name = performer
						? `${performer.firstName || ""} ${performer.lastName || ""}`.trim() ||
							"Unknown"
						: "Unknown"

					return {
						id: log.id,
						action: log.action,
						performedByName: name,
						performedAt: log.performedAt,
						originalScoreValue: log.originalScoreValue,
						originalStatus: log.originalStatus,
						newScoreValue: log.newScoreValue,
						newStatus: log.newStatus,
						scheme,
					}
				}),
			}
		},
	)
