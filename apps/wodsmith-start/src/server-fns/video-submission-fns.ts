/**
 * Video Submission Server Functions for TanStack Start
 * Handles athlete video submissions for online competition events.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getVideoSubmissionInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
})

const submitVideoInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	videoUrl: z.string().url("Please enter a valid URL").max(2000),
	notes: z.string().max(1000).optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

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
		return { allowed: false, reason: "Video submissions are only for online competitions" }
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
): Promise<{ id: string } | null> {
	const db = getDb()

	const [registration] = await db
		.select({
			id: competitionRegistrationsTable.id,
		})
		.from(competitionRegistrationsTable)
		.where(
			and(
				eq(competitionRegistrationsTable.eventId, competitionId),
				eq(competitionRegistrationsTable.userId, userId),
			),
		)
		.limit(1)

	return registration ?? null
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the current user's video submission for an event.
 * Returns the submission if it exists, along with submission window status.
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

		return {
			submission: submission ?? null,
			canSubmit: windowCheck.allowed,
			reason: windowCheck.reason,
			isRegistered: true,
			submissionWindow: windowCheck.opensAt && windowCheck.closesAt
				? {
						opensAt: windowCheck.opensAt.toISOString(),
						closesAt: windowCheck.closesAt.toISOString(),
					}
				: null,
		}
	})

/**
 * Submit or update a video submission for an event.
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

		// Check for existing submission
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

			return {
				success: true,
				submissionId: existingSubmission.id,
				isUpdate: true,
			}
		}

		// Create new submission
		const [newSubmission] = await db
			.insert(videoSubmissionsTable)
			.values({
				registrationId: registration.id,
				trackWorkoutId: data.trackWorkoutId,
				userId: session.userId,
				videoUrl: data.videoUrl,
				notes: data.notes ?? null,
				submittedAt: now,
			})
			.returning({ id: videoSubmissionsTable.id })

		if (!newSubmission) {
			throw new Error("Failed to create video submission")
		}

		return {
			success: true,
			submissionId: newSubmission.id,
			isUpdate: false,
		}
	})
