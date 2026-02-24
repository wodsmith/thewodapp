/**
 * Notifications Server Module for TanStack Start
 * Re-exports notification functions from compete module
 */

export {
	notifyPaymentExpired,
	notifyRegistrationConfirmed,
	notifyTeammateJoined,
} from "./compete"

export {
	type ProcessedNotificationResult,
	processSubmissionWindowNotifications,
	sendWindowClosedNotification,
	sendWindowClosesReminderNotification,
	sendWindowOpensNotification,
} from "./submission-window"
