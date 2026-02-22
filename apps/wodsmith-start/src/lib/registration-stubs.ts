/**
 * Registration functions for TanStack Start
 *
 * This file re-exports the fully implemented registration functions
 * from @/server/registration.ts. The stubs have been replaced with
 * complete implementations.
 *
 * Functions:
 * - registerForCompetition(): Full registration flow for individuals and teams
 * - notifyRegistrationConfirmed(): Email notification after registration
 */

export {
	notifyRegistrationConfirmed,
	registerForCompetition,
	sendPendingTeammateEmails,
} from "@/server/registration"
