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
 * Format an ISO 8601 datetime string for display in the user's timezone.
 * Example: "Saturday, March 15, 2025 at 5:00 PM"
 */
function formatDateTimeForDisplay(
	isoString: string,
	timezone: string,
): string {
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
 * Check if a notification has already been sent
 */
async function hasNotificationBeenSent(params: {
	competitionEventId: string
	registrationId: string
	type: SubmissionWindowNotificationType
}): Promise<boolean> {
	const db = getDb()
	const existing = await db.query.submissionWindowNotificationsTable.findFirst({
		where: and(
			eq(submissionWindowNotificationsTable.competitionEventId, params.competitionEventId),
			eq(submissionWindowNotificationsTable.registrationId, params.registrationId),
			eq(submissionWindowNotificationsTable.type, params.type),
		),
	})
	return !!existing
}

/**
 * Record that a notification was sent
 */
async function recordNotificationSent(params: {
	competitionId: string
	competitionEventId: string
	registrationId: string
	userId: string
	type: SubmissionWindowNotificationType
	sentToEmail: string
}): Promise<void> {
	const db = getDb()
	await db.insert(submissionWindowNotificationsTable).values({
		competitionId: params.competitionId,
		competitionEventId: params.competitionEventId,
		registrationId: params.registrationId,
		userId: params.userId,
		type: params.type,
		sentToEmail: params.sentToEmail,
	})
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

	try {
		// Check if already sent
		if (await hasNotificationBeenSent({
			competitionEventId,
			registrationId,
			type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_OPENS,
		})) {
			return false
		}

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

		// Record that we sent this notification
		await recordNotificationSent({
			competitionId,
			competitionEventId,
			registrationId,
			userId,
			type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_OPENS,
			sentToEmail: user.email,
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
		logError({
			message: "[Submission Notification] Failed to send window opens notification",
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
	notificationType: typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_24H | typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_1H | typeof SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_15M
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

	try {
		// Check if already sent
		if (await hasNotificationBeenSent({
			competitionEventId,
			registrationId,
			type: notificationType,
		})) {
			return false
		}

		const db = getDb()
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, userId),
		})

		if (!user?.email) {
			logError({
				message: "[Submission Notification] Cannot send reminder - no email",
				attributes: { userId, registrationId, competitionEventId, notificationType },
			})
			return false
		}

		const athleteName = getAthleteName(user)
		const formattedCloseTime = formatDateTimeForDisplay(submissionClosesAt, timezone)

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
			tags: [{ name: "type", value: `submission-window-reminder-${timeRemaining.replace(" ", "-")}` }],
		})

		// Record that we sent this notification
		await recordNotificationSent({
			competitionId,
			competitionEventId,
			registrationId,
			userId,
			type: notificationType,
			sentToEmail: user.email,
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
		logError({
			message: "[Submission Notification] Failed to send reminder notification",
			error: err,
			attributes: { userId, registrationId, competitionEventId, notificationType },
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

	try {
		// Check if already sent
		if (await hasNotificationBeenSent({
			competitionEventId,
			registrationId,
			type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSED,
		})) {
			return false
		}

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

		// Record that we sent this notification
		await recordNotificationSent({
			competitionId,
			competitionEventId,
			registrationId,
			userId,
			type: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSED,
			sentToEmail: user.email,
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
		logError({
			message: "[Submission Notification] Failed to send window closed notification",
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

			// Append 'Z' to indicate UTC since SQLite datetime strings don't include timezone
			const opensAt = new Date(event.submissionOpensAt.replace(" ", "T") + "Z")
			const closesAt = event.submissionClosesAt
				? new Date(event.submissionClosesAt.replace(" ", "T") + "Z")
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
			const twentyThreeHours45mFromNow = new Date(now.getTime() + twentyFourHoursMs - fifteenMinutesMs)
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
					if (closesAt <= twentyFourHoursFromNow && closesAt > twentyThreeHours45mFromNow) {
						const sent = await sendWindowClosesReminderNotification({
							...baseParams,
							submissionClosesAt: event.submissionClosesAt!,
							timeRemaining: "24 hours",
							notificationType: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_24H,
						})
						if (sent) result.windowCloses24h++
					}

					// 3. Window closes in ~1 hour (45m - 1h window)
					if (closesAt <= oneHourFromNow && closesAt > fortyFiveMinutesFromNow) {
						const sent = await sendWindowClosesReminderNotification({
							...baseParams,
							submissionClosesAt: event.submissionClosesAt!,
							timeRemaining: "1 hour",
							notificationType: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_1H,
						})
						if (sent) result.windowCloses1h++
					}

					// 4. Window closes in ~15 minutes (0 - 15m window) - LAST CHANCE!
					if (closesAt <= fifteenMinutesFromNow && closesAt > now) {
						const sent = await sendWindowClosesReminderNotification({
							...baseParams,
							submissionClosesAt: event.submissionClosesAt!,
							timeRemaining: "15 minutes",
							notificationType: SUBMISSION_WINDOW_NOTIFICATION_TYPES.WINDOW_CLOSES_15M,
						})
						if (sent) result.windowCloses15m++
					}

					// 5. Window just closed (within last 15 minutes)
					if (closesAt <= now && closesAt > fifteenMinutesAgo) {
						// TODO: Check if user has submitted a score
						// For now, we'll assume they haven't (can be enhanced later)
						const hasSubmitted = false

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
			message: "[Submission Notification] Processed all submission window notifications",
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
