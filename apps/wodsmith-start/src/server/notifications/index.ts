/**
 * Notifications Server Module for TanStack Start
 * Re-exports notification functions from compete module
 */

export {
	notifyCompetitionTeamInvite,
	notifyPaymentExpired,
	notifyRegistrationConfirmed,
	notifyTeammateJoined,
	notifyVolunteerApproved,
	notifyVolunteerSignupReceived,
} from "./compete"

export {
	type ProcessedNotificationResult,
	processSubmissionWindowNotifications,
	sendWindowClosedNotification,
	sendWindowClosesReminderNotification,
	sendWindowOpensNotification,
} from "./submission-window"
