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
import { PaymentExpiredEmail } from "@/react-email/payment-expired"
import { RegistrationConfirmationEmail } from "@/react-email/registration-confirmation"
import { TeammateJoinedEmail } from "@/react-email/teammate-joined"
import { sendEmail } from "@/utils/email"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format cents to display currency (e.g., 5000 -> "$50.00")
 */
function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

/**
 * Format date for email display.
 * Handles both YYYY-MM-DD strings (new format) and Date objects (legacy).
 */
function formatDate(date: string | Date | null | undefined): string {
	if (!date) return ""

	const weekdays = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	]
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]

	// Handle YYYY-MM-DD string format
	if (typeof date === "string") {
		const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
		if (match) {
			const [, yearStr, monthStr, dayStr] = match
			const year = Number(yearStr)
			const monthNum = Number(monthStr)
			const day = Number(dayStr)
			// Calculate weekday from YYYY-MM-DD (Zeller's congruence alternative)
			const d = new Date(Date.UTC(year, monthNum - 1, day))
			const weekday = weekdays[d.getUTCDay()]
			const month = months[monthNum - 1]
			return `${weekday}, ${month} ${day}, ${year}`
		}
		return ""
	}

	// Handle Date object (legacy)
	const weekday = weekdays[date.getUTCDay()]
	const month = months[date.getUTCMonth()]
	const day = date.getUTCDate()
	const year = date.getUTCFullYear()

	return `${weekday}, ${month} ${day}, ${year}`
}

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
 * Parse pending teammates count from JSON string
 */
function parsePendingTeammateCount(
	pendingTeammatesJson: string | null | undefined,
): number {
	if (!pendingTeammatesJson) return 0

	try {
		const parsed = JSON.parse(pendingTeammatesJson) as unknown
		if (Array.isArray(parsed)) {
			return parsed.length
		}
		return 0
	} catch {
		return 0
	}
}

/**
 * Check if team is complete
 */
function isTeamComplete(currentSize: number, maxSize: number): boolean {
	return currentSize >= maxSize
}

/**
 * Get subject line for teammate joined email
 */
function getTeammateJoinedSubject(params: {
	isTeamComplete: boolean
	newTeammateName: string
	teamName: string
	competitionName: string
}): string {
	if (params.isTeamComplete) {
		return `Your team is complete for ${params.competitionName}!`
	}
	return `${params.newTeammateName} joined ${params.teamName}`
}

// ============================================================================
// Notification Functions
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
