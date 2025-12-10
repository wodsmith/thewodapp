import "server-only"

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
import { sendEmail } from "@/utils/email"
import { RegistrationConfirmationEmail } from "@/react-email/compete/registration-confirmation"
import { CompetitionTeamInviteEmail } from "@/react-email/compete/team-invite"
import { PaymentExpiredEmail } from "@/react-email/compete/payment-expired"
import { TeammateJoinedEmail } from "@/react-email/compete/teammate-joined"
import {
	formatCents,
	formatDate,
	getAthleteName,
	parsePendingTeammateCount,
	isTeamComplete,
	getTeammateJoinedSubject,
} from "./helpers"

// ============================================================================
// Registration Confirmation
// ============================================================================

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
				message: "[Email] Cannot send registration confirmation - no competition",
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
				message: "[Email] Cannot send registration confirmation - no registration",
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

// ============================================================================
// Competition Team Invite
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

		const captainName = captain
			? getAthleteName(captain)
			: "Team Captain"

		// Fetch athlete team
		const athleteTeam = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, competitionTeamId),
		})

		const teamName = athleteTeam?.name || "Team"

		// Fetch registration to get division
		const registration = await db.query.competitionRegistrationsTable.findFirst(
			{
				where: eq(competitionRegistrationsTable.athleteTeamId, competitionTeamId),
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

		const inviteLink = `https://wodsmith.com/team-invite?token=${inviteToken}`

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

// ============================================================================
// Payment Expired
// ============================================================================

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

// ============================================================================
// Teammate Joined
// ============================================================================

/**
 * Notify captain when teammate accepts invite
 * Called after successful team invite acceptance
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
				where: eq(competitionRegistrationsTable.athleteTeamId, competitionTeamId),
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
