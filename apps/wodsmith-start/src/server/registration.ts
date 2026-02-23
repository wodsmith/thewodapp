/**
 * Registration Server Module for TanStack Start
 * This file uses top-level imports for server-only modules.
 * Ported from apps/wodsmith/src/server/competitions.ts and notifications/compete.ts
 *
 * Contains the core registration logic for competitions:
 * - registerForCompetition(): Full registration flow for individuals and teams
 * - notifyRegistrationConfirmed(): Email notification after registration
 */

import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray, sql } from "drizzle-orm"
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
import {
	createTeamId,
	createTeamMembershipId,
	createCompetitionRegistrationId,
} from "@/db/schemas/common"
import { logError, logInfo } from "@/lib/logging/posthog-otel-logger"
import { RegistrationConfirmationEmail } from "@/react-email/registration-confirmation"
import { parseCompetitionSettings } from "@/server-fns/competition-divisions-fns"
import { sendCompetitionTeamInviteEmail, sendEmail } from "@/utils/email"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { generateSlug } from "@/utils/slugify"
import {
	DEFAULT_TIMEZONE,
	hasDateStartedInTimezone,
	isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"

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
			// Calculate weekday from YYYY-MM-DD
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
			isSystemRole,
			invitedBy,
			invitedAt: new Date(),
			joinedAt: new Date(),
			isActive: true,
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
						isSystemRole: true,
						joinedAt: new Date(),
						isActive: true,
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
		isSystemRole,
		token,
		invitedBy,
		expiresAt,
	})

	// Send competition team invite email
	if (competitionContext) {
		// Get competition name for email subject
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionContext.competitionId),
		})
		const competitionName = competition?.name ?? "the competition"

		// Get inviter name for personalized email
		const inviter = await db.query.userTable.findFirst({
			where: eq(userTable.id, invitedBy),
			columns: { firstName: true, lastName: true },
		})
		const inviterName = inviter
			? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
				"Your team captain"
			: "Your team captain"

		await sendCompetitionTeamInviteEmail({
			email: email.toLowerCase(),
			invitationToken: token,
			teamName: competitionContext.teamName,
			competitionName,
			divisionName: competitionContext.divisionName,
			inviterName,
		})
	}

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
	/** Pre-fetched entities to avoid redundant DB queries (used by workflow) */
	prefetched?: {
		user?: {
			id: string
			email: string | null
			firstName: string | null
		}
		competition?: {
			id: string
			name: string
			slug: string
			startDate: string | Date | null
		}
		registration?: {
			id: string
			divisionId: string | null
			teamName: string | null
			pendingTeammates: string | null
		}
		divisionName?: string
	}
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

	// 1. Validate competition exists
	const competition = await getCompetition(params.competitionId)
	if (!competition) {
		throw new Error("Competition not found")
	}

	// 2. Check registration window (using competition's timezone)
	const competitionTimezone = competition.timezone || DEFAULT_TIMEZONE
	if (
		!hasDateStartedInTimezone(
			competition.registrationOpensAt,
			competitionTimezone,
		)
	) {
		throw new Error("Registration has not opened yet")
	}
	if (
		isDeadlinePassedInTimezone(
			competition.registrationClosesAt,
			competitionTimezone,
		)
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

		// 7b. Check if team name is already taken for this competition (case-insensitive)
		const teamNameLower = params.teamName.trim().toLowerCase()
		const existingTeamWithName =
			await db.query.competitionRegistrationsTable.findFirst({
				where: and(
					eq(competitionRegistrationsTable.eventId, params.competitionId),
					sql`lower(${competitionRegistrationsTable.teamName}) = ${teamNameLower}`,
				),
			})

		if (existingTeamWithName) {
			throw new Error(
				`Team name "${params.teamName}" is already taken for this competition`,
			)
		}
	}

	// 8. Check for duplicate registration in the SAME division (as captain)
	// Users CAN register for multiple divisions in the same competition
	const existingRegistration =
		await db.query.competitionRegistrationsTable.findFirst({
			where: and(
				eq(competitionRegistrationsTable.eventId, params.competitionId),
				eq(competitionRegistrationsTable.userId, params.userId),
				eq(competitionRegistrationsTable.divisionId, params.divisionId),
			),
		})

	if (existingRegistration) {
		throw new Error(
			"You are already registered for this division in this competition",
		)
	}

	// 8b. Check if user is already on another team for this DIVISION (as teammate)
	// Users can be on different teams in different divisions
	const existingTeamMembership = await db
		.select({ teamId: teamMembershipTable.teamId })
		.from(teamMembershipTable)
		.innerJoin(teamTable, eq(teamMembershipTable.teamId, teamTable.id))
		.where(
			and(
				eq(teamMembershipTable.userId, params.userId),
				eq(teamMembershipTable.isActive, true),
				eq(teamTable.type, TEAM_TYPE_ENUM.COMPETITION_TEAM),
				sql`JSON_EXTRACT(${teamTable.competitionMetadata}, '$.competitionId') = ${params.competitionId}`,
				sql`JSON_EXTRACT(${teamTable.competitionMetadata}, '$.divisionId') = ${params.divisionId}`,
			),
		)
		.limit(1)

	if (existingTeamMembership.length > 0) {
		throw new Error("You are already on a team for this division")
	}

	// 8c. Check if user's email is in pendingTeammates of another registration in the SAME division
	if (user.email) {
		const pendingMatch = await db
			.select({ id: competitionRegistrationsTable.id })
			.from(competitionRegistrationsTable)
			.where(
				and(
					eq(competitionRegistrationsTable.eventId, params.competitionId),
					eq(competitionRegistrationsTable.divisionId, params.divisionId),
					sql`JSON_CONTAINS(${competitionRegistrationsTable.pendingTeammates}, JSON_OBJECT('email', ${user.email.toLowerCase()}))`,
				),
			)
			.limit(1)

		if (pendingMatch.length > 0) {
			throw new Error(
				"You have already been invited to another team for this division",
			)
		}
	}

	// 9. For team registrations, check teammates not already registered or on another team
	if (isTeamDivision && params.teammates) {
		const teammateEmails = params.teammates.map((t) => t.email.toLowerCase())

		// Check if any teammate email is the same as the registering user's email
		for (const teammate of params.teammates) {
			if (
				user.email &&
				teammate.email.toLowerCase() === user.email.toLowerCase()
			) {
				throw new Error(
					`${teammate.email} is your own email. Please enter a different teammate's email.`,
				)
			}
		}

		// Batch lookup: find all existing users matching teammate emails
		const teammateUsers = await db
			.select({ id: userTable.id, email: userTable.email })
			.from(userTable)
			.where(inArray(userTable.email, teammateEmails))

		if (teammateUsers.length > 0) {
			const teammateUserIds = teammateUsers.map((u) => u.id)
			const emailByUserId = new Map(teammateUsers.map((u) => [u.id, u.email]))

			// Batch check: are any of these users already registered as captains in this DIVISION?
			const existingRegs = await db
				.select({
					userId: competitionRegistrationsTable.userId,
				})
				.from(competitionRegistrationsTable)
				.where(
					and(
						eq(competitionRegistrationsTable.eventId, params.competitionId),
						eq(competitionRegistrationsTable.divisionId, params.divisionId),
						inArray(competitionRegistrationsTable.userId, teammateUserIds),
					),
				)

			if (existingRegs.length > 0) {
				const regEmail = emailByUserId.get(existingRegs[0].userId)
				throw new Error(
					`${regEmail} is already registered for this division`,
				)
			}

			// Batch check: are any of these users on a competition_team for this DIVISION?
			const existingCompTeamMemberships = await db
				.select({
					userId: teamMembershipTable.userId,
				})
				.from(teamMembershipTable)
				.innerJoin(teamTable, eq(teamMembershipTable.teamId, teamTable.id))
				.where(
					and(
						inArray(teamMembershipTable.userId, teammateUserIds),
						eq(teamMembershipTable.isActive, true),
						eq(teamTable.type, TEAM_TYPE_ENUM.COMPETITION_TEAM),
						sql`JSON_EXTRACT(${teamTable.competitionMetadata}, '$.competitionId') = ${params.competitionId}`,
						sql`JSON_EXTRACT(${teamTable.competitionMetadata}, '$.divisionId') = ${params.divisionId}`,
					),
				)
				.limit(1)

			if (existingCompTeamMemberships.length > 0) {
				const memberEmail = emailByUserId.get(
					existingCompTeamMemberships[0].userId,
				)
				throw new Error(
					`${memberEmail} is already on a team for this division`,
				)
			}
		}

		// Batch check: are any teammate emails in pendingTeammates of another registration in this DIVISION?
		for (const teammateEmail of teammateEmails) {
			const pendingMatch = await db
				.select({ id: competitionRegistrationsTable.id })
				.from(competitionRegistrationsTable)
				.where(
					and(
						eq(competitionRegistrationsTable.eventId, params.competitionId),
						eq(competitionRegistrationsTable.divisionId, params.divisionId),
						sql`JSON_CONTAINS(${competitionRegistrationsTable.pendingTeammates}, JSON_OBJECT('email', ${teammateEmail}))`,
					),
				)
				.limit(1)

			if (pendingMatch.length > 0) {
				const originalEmail = params.teammates.find(
					(t) => t.email.toLowerCase() === teammateEmail,
				)?.email
				throw new Error(
					`${originalEmail} has already been invited to another team for this division`,
				)
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
		const athleteTeamIdGenerated = createTeamId()
		await db.insert(teamTable).values({
			id: athleteTeamIdGenerated,
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

		athleteTeamId = athleteTeamIdGenerated

		// Add captain to athlete team with CAPTAIN role
		await db.insert(teamMembershipTable).values({
			teamId: athleteTeamId,
			userId: params.userId,
			roleId: SYSTEM_ROLES_ENUM.CAPTAIN,
			isSystemRole: true,
			joinedAt: new Date(),
			isActive: true,
		})
	}

	// 11. Create team_membership in competition_event team (if not already a member from another division)
	const existingEventMembership = await db.query.teamMembershipTable.findFirst({
		where: and(
			eq(teamMembershipTable.teamId, competition.competitionTeamId),
			eq(teamMembershipTable.userId, params.userId),
		),
	})

	const teamMemberId = existingEventMembership?.id ?? createTeamMembershipId()
	if (!existingEventMembership) {
		await db.insert(teamMembershipTable).values({
			id: teamMemberId,
			teamId: competition.competitionTeamId,
			userId: params.userId,
			roleId: SYSTEM_ROLES_ENUM.MEMBER,
			isSystemRole: true,
			joinedAt: new Date(),
			isActive: true,
		})
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
	const registrationId = createCompetitionRegistrationId()
	await db.insert(competitionRegistrationsTable).values({
		id: registrationId,
		eventId: params.competitionId,
		userId: params.userId,
		teamMemberId: teamMemberId,
		divisionId: params.divisionId,
		registeredAt: new Date(),
		// Team fields
		teamName: isTeamDivision ? params.teamName : null,
		captainUserId: params.userId,
		athleteTeamId,
		pendingTeammates: pendingTeammatesJson,
		metadata: metadataJson,
	})

	const registration = await db.query.competitionRegistrationsTable.findFirst({
		where: eq(competitionRegistrationsTable.id, registrationId),
	})
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
		teamMemberId,
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
	const {
		userId,
		registrationId,
		competitionId,
		isPaid,
		amountPaidCents,
		prefetched,
	} = params

	try {
		const db = getDb()

		// Use prefetched user or fetch from DB
		const user =
			prefetched?.user ??
			(await db.query.userTable.findFirst({
				where: eq(userTable.id, userId),
			}))

		if (!user?.email) {
			logError({
				message: "[Email] Cannot send registration confirmation - no email",
				attributes: { userId, registrationId },
			})
			return
		}

		// Use prefetched competition or fetch from DB
		const competition =
			prefetched?.competition ??
			(await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, competitionId),
			}))

		if (!competition) {
			logError({
				message:
					"[Email] Cannot send registration confirmation - no competition",
				attributes: { competitionId, registrationId },
			})
			return
		}

		// Use prefetched registration or fetch from DB
		const registration =
			prefetched?.registration ??
			(await db.query.competitionRegistrationsTable.findFirst({
				where: eq(competitionRegistrationsTable.id, registrationId),
			}))

		if (!registration) {
			logError({
				message:
					"[Email] Cannot send registration confirmation - no registration",
				attributes: { registrationId },
			})
			return
		}

		// Use prefetched division name or fetch from DB
		let divisionName = prefetched?.divisionName ?? "Open"
		if (!prefetched?.divisionName && registration.divisionId) {
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
// Competition Team Helpers
// ============================================================================

/**
 * Add a user to the competition_event team
 * Called when a teammate accepts an invitation to join a competition team
 */
export async function addToCompetitionEventTeam(
	userId: string,
	competitionId: string,
): Promise<void> {
	const db = getDb()

	// Get competition to find the competition_event team
	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	if (!competition?.competitionTeamId) {
		return // No competition_event team to add to
	}

	// Check if already a member of competition_event team
	const existingMembership = await db.query.teamMembershipTable.findFirst({
		where: and(
			eq(teamMembershipTable.teamId, competition.competitionTeamId),
			eq(teamMembershipTable.userId, userId),
		),
	})

	if (existingMembership) {
		return // Already a member
	}

	// Add to competition_event team as MEMBER
	await db.insert(teamMembershipTable).values({
		teamId: competition.competitionTeamId,
		userId,
		roleId: SYSTEM_ROLES_ENUM.MEMBER,
		isSystemRole: true,
		joinedAt: new Date(),
		isActive: true,
	})

	// Update user sessions to include the new team
	await updateAllSessionsOfUser(userId)
}
