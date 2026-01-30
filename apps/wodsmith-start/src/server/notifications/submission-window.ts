/**
 * Submission Window Notifications Service
 *
 * This service sends email notifications to athletes about submission window events:
 * - Window opens: When a submission window becomes active
 * - Window closes soon (24h): Reminder 24 hours before window closes
 * - Window closes soon (1h): Final reminder 1 hour before window closes
 * - Window closed: Notification when window has closed
 */

import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionEventsTable,
	competitionRegistrationsTable,
	competitionsTable,
	scoresTable,
	submissionWindowNotificationsTable,
	trackWorkoutsTable,
	userTable,
	workouts,
	SUBMISSION_WINDOW_NOTIFICATION_TYPES,
	type SubmissionWindowNotificationType,
} from "@/db/schema"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import { SubmissionWindowOpensEmail } from "@/react-email/submission-window-opens"
import { SubmissionWindowReminderEmail } from "@/react-email/submission-window-reminder"
import { SubmissionWindowClosedEmail } from "@/react-email/submission-window-closed"
import { sendEmail } from "@/utils/email"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive athlete display name from user data
 */
function getAthleteName(user: {
	firstName?: string | null
	email?: string | null
}): string {
	if (user.firstName) return user.firstName
	if (user.email) return user.email.split("@")[0] || "Athlete"
	return "Athlete"
}

/**
 * Check if a datetime string already has a timezone indicator.
 * Matches: 'Z', 'z', '+HH:MM', '+HHMM', '+HH', '-HH:MM', '-HHMM', '-HH'
 */
function hasTimezoneIndicator(datetime: string): boolean {
	const trimmed = datetime.trim()
	// Check for Z/z suffix
	if (trimmed.endsWith("Z") || trimmed.endsWith("z")) {
		return true
	}
	// Check for numeric offset like +05:30, -0800, +05, etc.
	// Pattern: ends with + or - followed by 2-4 digits, optionally with colon
	const offsetPattern = /[+-]\d{2}(:\d{2}|\d{2})?$/
	return offsetPattern.test(trimmed)
}

/**
 * Normalize a datetime string to a UTC-aware ISO format.
 * - Replaces space with 'T' for ISO 8601 compliance
 * - Appends 'Z' only if no timezone indicator exists
 * - Handles SQLite datetime format (e.g., "2026-01-27 00:36:37")
 */
function normalizeToUtcDatetime(datetime: string): string {
	const trimmed = datetime.trim()
	// Replace space with T for ISO 8601 format
	const normalized = trimmed.replace(" ", "T")
	// Only append Z if no timezone indicator exists
	if (hasTimezoneIndicator(normalized)) {
		return normalized
	}
	return normalized + "Z"
}

/**
 * Format an ISO 8601 datetime string for display in the user's timezone.
 * Example: "Saturday, March 15, 2025 at 5:00 PM"
 */
function formatDateTimeForDisplay(isoString: string, timezone: string): string {
	try {
		const date = new Date(isoString)
		return date.toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZone: timezone,
		})
	} catch {
		// Fallback if timezone is invalid
		return isoString
	}
}

/**
 * Reserve a notification slot using the unique constraint as a lock.
 * This prevents race conditions in concurrent cron runs by inserting first.
 * Returns true if reservation succeeded (notification not yet sent), false if already reserved.
 */
async function reserveNotification(params: {
	competitionId: string
	competitionEventId: string
	registrationId: string
	userId: string
	type: SubmissionWindowNotificationType
	sentToEmail: string
}): Promise<boolean> {
	const db = getDb()
	try {
		// Use onConflictDoNothing - if the unique constraint is violated,
		// the insert silently does nothing and returns no rows
		const result = await db
			.insert(submissionWindowNotificationsTable)
			.values({
				competitionId: params.competitionId,
				competitionEventId: params.competitionEventId,
				registrationId: params.registrationId,
				userId: params.userId,
				type: params.type,
				sentToEmail: params.sentToEmail,
			})
			.onConflictDoNothing()
			.returning({ id: submissionWindowNotificationsTable.id })

		// If we got a result back, the insert succeeded (notification reserved)
		return result.length > 0
	} catch (err) {
		// Log unexpected errors but treat as "already reserved"
		logError({
			message: "[Submission Notification] Error reserving notification",
			error: err,
			attributes: params,
		})
		return false
	}
}

/**
 * Delete a notification reservation (used when email send fails to allow retry)
 */
async function deleteNotificationReservation(params: {
	competitionEventId: string
	registrationId: string
	type: SubmissionWindowNotificationType
}): Promise<void> {
	const db = getDb()
	await db
		.delete(submissionWindowNotificationsTable)
		.where(
			and(
				eq(
					submissionWindowNotificationsTable.competitionEventId,
					params.competitionEventId,
				),
				eq(
					submissionWindowNotificationsTable.registrationId,
					params.registrationId,
				),
				eq(submissionWindowNotificationsTable.type, params.type),
			),
		)
}

/**
 * Check if a user has submitted a score for a competition event
 */
async function hasUserSubmittedScore(params: {
	userId: string
	competitionEventId: string
}): Promise<boolean> {
	const db = getDb()
	const score = await db.query.scoresTable.findFirst({
		where: and(
			eq(scoresTable.userId, params.userId),
			eq(scoresTable.competitionEventId, params.competitionEventId),
		),
		columns: { id: true },
	})
	return !!score
}

// ============================================================================
// Notification Sender Functions
// ============================================================================

/**
 * Send a "submission window opens" notification to an athlete
 */
export async function sendWindowOpensNotification(params: {
	userId: string
	registrationId: string
	competitionId: string
	competitionEventId: string
	competitionName: string
	competitionSlug: string
	workoutName: string
	workoutDescription?: string
	submissionClosesAt?: string
	timezone: string
}): Promise<boolean> {
	const {
		userId,
		registrationId,
		competitionId,
		competitionEventId,
		competitionName,
		competitionSlug,
		workoutName,
		workoutDescription,
		submissionClosesAt,
		timezone,
	} = params

	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
	})

	if (!user?.email) {
		logError({
			message: "[Submission Notification] Cannot send window opens - no email",
			attributes: { userId, registrationId, competitionEventId },
		})
		return false
	}

	// Reserve the notification slot first (prevents race conditions)
	const reserved = await reserveNotification({
		competitionId,
		competitionEventId,
		registrationId,
		userId,
		type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_OPENS,
		sentToEmail: user.email,
	})

	if (!reserved) {
		// Already sent by another process
		return false
	}

	try {
		const athleteName = getAthleteName(user)
		const formattedCloseTime = submissionClosesAt
			? formatDateTimeForDisplay(submissionClosesAt, timezone)
			: undefined

		await sendEmail({
			to: user.email,
			subject: `Submission Window Open: ${workoutName} - ${competitionName}`,
			template: SubmissionWindowOpensEmail({
				athleteName,
				competitionName,
				competitionSlug,
				workoutName,
				workoutDescription,
				submissionClosesAt: formattedCloseTime,
				timezone,
			}),
			tags: [{ name: "type", value: "submission-window-opens" }],
		})

		logInfo({
			message: "[Submission Notification] Sent window opens notification",
			attributes: {
				userId,
				registrationId,
				competitionEventId,
				competitionName,
				workoutName,
			},
		})

		return true
	} catch (err) {
		// Email failed - delete reservation to allow retry on next cron run
		await deleteNotificationReservation({
			competitionEventId,
			registrationId,
			type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_OPENS,
		})
		logError({
			message:
				"[Submission Notification] Failed to send window opens notification",
			error: err,
			attributes: { userId, registrationId, competitionEventId },
		})
		return false
	}
}

/**
 * Send a "submission window closes soon" reminder notification to an athlete
 */
export async function sendWindowClosesReminderNotification(params: {
	userId: string
	registrationId: string
	competitionId: string
	competitionEventId: string
	competitionName: string
	competitionSlug: string
	workoutName: string
	workoutDescription?: string
	submissionClosesAt: string
	timezone: string
	timeRemaining: "24 hours" | "1 hour" | "15 minutes"
	notificationType:
		| typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_24H
		| typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_1H
		| typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_15M
}): Promise<boolean> {
	const {
		userId,
		registrationId,
		competitionId,
		competitionEventId,
		competitionName,
		competitionSlug,
		workoutName,
		workoutDescription,
		submissionClosesAt,
		timezone,
		timeRemaining,
		notificationType,
	} = params

	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
	})

	if (!user?.email) {
		logError({
			message: "[Submission Notification] Cannot send reminder - no email",
			attributes: {
				userId,
				registrationId,
				competitionEventId,
				notificationType,
			},
		})
		return false
	}

	// Reserve the notification slot first (prevents race conditions)
	const reserved = await reserveNotification({
		competitionId,
		competitionEventId,
		registrationId,
		userId,
		type: notificationType,
		sentToEmail: user.email,
	})

	if (!reserved) {
		// Already sent by another process
		return false
	}

	try {
		const athleteName = getAthleteName(user)
		const formattedCloseTime = formatDateTimeForDisplay(
			submissionClosesAt,
			timezone,
		)

		await sendEmail({
			to: user.email,
			subject: `${timeRemaining} Left: Submit ${workoutName} - ${competitionName}`,
			template: SubmissionWindowReminderEmail({
				athleteName,
				competitionName,
				competitionSlug,
				workoutName,
				workoutDescription,
				submissionClosesAt: formattedCloseTime,
				timezone,
				timeRemaining,
			}),
			tags: [
				{
					name: "type",
					value: `submission-window-reminder-${timeRemaining.replace(" ", "-")}`,
				},
			],
		})

		logInfo({
			message: "[Submission Notification] Sent window reminder notification",
			attributes: {
				userId,
				registrationId,
				competitionEventId,
				competitionName,
				workoutName,
				timeRemaining,
			},
		})

		return true
	} catch (err) {
		// Email failed - delete reservation to allow retry on next cron run
		await deleteNotificationReservation({
			competitionEventId,
			registrationId,
			type: notificationType,
		})
		logError({
			message: "[Submission Notification] Failed to send reminder notification",
			error: err,
			attributes: {
				userId,
				registrationId,
				competitionEventId,
				notificationType,
			},
		})
		return false
	}
}

/**
 * Send a "submission window closed" notification to an athlete
 */
export async function sendWindowClosedNotification(params: {
	userId: string
	registrationId: string
	competitionId: string
	competitionEventId: string
	competitionName: string
	competitionSlug: string
	workoutName: string
	hasSubmitted: boolean
}): Promise<boolean> {
	const {
		userId,
		registrationId,
		competitionId,
		competitionEventId,
		competitionName,
		competitionSlug,
		workoutName,
		hasSubmitted,
	} = params

	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
	})

	if (!user?.email) {
		logError({
			message: "[Submission Notification] Cannot send window closed - no email",
			attributes: { userId, registrationId, competitionEventId },
		})
		return false
	}

	// Reserve the notification slot first (prevents race conditions)
	const reserved = await reserveNotification({
		competitionId,
		competitionEventId,
		registrationId,
		userId,
		type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSED,
		sentToEmail: user.email,
	})

	if (!reserved) {
		// Already sent by another process
		return false
	}

	try {
		const athleteName = getAthleteName(user)

		await sendEmail({
			to: user.email,
			subject: hasSubmitted
				? `Submission Window Closed: ${workoutName} - ${competitionName}`
				: `Missed Submission: ${workoutName} - ${competitionName}`,
			template: SubmissionWindowClosedEmail({
				athleteName,
				competitionName,
				competitionSlug,
				workoutName,
				hasSubmitted,
			}),
			tags: [{ name: "type", value: "submission-window-closed" }],
		})

		logInfo({
			message: "[Submission Notification] Sent window closed notification",
			attributes: {
				userId,
				registrationId,
				competitionEventId,
				competitionName,
				workoutName,
				hasSubmitted,
			},
		})

		return true
	} catch (err) {
		// Email failed - delete reservation to allow retry on next cron run
		await deleteNotificationReservation({
			competitionEventId,
			registrationId,
			type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSED,
		})
		logError({
			message:
				"[Submission Notification] Failed to send window closed notification",
			error: err,
			attributes: { userId, registrationId, competitionEventId },
		})
		return false
	}
}

// ============================================================================
// Batch Processing Functions
// ============================================================================

export interface ProcessedNotificationResult {
	windowOpens: number
	windowCloses24h: number
	windowCloses1h: number
	windowCloses15m: number
	windowClosed: number
	errors: number
}

/**
 * Process all pending submission window notifications.
 * This is the main entry point called by the scheduled job (every 15 minutes).
 *
 * It checks for:
 * 1. Windows that just opened (within the last 15 minutes)
 * 2. Windows closing in 24 hours (23h45m - 24h window)
 * 3. Windows closing in 1 hour (45m - 1h window)
 * 4. Windows closing in 15 minutes (0 - 15m window) - LAST CHANCE!
 * 5. Windows that just closed (within the last 15 minutes)
 */
export async function processSubmissionWindowNotifications(): Promise<ProcessedNotificationResult> {
	const db = getDb()
	const now = new Date()
	const result: ProcessedNotificationResult = {
		windowOpens: 0,
		windowCloses24h: 0,
		windowCloses1h: 0,
		windowCloses15m: 0,
		windowClosed: 0,
		errors: 0,
	}

	try {
		// Get all competition events with submission windows
		const events = await db
			.select({
				event: competitionEventsTable,
				competition: competitionsTable,
				trackWorkout: trackWorkoutsTable,
				workout: workouts,
			})
			.from(competitionEventsTable)
			.innerJoin(
				competitionsTable,
				eq(competitionEventsTable.competitionId, competitionsTable.id),
			)
			.innerJoin(
				trackWorkoutsTable,
				eq(competitionEventsTable.trackWorkoutId, trackWorkoutsTable.id),
			)
			.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
			.where(
				and(
					// Only online competitions
					eq(competitionsTable.competitionType, "online"),
					// Only published competitions
					eq(competitionsTable.status, "published"),
					// Has a submission window defined
					sql`${competitionEventsTable.submissionOpensAt} IS NOT NULL`,
				),
			)

		for (const { event, competition, workout } of events) {
			if (!event.submissionOpensAt) continue

			// Normalize datetime strings to UTC-aware ISO format
			// Handles both SQLite format ("2026-01-27 00:36:37") and ISO with timezone
			const opensAt = new Date(normalizeToUtcDatetime(event.submissionOpensAt))
			const closesAt = event.submissionClosesAt
				? new Date(normalizeToUtcDatetime(event.submissionClosesAt))
				: null

			const timezone = competition.timezone || "America/Denver"

			// Get all registrations for this competition
			const registrations = await db
				.select({
					registration: competitionRegistrationsTable,
					user: userTable,
				})
				.from(competitionRegistrationsTable)
				.innerJoin(
					userTable,
					eq(competitionRegistrationsTable.userId, userTable.id),
				)
				.where(eq(competitionRegistrationsTable.eventId, competition.id))

			// Time window calculations for 15-minute cron intervals
			const fifteenMinutesMs = 15 * 60 * 1000
			const oneHourMs = 60 * 60 * 1000
			const twentyFourHoursMs = 24 * 60 * 60 * 1000

			const fifteenMinutesAgo = new Date(now.getTime() - fifteenMinutesMs)
			const fifteenMinutesFromNow = new Date(now.getTime() + fifteenMinutesMs)
			const fortyFiveMinutesFromNow = new Date(now.getTime() + 45 * 60 * 1000)
			const oneHourFromNow = new Date(now.getTime() + oneHourMs)
			const twentyThreeHours45mFromNow = new Date(
				now.getTime() + twentyFourHoursMs - fifteenMinutesMs,
			)
			const twentyFourHoursFromNow = new Date(now.getTime() + twentyFourHoursMs)

			for (const { registration, user } of registrations) {
				if (!user.email) continue

				const baseParams = {
					userId: user.id,
					registrationId: registration.id,
					competitionId: competition.id,
					competitionEventId: event.id,
					competitionName: competition.name,
					competitionSlug: competition.slug,
					workoutName: workout.name,
					workoutDescription: workout.description || undefined,
					timezone,
				}

				// 1. Window just opened (within last 15 minutes)
				if (opensAt <= now && opensAt > fifteenMinutesAgo) {
					const sent = await sendWindowOpensNotification({
						...baseParams,
						submissionClosesAt: event.submissionClosesAt || undefined,
					})
					if (sent) result.windowOpens++
				}

				// Only process closing notifications if we have a close time
				if (closesAt) {
					// 2. Window closes in ~24 hours (23h45m - 24h window)
					if (
						closesAt <= twentyFourHoursFromNow &&
						closesAt > twentyThreeHours45mFromNow
					) {
						const sent = await sendWindowClosesReminderNotification({
							...baseParams,
							submissionClosesAt: event.submissionClosesAt!,
							timeRemaining: "24 hours",
							notificationType:
								SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_24H,
						})
						if (sent) result.windowCloses24h++
					}

					// 3. Window closes in ~1 hour (45m - 1h window)
					if (
						closesAt <= oneHourFromNow &&
						closesAt > fortyFiveMinutesFromNow
					) {
						const sent = await sendWindowClosesReminderNotification({
							...baseParams,
							submissionClosesAt: event.submissionClosesAt!,
							timeRemaining: "1 hour",
							notificationType:
								SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_1H,
						})
						if (sent) result.windowCloses1h++
					}

					// 4. Window closes in ~15 minutes (0 - 15m window) - LAST CHANCE!
					if (closesAt <= fifteenMinutesFromNow && closesAt > now) {
						const sent = await sendWindowClosesReminderNotification({
							...baseParams,
							submissionClosesAt: event.submissionClosesAt!,
							timeRemaining: "15 minutes",
							notificationType:
								SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_15M,
						})
						if (sent) result.windowCloses15m++
					}

					// 5. Window just closed (within last 15 minutes)
					if (closesAt <= now && closesAt > fifteenMinutesAgo) {
						// Check if user has actually submitted a score for this event
						const hasSubmitted = await hasUserSubmittedScore({
							userId: user.id,
							competitionEventId: event.id,
						})

						const sent = await sendWindowClosedNotification({
							...baseParams,
							hasSubmitted,
						})
						if (sent) result.windowClosed++
					}
				}
			}
		}

		logInfo({
			message:
				"[Submission Notification] Processed all submission window notifications",
			attributes: {
				windowOpens: result.windowOpens,
				windowCloses24h: result.windowCloses24h,
				windowCloses1h: result.windowCloses1h,
				windowCloses15m: result.windowCloses15m,
				windowClosed: result.windowClosed,
			},
		})

		return result
	} catch (err) {
		logError({
			message: "[Submission Notification] Failed to process notifications",
			error: err,
		})
		result.errors++
		return result
	}
}
