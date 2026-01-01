/**
 * Registration Server Module for TanStack Start
 * Ported from apps/wodsmith/src/server/competitions.ts and notifications/compete.ts
 *
 * Contains the core registration logic for competitions:
 * - registerForCompetition(): Full registration flow for individuals and teams
 * - notifyRegistrationConfirmed(): Email notification after registration
 */

import { createId } from "@paralleldrive/cuid2"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	competitionsTable,
	SYSTEM_ROLES_ENUM,
	scalingLevelsTable,
	TEAM_TYPE_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { parseCompetitionSettings } from "@/server-fns/competition-divisions-fns"
import { generateSlug } from "@/utils/slugify"

// ============================================================================
// Helper Functions (ported from notifications/helpers.ts)
// ============================================================================

/**
 * Format cents to display currency (e.g., 5000 -> "$50.00")
 */
function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`
}

/**
 * Format date for email display using UTC to preserve calendar date.
 * Competition dates are stored as UTC midnight - using UTC methods
 * ensures consistent display regardless of server/recipient timezone.
 */
function formatDate(date: Date): string {
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

// ============================================================================
// Internal Team Invite Function
// ============================================================================

/**
 * Internal invite function for competition teams
 * Bypasses permission checks since captain is inviting during registration
 * Ported from apps/wodsmith/src/server/team-members.ts
 */
async function inviteUserToTeamInternal({
	teamId,
	email,
	roleId,
	isSystemRole = true,
	invitedBy,
	competitionContext,
}: {
	teamId: string
	email: string
	roleId: string
	isSystemRole?: boolean
	invitedBy: string
	competitionContext?: {
		competitionId: string
		competitionSlug: string
		teamName: string
		divisionName: string
	}
}): Promise<{
	userJoined: boolean
	userId?: string
	invitationSent: boolean
	token?: string
}> {
	const db = getDb()

	// Dynamic import for kv-session
	const { updateAllSessionsOfUser } = await import("@/utils/kv-session")

	// Check if user already exists
	const existingUser = await db.query.userTable.findFirst({
		where: eq(userTable.email, email.toLowerCase()),
	})

	if (existingUser) {
		// Check if user is already a member
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, teamId),
				eq(teamMembershipTable.userId, existingUser.id),
			),
		})

		if (existingMembership) {
			// User is already a member - return success without inserting
			return {
				userJoined: true,
				userId: existingUser.id,
				invitationSent: false,
			}
		}

		// User exists but not a member - add directly to team
		await db.insert(teamMembershipTable).values({
			teamId,
			userId: existingUser.id,
			roleId,
			isSystemRole: isSystemRole ? 1 : 0,
			invitedBy,
			invitedAt: new Date(),
			joinedAt: new Date(),
			isActive: 1,
		})

		// Also add to competition_event team if this is a competition team
		if (competitionContext) {
			// Get competition to find the competition_event team
			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, competitionContext.competitionId),
			})
			if (competition?.competitionTeamId) {
				// Check if already a member of competition_event team
				const existingEventMembership =
					await db.query.teamMembershipTable.findFirst({
						where: and(
							eq(teamMembershipTable.teamId, competition.competitionTeamId),
							eq(teamMembershipTable.userId, existingUser.id),
						),
					})
				if (!existingEventMembership) {
					await db.insert(teamMembershipTable).values({
						teamId: competition.competitionTeamId,
						userId: existingUser.id,
						roleId: SYSTEM_ROLES_ENUM.MEMBER,
						isSystemRole: 1,
						joinedAt: new Date(),
						isActive: 1,
					})
				}
			}
		}

		await updateAllSessionsOfUser(existingUser.id)
		return { userJoined: true, userId: existingUser.id, invitationSent: false }
	}

	// User doesn't exist - create invitation
	const token = createId()
	const expiresAt = new Date()
	expiresAt.setDate(expiresAt.getDate() + 30) // 30 days for competition invites

	await db.insert(teamInvitationTable).values({
		teamId,
		email: email.toLowerCase(),
		roleId,
		isSystemRole: isSystemRole ? 1 : 0,
		token,
		invitedBy,
		expiresAt,
	})

	// TODO: Send competition team invite email when notifyCompetitionTeamInvite is ported
	// For now, invites are created but notification emails are not sent
	// The invite can still be accepted via the token

	return { userJoined: false, invitationSent: true, token }
}

// ============================================================================
// Types
// ============================================================================

interface RegisterForCompetitionParams {
	competitionId: string
	userId: string
	divisionId: string
	// Team fields (required for team divisions)
	teamName?: string
	affiliateName?: string
	teammates?: Array<{
		email: string
		firstName?: string
		lastName?: string
		affiliateName?: string
	}>
}

interface RegisterForCompetitionResult {
	registrationId: string
	teamMemberId: string
	athleteTeamId: string | null
}

interface NotifyRegistrationConfirmedParams {
	userId: string
	registrationId: string
	competitionId: string
	isPaid: boolean
	amountPaidCents?: number
}

// ============================================================================
// Competition Lookup Helper
// ============================================================================

/**
 * Get competition by ID (internal helper)
 */
async function getCompetition(competitionId: string) {
	const db = getDb()
	return await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})
}

// ============================================================================
// Register for Competition
// ============================================================================

/**
 * Register a user for a competition
 *
 * Supports both individual (teamSize=1) and team (teamSize>1) registrations.
 * For team registrations:
 * - Captain is the user creating the registration
 * - Teammates are invited via email
 * - Teammates can accept invites to join the team
 *
 * @param params.teamName - Required for team divisions (teamSize > 1)
 * @param params.affiliateName - Optional affiliate/gym name for captain
 * @param params.teammates - Required for team divisions, array of teammate info
 */
export async function registerForCompetition(
	params: RegisterForCompetitionParams,
): Promise<RegisterForCompetitionResult> {
	const db = getDb()

	// Dynamic imports for kv-session (uses cloudflare: imports)
	const { updateAllSessionsOfUser } = await import("@/utils/kv-session")

	// 1. Validate competition exists
	const competition = await getCompetition(params.competitionId)
	if (!competition) {
		throw new Error("Competition not found")
	}

	// 2. Check registration window
	const now = new Date()
	if (
		competition.registrationOpensAt &&
		new Date(competition.registrationOpensAt) > now
	) {
		throw new Error("Registration has not opened yet")
	}
	if (
		competition.registrationClosesAt &&
		new Date(competition.registrationClosesAt) < now
	) {
		throw new Error("Registration has closed")
	}

	// 3. Get the user to validate profile completeness
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, params.userId),
	})

	if (!user) {
		throw new Error("User not found")
	}

	// Profile validation removed - users can complete profile after registration
	// The nav bar will show a notification prompting them to complete their profile

	// 4. Validate division belongs to competition's scaling group
	const settings = parseCompetitionSettings(competition.settings)
	const scalingGroupId = settings?.divisions?.scalingGroupId
	if (!scalingGroupId) {
		throw new Error("This competition does not have divisions configured")
	}

	const division = await db.query.scalingLevelsTable.findFirst({
		where: eq(scalingLevelsTable.id, params.divisionId),
	})

	if (!division) {
		throw new Error("Division not found")
	}

	if (division.scalingGroupId !== scalingGroupId) {
		throw new Error("Selected division does not belong to this competition")
	}

	// 6. Check if this is a team division
	const isTeamDivision = division.teamSize > 1

	// 7. Validate team data for team divisions
	if (isTeamDivision) {
		if (!params.teamName?.trim()) {
			throw new Error("Team name is required for team divisions")
		}
		if (
			!params.teammates ||
			params.teammates.length !== division.teamSize - 1
		) {
			throw new Error(`Team requires ${division.teamSize - 1} teammate(s)`)
		}
	}

	// 8. Check for duplicate registration
	const existingRegistration =
		await db.query.competitionRegistrationsTable.findFirst({
			where: and(
				eq(competitionRegistrationsTable.eventId, params.competitionId),
				eq(competitionRegistrationsTable.userId, params.userId),
			),
		})

	if (existingRegistration) {
		throw new Error("You are already registered for this competition")
	}

	// 9. For team registrations, check teammates not already registered
	if (isTeamDivision && params.teammates) {
		for (const teammate of params.teammates) {
			// Check if email is already in use by a registered user for this competition
			const teammateUser = await db.query.userTable.findFirst({
				where: eq(userTable.email, teammate.email.toLowerCase()),
			})

			if (teammateUser) {
				const teammateReg =
					await db.query.competitionRegistrationsTable.findFirst({
						where: and(
							eq(competitionRegistrationsTable.eventId, params.competitionId),
							eq(competitionRegistrationsTable.userId, teammateUser.id),
						),
					})

				if (teammateReg) {
					throw new Error(
						`${teammate.email} is already registered for this competition`,
					)
				}
			}
		}
	}

	let athleteTeamId: string | null = null

	// 10. For team registrations, create the competition_team
	if (isTeamDivision) {
		// Generate unique slug for athlete team
		let teamSlug = generateSlug(`${params.teamName}-${competition.slug}`)
		let teamSlugIsUnique = false
		let attempts = 0

		while (!teamSlugIsUnique && attempts < 5) {
			const existingTeam = await db.query.teamTable.findFirst({
				where: eq(teamTable.slug, teamSlug),
			})

			if (!existingTeam) {
				teamSlugIsUnique = true
			} else {
				teamSlug = `${generateSlug(`${params.teamName}-${competition.slug}`)}-${createId().substring(0, 4)}`
				attempts++
			}
		}

		if (!teamSlugIsUnique) {
			throw new Error("Could not generate unique slug for athlete team")
		}

		// Create competition_team for athlete squad
		const teamName = params.teamName ?? "Unknown Team"
		const newAthleteTeam = await db
			.insert(teamTable)
			.values({
				name: teamName,
				slug: teamSlug,
				type: TEAM_TYPE_ENUM.COMPETITION_TEAM,
				parentOrganizationId: competition.competitionTeamId, // Parent is the event team
				description: `Team ${params.teamName} competing in ${competition.name}`,
				creditBalance: 0,
				competitionMetadata: JSON.stringify({
					competitionId: params.competitionId,
					divisionId: params.divisionId,
				}),
			})
			.returning()

		const athleteTeam = Array.isArray(newAthleteTeam)
			? newAthleteTeam[0]
			: undefined
		if (!athleteTeam) {
			throw new Error("Failed to create athlete team")
		}

		athleteTeamId = athleteTeam.id

		// Add captain to athlete team with CAPTAIN role
		await db.insert(teamMembershipTable).values({
			teamId: athleteTeamId,
			userId: params.userId,
			roleId: SYSTEM_ROLES_ENUM.CAPTAIN,
			isSystemRole: 1,
			joinedAt: new Date(),
			isActive: 1,
		})
	}

	// 11. Create team_membership in competition_event team
	const teamMembershipResult = await db
		.insert(teamMembershipTable)
		.values({
			teamId: competition.competitionTeamId,
			userId: params.userId,
			roleId: SYSTEM_ROLES_ENUM.MEMBER,
			isSystemRole: 1,
			joinedAt: new Date(),
			isActive: 1,
		})
		.returning()

	const teamMember = Array.isArray(teamMembershipResult)
		? teamMembershipResult[0]
		: undefined
	if (!teamMember) {
		throw new Error("Failed to create team membership")
	}

	// 12. Store pending teammates as JSON for team registrations
	const pendingTeammatesJson =
		isTeamDivision && params.teammates
			? JSON.stringify(
					params.teammates.map((t) => ({
						email: t.email.toLowerCase(),
						firstName: t.firstName ?? null,
						lastName: t.lastName ?? null,
						affiliateName: t.affiliateName ?? null,
					})),
				)
			: null

	// 13. Create metadata JSON with captain's affiliate info (using new per-user format)
	const metadataJson = params.affiliateName
		? JSON.stringify({ affiliates: { [params.userId]: params.affiliateName } })
		: null

	// 14. Create competition_registration record
	const registrationResult = await db
		.insert(competitionRegistrationsTable)
		.values({
			id: `creg_${createId()}`,
			eventId: params.competitionId,
			userId: params.userId,
			teamMemberId: teamMember.id,
			divisionId: params.divisionId,
			registeredAt: new Date(),
			// Team fields
			teamName: isTeamDivision ? params.teamName : null,
			captainUserId: params.userId,
			athleteTeamId,
			pendingTeammates: pendingTeammatesJson,
			metadata: metadataJson,
		})
		.returning()

	const registration = Array.isArray(registrationResult)
		? registrationResult[0]
		: undefined
	if (!registration) {
		throw new Error("Failed to create registration")
	}

	// 15. For team registrations, invite teammates via team infrastructure
	if (isTeamDivision && params.teammates && athleteTeamId) {
		for (const teammate of params.teammates) {
			await inviteUserToTeamInternal({
				teamId: athleteTeamId,
				email: teammate.email,
				roleId: SYSTEM_ROLES_ENUM.MEMBER,
				isSystemRole: true,
				invitedBy: params.userId,
				competitionContext: {
					competitionId: params.competitionId,
					competitionSlug: competition.slug,
					teamName: params.teamName ?? "Unknown Team",
					divisionName: division.label,
				},
			})
		}
	}

	// 16. Update user's affiliate profile if not already set
	if (params.affiliateName && !user.affiliateName) {
		await db
			.update(userTable)
			.set({ affiliateName: params.affiliateName })
			.where(eq(userTable.id, params.userId))
	}

	// 17. Update all user sessions to include new team
	await updateAllSessionsOfUser(params.userId)

	// NOTE: Notification is NOT sent here - callers are responsible for calling
	// notifyRegistrationConfirmed() with appropriate isPaid/amountPaidCents values.
	// - Free registrations: caller sends with isPaid: false
	// - Paid registrations: Stripe webhook sends with isPaid: true after payment

	return {
		registrationId: registration.id,
		teamMemberId: teamMember.id,
		athleteTeamId,
	}
}

// ============================================================================
// Registration Confirmation Notification
// ============================================================================

/**
 * Send registration confirmation email
 * Called after both free and paid registration completes
 */
export async function notifyRegistrationConfirmed(
	params: NotifyRegistrationConfirmedParams,
): Promise<void> {
	const { userId, registrationId, competitionId, isPaid, amountPaidCents } =
		params

	// Dynamic imports for logging and email (avoid server-only issues)
	const { logInfo, logError } = await import(
		"@/lib/logging/posthog-otel-logger"
	)
	const { sendEmail } = await import("@/utils/email")
	const { RegistrationConfirmationEmail } = await import(
		"@/react-email/registration-confirmation"
	)

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
