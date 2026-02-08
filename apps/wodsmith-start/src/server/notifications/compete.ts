/**
 * Competition Notifications for TanStack Start
 * This file uses top-level imports for server-only modules.
 * Ported from apps/wodsmith/src/server/notifications/compete.ts
 *
 * These functions send email notifications for competition-related events.
 */

import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	scalingLevelsTable,
	teamMembershipTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import { CompetitionTeamInviteEmail } from "@/react-email/compete/team-invite"
import { VolunteerApprovedEmail } from "@/react-email/compete/volunteer-approved"
import { VolunteerSignupConfirmationEmail } from "@/react-email/compete/volunteer-signup-confirmation"
import { PaymentExpiredEmail } from "@/react-email/payment-expired"
import { RegistrationConfirmationEmail } from "@/react-email/registration-confirmation"
import { TeammateJoinedEmail } from "@/react-email/teammate-joined"
import { formatDateStringWithWeekday } from "@/utils/date-utils"
import { sendEmail } from "@/utils/email"
import {
	buildInviteLink,
	formatCents,
	formatDate,
	getAthleteName,
	getTeammateJoinedSubject,
	isTeamComplete,
	parsePendingTeammateCount,
} from "./helpers"

// ============================================================================
// Notification Functions
// ============================================================================

/**
 * Send competition team invite email
 * Called when captain invites teammate during registration
 */
export async function notifyCompetitionTeamInvite(params: {
	recipientEmail: string
	inviteToken: string
	competitionTeamId: string
	competitionId: string
	invitedByUserId: string
}): Promise<void> {
	const {
		recipientEmail,
		inviteToken,
		competitionTeamId,
		competitionId,
		invitedByUserId,
	} = params

	try {
		const db = getDb()

		// Fetch competition
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionId),
		})

		if (!competition) {
			logError({
				message: "[Email] Cannot send team invite - no competition",
				attributes: { competitionId, competitionTeamId },
			})
			return
		}

		// Fetch captain (inviter)
		const captain = await db.query.userTable.findFirst({
			where: eq(userTable.id, invitedByUserId),
		})

		const captainName = captain ? getAthleteName(captain) : "Team Captain"

		// Fetch athlete team
		const athleteTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, competitionTeamId),
		})

		const teamName = athleteTeam?.name || "Team"

		// Fetch registration to get division
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(
					competitionRegistrationsTable.athleteTeamId,
					competitionTeamId,
				),
			},
		)

		let divisionName = "Open"
		let currentRosterSize = 1
		let maxRosterSize = 3

		if (registration?.divisionId) {
			const division = await db.query.scalingLevelsTable.findFirst({
				where: eq(scalingLevelsTable.id, registration.divisionId),
			})
			if (division) {
				divisionName = division.label
				maxRosterSize = division.teamSize
			}
		}

		// Count current team members
		if (competitionTeamId) {
			const members = await db
				.select()
				.from(teamMembershipTable)
				.where(eq(teamMembershipTable.teamId, competitionTeamId))
			currentRosterSize = members.length
		}

		const inviteLink = buildInviteLink(inviteToken)

		await sendEmail({
			to: recipientEmail,
			subject: `Join ${teamName} for ${competition.name}`,
			template: CompetitionTeamInviteEmail({
				recipientEmail,
				captainName,
				teamName,
				competitionName: competition.name,
				competitionSlug: competition.slug,
				competitionDate: formatDate(competition.startDate),
				divisionName,
				currentRosterSize,
				maxRosterSize,
				inviteLink,
				registrationDeadline: competition.registrationClosesAt
					? formatDate(competition.registrationClosesAt)
					: undefined,
			}),
			tags: [{ name: "type", value: "compete-team-invite" }],
		})

		logInfo({
			message: "[Email] Sent competition team invite",
			attributes: {
				recipientEmail,
				competitionId,
				competitionTeamId,
				competitionName: competition.name,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send competition team invite",
			error: err,
			attributes: { recipientEmail, competitionId, competitionTeamId },
		})
	}
}

/**
 * Send payment expired notification
 * Called when Stripe checkout session expires
 */
export async function notifyPaymentExpired(params: {
	userId: string
	competitionId: string
	divisionId: string
}): Promise<void> {
	const { userId, competitionId, divisionId } = params

	try {
		const db = getDb()

		// Fetch user
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, userId),
		})

		if (!user?.email) {
			logError({
				message: "[Email] Cannot send payment expired - no email",
				attributes: { userId, competitionId },
			})
			return
		}

		// Fetch competition
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionId),
		})

		if (!competition) {
			logError({
				message: "[Email] Cannot send payment expired - no competition",
				attributes: { competitionId },
			})
			return
		}

		// Fetch division
		let divisionName = "Open"
		if (divisionId) {
			const division = await db.query.scalingLevelsTable.findFirst({
				where: eq(scalingLevelsTable.id, divisionId),
			})
			if (division) {
				divisionName = division.label
			}
		}

		const athleteName = getAthleteName(user)

		await sendEmail({
			to: user.email,
			subject: `Payment Expired: ${competition.name}`,
			template: PaymentExpiredEmail({
				athleteName,
				competitionName: competition.name,
				competitionSlug: competition.slug,
				divisionName,
				registrationDeadline: competition.registrationClosesAt
					? formatDate(competition.registrationClosesAt)
					: undefined,
			}),
			tags: [{ name: "type", value: "compete-payment-expired" }],
		})

		logInfo({
			message: "[Email] Sent payment expired notification",
			attributes: {
				userId,
				competitionId,
				competitionName: competition.name,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send payment expired notification",
			error: err,
			attributes: { userId, competitionId },
		})
	}
}

/**
 * Send registration confirmation email
 * Called after both free and paid registration completes
 */
export async function notifyRegistrationConfirmed(params: {
	userId: string
	registrationId: string
	competitionId: string
	isPaid: boolean
	amountPaidCents?: number
}): Promise<void> {
	const { userId, registrationId, competitionId, isPaid, amountPaidCents } =
		params

	try {
		const db = getDb()

		// Fetch user
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, userId),
		})

		if (!user?.email) {
			logError({
				message: "[Email] Cannot send registration confirmation - no email",
				attributes: { userId, registrationId },
			})
			return
		}

		// Fetch competition
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionId),
		})

		if (!competition) {
			logError({
				message:
					"[Email] Cannot send registration confirmation - no competition",
				attributes: { competitionId, registrationId },
			})
			return
		}

		// Fetch registration with division
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(competitionRegistrationsTable.id, registrationId),
			},
		)

		if (!registration) {
			logError({
				message:
					"[Email] Cannot send registration confirmation - no registration",
				attributes: { registrationId },
			})
			return
		}

		// Fetch division if exists
		let divisionName = "Open"
		if (registration.divisionId) {
			const division = await db.query.scalingLevelsTable.findFirst({
				where: eq(scalingLevelsTable.id, registration.divisionId),
			})
			if (division) {
				divisionName = division.label
			}
		}

		// Count pending teammates
		const pendingTeammateCount = parsePendingTeammateCount(
			registration.pendingTeammates,
		)

		const athleteName = getAthleteName(user)

		await sendEmail({
			to: user.email,
			subject: `Registration Confirmed: ${competition.name}`,
			template: RegistrationConfirmationEmail({
				athleteName,
				competitionName: competition.name,
				competitionSlug: competition.slug,
				registrationId: registration.id,
				competitionDate: formatDate(competition.startDate),
				divisionName,
				teamName: registration.teamName ?? undefined,
				pendingTeammateCount:
					pendingTeammateCount > 0 ? pendingTeammateCount : undefined,
				isPaid,
				amountPaidFormatted: amountPaidCents
					? formatCents(amountPaidCents)
					: undefined,
			}),
			tags: [{ name: "type", value: "compete-registration-confirmed" }],
		})

		logInfo({
			message: "[Email] Sent registration confirmation",
			attributes: {
				userId,
				registrationId,
				competitionId,
				competitionName: competition.name,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send registration confirmation",
			error: err,
			attributes: { userId, registrationId, competitionId },
		})
	}
}

/**
 * Notify captain when teammate accepts invite
 */
export async function notifyTeammateJoined(params: {
	captainUserId: string
	newTeammateUserId: string
	competitionTeamId: string
	competitionId: string
}): Promise<void> {
	const { captainUserId, newTeammateUserId, competitionTeamId, competitionId } =
		params

	try {
		const db = getDb()

		// Fetch captain
		const captain = await db.query.userTable.findFirst({
			where: eq(userTable.id, captainUserId),
		})

		if (!captain?.email) {
			logError({
				message: "[Email] Cannot send teammate joined - captain has no email",
				attributes: { captainUserId, competitionTeamId },
			})
			return
		}

		// Fetch new teammate
		const newTeammate = await db.query.userTable.findFirst({
			where: eq(userTable.id, newTeammateUserId),
		})

		const newTeammateName = newTeammate
			? getAthleteName(newTeammate)
			: "A teammate"

		// Fetch competition
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionId),
		})

		if (!competition) {
			logError({
				message: "[Email] Cannot send teammate joined - no competition",
				attributes: { competitionId },
			})
			return
		}

		// Fetch athlete team
		const athleteTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, competitionTeamId),
		})

		const teamName = athleteTeam?.name || "Team"

		// Fetch registration to get division and max team size
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(
					competitionRegistrationsTable.athleteTeamId,
					competitionTeamId,
				),
			},
		)

		let maxRosterSize = 3
		if (registration?.divisionId) {
			const division = await db.query.scalingLevelsTable.findFirst({
				where: eq(scalingLevelsTable.id, registration.divisionId),
			})
			if (division) {
				maxRosterSize = division.teamSize
			}
		}

		// Count current team members
		const members = await db
			.select()
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.teamId, competitionTeamId))
		const currentRosterSize = members.length

		const teamComplete = isTeamComplete(currentRosterSize, maxRosterSize)

		const captainName = getAthleteName(captain)

		const subject = getTeammateJoinedSubject({
			isTeamComplete: teamComplete,
			newTeammateName,
			teamName,
			competitionName: competition.name,
		})

		await sendEmail({
			to: captain.email,
			subject,
			template: TeammateJoinedEmail({
				captainName,
				newTeammateName,
				teamName,
				competitionName: competition.name,
				competitionSlug: competition.slug,
				currentRosterSize,
				maxRosterSize,
				isTeamComplete: teamComplete,
			}),
			tags: [{ name: "type", value: "compete-teammate-joined" }],
		})

		logInfo({
			message: "[Email] Sent teammate joined notification",
			attributes: {
				captainUserId,
				newTeammateUserId,
				competitionTeamId,
				competitionId,
				isTeamComplete: teamComplete,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send teammate joined notification",
			error: err,
			attributes: { captainUserId, newTeammateUserId, competitionTeamId },
		})
	}
}

// ============================================================================
// Volunteer Notifications
// ============================================================================

/**
 * Send confirmation email when someone submits the public volunteer signup form.
 * Confirms their application was received and is pending review.
 */
export async function notifyVolunteerSignupReceived(params: {
	volunteerEmail: string
	volunteerName: string
	competitionTeamId: string
}): Promise<void> {
	const { volunteerEmail, volunteerName, competitionTeamId } = params

	try {
		const db = getDb()

		// Find the competition via the competition team
		const competitionTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, competitionTeamId),
		})

		if (!competitionTeam) {
			logError({
				message: "[Email] Cannot send volunteer signup confirmation - no team",
				attributes: { competitionTeamId },
			})
			return
		}

		// Find competition that uses this team
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.competitionTeamId, competitionTeamId),
		})

		if (!competition) {
			logError({
				message:
					"[Email] Cannot send volunteer signup confirmation - no competition",
				attributes: { competitionTeamId },
			})
			return
		}

		await sendEmail({
			to: volunteerEmail,
			subject: `Volunteer Application Received: ${competition.name}`,
			template: VolunteerSignupConfirmationEmail({
				volunteerName,
				competitionName: competition.name,
				competitionSlug: competition.slug,
				competitionDate: formatDate(competition.startDate),
			}),
			tags: [{ name: "type", value: "volunteer-signup-confirmation" }],
		})

		logInfo({
			message: "[Email] Sent volunteer signup confirmation",
			attributes: {
				competitionTeamId,
				competitionId: competition.id,
				competitionName: competition.name,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send volunteer signup confirmation",
			error: err,
			attributes: { competitionTeamId },
		})
	}
}

/**
 * Send email when a volunteer's application is approved by organizers.
 * Includes their assigned role types.
 */
export async function notifyVolunteerApproved(params: {
	volunteerEmail: string
	volunteerName: string
	competitionTeamId: string
	roleTypes?: string[]
}): Promise<void> {
	const { volunteerEmail, volunteerName, competitionTeamId, roleTypes } = params

	try {
		const db = getDb()

		// Find competition that uses this team
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.competitionTeamId, competitionTeamId),
		})

		if (!competition) {
			logError({
				message:
					"[Email] Cannot send volunteer approved email - no competition",
				attributes: { competitionTeamId },
			})
			return
		}

		// Format role types for display (capitalize first letter)
		const formattedRoleTypes = roleTypes?.map((role) => {
			// Convert snake_case to Title Case (e.g., "head_judge" -> "Head Judge")
			return role
				.split("_")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ")
		})

		await sendEmail({
			to: volunteerEmail,
			subject: `You're approved to volunteer at ${competition.name}!`,
			template: VolunteerApprovedEmail({
				volunteerName,
				competitionName: competition.name,
				competitionSlug: competition.slug,
				competitionDate: formatDate(competition.startDate),
				roleTypes: formattedRoleTypes,
			}),
			tags: [{ name: "type", value: "volunteer-approved" }],
		})

		logInfo({
			message: "[Email] Sent volunteer approved notification",
			attributes: {
				competitionTeamId,
				competitionId: competition.id,
				competitionName: competition.name,
				roleTypes,
			},
		})
	} catch (err) {
		logError({
			message: "[Email] Failed to send volunteer approved notification",
			error: err,
			attributes: { competitionTeamId },
		})
	}
}
