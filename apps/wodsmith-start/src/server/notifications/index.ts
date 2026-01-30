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
	processSubmissionWindowNotifications,
	sendWindowOpensNotification,
	sendWindowClosesReminderNotification,
	sendWindowClosedNotification,
	type ProcessedNotificationResult,
} from "./submission-window"
