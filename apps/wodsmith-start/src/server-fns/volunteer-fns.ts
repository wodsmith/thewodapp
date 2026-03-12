/**
 * Volunteer Management Server Functions for TanStack Start
 * Functions for managing competition volunteers and their permissions
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { TeamMembership, User } from "@/db/schema"
import {
	competitionHeatsTable,
	competitionsTable,
	entitlementTable,
	entitlementTypeTable,
	judgeHeatAssignmentsTable,
	SYSTEM_ROLES_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	trackWorkoutsTable,
	userTable,
	volunteerShiftAssignmentsTable,
	volunteerShiftsTable,
	workouts,
} from "@/db/schema"
import {
	createTeamId,
	createTeamInvitationId,
	createTeamMembershipId,
	createUserId,
} from "@/db/schemas/common"
import { volunteerRegistrationAnswersTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import { createEntitlement } from "@/server/entitlements"
import { inviteUserToTeam } from "@/server/team-members"
import { sendVolunteerDirectInviteEmail } from "@/utils/email"
import {
	calculateInviteStatus,
	isDirectInvite,
	isVolunteer,
} from "@/server/volunteers"
import {
	canSignUp,
	createAndStoreSession,
	getSessionFromCookie,
} from "@/utils/auth"
import { hashPassword } from "@/utils/password-hasher"

import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Constants
// ============================================================================

/** Entitlement type ID for competition score input access */
const SCORE_INPUT_TYPE_ID = "competition_score_input"

// ============================================================================
// Types
// ============================================================================

/** Membership with user relation included for volunteer queries */
export type TeamMembershipWithUser = TeamMembership & {
	user: User | null
}

/** Return type for direct volunteer invites */
export type DirectVolunteerInvite = {
	id: string
	token: string
	email: string
	name: string | null
	roleTypes: string[]
	status: "pending" | "accepted" | "expired"
	createdAt: Date
	expiresAt: Date | null
	acceptedAt: Date | null
}

// ============================================================================
// Input Schemas
// ============================================================================

const competitionTeamIdSchema = z
	.string()
	.startsWith("team_", "Invalid team ID")

const membershipOrInvitationIdSchema = z
	.string()
	.refine(
		(val) => val.startsWith("tmem_") || val.startsWith("tinv_"),
		"Invalid membership or invitation ID",
	)

const volunteerRoleTypeSchema = z.enum([
	"judge",
	"head_judge",
	"scorekeeper",
	"emcee",
	"floor_manager",
	"media",
	"general",
	"equipment",
	"medical",
	"check_in",
	"staff",
	"athlete_control",
	"equipment_team",
])

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get pending volunteer invitations (not yet accepted/converted to memberships)
 */
export const getPendingVolunteerInvitationsFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		return db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, data.competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, true),
				isNull(teamInvitationTable.acceptedAt),
			),
		})
	})

/**
 * Get all team members with volunteer role for a competition team
 */
export const getCompetitionVolunteersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		return db.query.teamMembershipTable.findMany({
			where: and(
				eq(teamMembershipTable.teamId, data.competitionTeamId),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamMembershipTable.isSystemRole, true),
			),
			with: {
				user: true,
			},
		}) as unknown as Promise<TeamMembershipWithUser[]>
	})

/**
 * Get direct volunteer invitations (admin-invited, not public applications)
 */
export const getDirectVolunteerInvitesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }): Promise<DirectVolunteerInvite[]> => {
		const db = getDb()

		// Get all volunteer invitations for this team
		const invitations = await db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, data.competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, true),
			),
		})

		// Filter to only direct invites (admin-initiated)
		const directInvites = invitations.filter((inv) => {
			try {
				const meta = JSON.parse(
					inv.metadata || "{}",
				) as VolunteerMembershipMetadata
				return isDirectInvite(meta, inv.invitedBy)
			} catch {
				return isDirectInvite(null, inv.invitedBy)
			}
		})

		// Map to return type with calculated status
		return directInvites
			.map((inv) => {
				let roleTypes: string[] = []
				let inviteName: string | null = null
				try {
					const meta = JSON.parse(
						inv.metadata || "{}",
					) as VolunteerMembershipMetadata & { inviteName?: string }
					roleTypes = meta.volunteerRoleTypes ?? []
					inviteName = meta.inviteName ?? null
				} catch {
					// Invalid metadata, leave roleTypes empty
				}

				return {
					id: inv.id,
					token: inv.token,
					email: inv.email,
					name: inviteName,
					roleTypes,
					status: calculateInviteStatus(inv.acceptedAt, inv.expiresAt),
					createdAt: inv.createdAt,
					expiresAt: inv.expiresAt,
					acceptedAt: inv.acceptedAt,
				}
			})
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
	})

/**
 * Check if a user can input scores for a competition team
 */
export const canInputScoresFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				userId: z.string(),
				competitionTeamId: competitionTeamIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const entitlements = await db.query.entitlementTable.findMany({
			where: and(
				eq(entitlementTable.userId, data.userId),
				eq(entitlementTable.teamId, data.competitionTeamId),
				eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
				isNull(entitlementTable.deletedAt),
				or(
					isNull(entitlementTable.expiresAt),
					gt(entitlementTable.expiresAt, new Date()),
				),
			),
		})
		return entitlements.length > 0
	})

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Submit public volunteer signup form
 * No authentication required - this is a public form for volunteer interest
 */
// ============================================================================
// Shared volunteer application helper
// ============================================================================

const volunteerApplicationSchema = z.object({
	competitionTeamId: competitionTeamIdSchema,
	signupName: z.string().min(1, "Name is required"),
	signupEmail: z.string().email("Invalid email address"),
	signupPhone: z.string().optional(),
	availability: z
		.enum([
			VOLUNTEER_AVAILABILITY.MORNING,
			VOLUNTEER_AVAILABILITY.AFTERNOON,
			VOLUNTEER_AVAILABILITY.ALL_DAY,
		])
		.default(VOLUNTEER_AVAILABILITY.ALL_DAY),
	availabilityNotes: z.string().optional(),
	credentials: z.string().optional(),
	answers: z
		.array(
			z.object({
				questionId: z.string().min(1),
				answer: z.string().max(5000),
			}),
		)
		.optional(),
})

type VolunteerApplicationInput = z.infer<typeof volunteerApplicationSchema>

/**
 * Creates a volunteer application (team invitation) and saves any question answers.
 * Throws if the email is already associated with a volunteer invitation or membership.
 */
async function createVolunteerApplication(
	data: VolunteerApplicationInput,
): Promise<{ membershipId: string }> {
	const db = getDb()

	// Check for duplicate email sign-up
	const existingInvitations = await db.query.teamInvitationTable.findMany({
		where: and(
			eq(teamInvitationTable.teamId, data.competitionTeamId),
			eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
			eq(teamInvitationTable.isSystemRole, true),
		),
	})

	for (const invitation of existingInvitations) {
		if (invitation.email.toLowerCase() === data.signupEmail.toLowerCase()) {
			throw new Error(
				"This email has already been used to sign up as a volunteer for this competition",
			)
		}
	}

	// Check for existing approved membership
	const existingUser = await db.query.userTable.findFirst({
		where: eq(userTable.email, data.signupEmail),
	})

	if (existingUser) {
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, data.competitionTeamId),
				eq(teamMembershipTable.userId, existingUser.id),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamMembershipTable.isSystemRole, true),
			),
		})
		if (existingMembership) {
			throw new Error(
				"An account with this email is already volunteering for this competition",
			)
		}
	}

	const metadata: VolunteerMembershipMetadata = {
		volunteerRoleTypes: [],
		credentials: data.credentials,
		availability: data.availability,
		status: "pending",
		inviteSource: "application",
		signupEmail: data.signupEmail,
		signupName: data.signupName,
		signupPhone: data.signupPhone,
		availabilityNotes: data.availabilityNotes,
	}

	const oneYearFromNow = new Date()
	oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

	const invitationId = createTeamInvitationId()
	await db.insert(teamInvitationTable).values({
		id: invitationId,
		teamId: data.competitionTeamId,
		email: data.signupEmail,
		roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
		isSystemRole: true,
		token: crypto.randomUUID(),
		invitedBy: null,
		expiresAt: oneYearFromNow,
		metadata: JSON.stringify(metadata),
	})

	const invitation = await db.query.teamInvitationTable.findFirst({
		where: eq(teamInvitationTable.id, invitationId),
	})

	if (!invitation) {
		throw new Error("Failed to create volunteer invitation")
	}

	if (data.answers && data.answers.length > 0) {
		for (const { questionId, answer } of data.answers) {
			await db.insert(volunteerRegistrationAnswersTable).values({
				questionId,
				invitationId: invitation.id,
				answer,
			})
		}
	}

	return { membershipId: invitation.id }
}

export const submitVolunteerSignupFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				...volunteerApplicationSchema.shape,
				website: z.string().optional(), // Honeypot
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		if (data.website && data.website.trim() !== "") {
			return { success: true }
		}
		const { membershipId } = await createVolunteerApplication(data)
		return { success: true, membershipId }
	})

/**
 * Creates an account and submits a volunteer application in a single server call.
 * Used by the public volunteer signup form when the user is not logged in.
 * Avoids a bad state from two separate client-side calls where the account
 * could be created but the application could fail.
 */
export const createAccountAndApplyAsVolunteerFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		z
			.object({
				// Account fields
				firstName: z.string().min(1, "First name is required"),
				lastName: z.string().min(1, "Last name is required"),
				password: z
					.string()
					.min(8, "Password must be at least 8 characters")
					.regex(/[A-Z]/, "Must contain an uppercase letter")
					.regex(/[a-z]/, "Must contain a lowercase letter")
					.regex(/[0-9]/, "Must contain a number"),
				// Volunteer application fields
				...volunteerApplicationSchema.shape,
				website: z.string().optional(), // Honeypot
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		// Honeypot check
		if (data.website && data.website.trim() !== "") {
			return { success: true }
		}

		const db = getDb()

		// Check if email is disposable or already fully claimed
		await canSignUp({ email: data.signupEmail })

		const existingUser = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.signupEmail),
		})

		const hashedPassword = await hashPassword({ password: data.password })

		let userId: string

		if (existingUser) {
			// Fully verified account — ask them to sign in instead
			if (existingUser.emailVerified && existingUser.passwordHash) {
				throw new Error(
					"An account with this email already exists. Please sign in to apply as a volunteer.",
				)
			}
			// Placeholder or unverified — upgrade with password and auto-verify
			userId = existingUser.id
			await db
				.update(userTable)
				.set({
					passwordHash: hashedPassword,
					firstName: data.firstName,
					lastName: data.lastName,
					emailVerified: new Date(),
				})
				.where(eq(userTable.id, existingUser.id))
		} else {
			// Brand-new user
			const newUserId = createUserId()
			const teamId = createTeamId()
			userId = newUserId

			await db.insert(userTable).values({
				id: newUserId,
				email: data.signupEmail,
				firstName: data.firstName,
				lastName: data.lastName,
				passwordHash: hashedPassword,
				emailVerified: new Date(),
			})

			// Create personal team
			await db.insert(teamTable).values({
				id: teamId,
				name: `${data.firstName}'s Team (personal)`,
				slug: `${data.firstName.toLowerCase()}-${newUserId.slice(-6)}`,
				description:
					"Personal team for individual programming track subscriptions",
				isPersonalTeam: true,
				personalTeamOwnerId: newUserId,
			})

			await db.insert(teamMembershipTable).values({
				teamId,
				userId: newUserId,
				roleId: "owner",
				isSystemRole: true,
				joinedAt: new Date(),
				isActive: true,
			})
		}

		// Submit the volunteer application first — if this fails, no session is
		// created and the user can safely retry without hitting "account exists"
		const { membershipId } = await createVolunteerApplication(data)

		// Log user in only after the application is successfully persisted
		await createAndStoreSession(userId, "password")

		return { success: true, membershipId }
	})

/**
 * Invite a volunteer to a competition (admin action)
 */
export const inviteVolunteerFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				name: z.string().optional(),
				email: z.string().email("Invalid email address"),
				competitionTeamId: competitionTeamIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleTypes: z
					.array(volunteerRoleTypeSchema)
					.min(1, "Select at least one role"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const metadata: {
			volunteerRoleTypes: typeof data.roleTypes
			inviteSource: "direct"
			inviteName?: string
			inviteEmail: string
		} = {
			volunteerRoleTypes: data.roleTypes,
			inviteSource: "direct" as const,
			inviteEmail: data.email,
		}

		// Store name if provided for display before user signs up
		if (data.name) {
			metadata.inviteName = data.name
		}

		const db = getDb()

		// Check for an existing volunteer invitation (application or prior direct invite)
		const existingInvitations = await db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, data.competitionTeamId),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamInvitationTable.isSystemRole, true),
			),
			columns: { email: true },
		})

		if (
			existingInvitations.some(
				(inv) => inv.email.toLowerCase() === data.email.toLowerCase(),
			)
		) {
			throw new Error(
				"This person has already been invited or has applied to volunteer for this competition.",
			)
		}

		// Check for an existing approved volunteer membership
		const existingUser = await db.query.userTable.findFirst({
			where: eq(userTable.email, data.email.toLowerCase()),
			columns: { id: true },
		})

		if (existingUser) {
			const existingMembership = await db.query.teamMembershipTable.findFirst({
				where: and(
					eq(teamMembershipTable.teamId, data.competitionTeamId),
					eq(teamMembershipTable.userId, existingUser.id),
					eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
					eq(teamMembershipTable.isSystemRole, true),
				),
			})
			if (existingMembership) {
				throw new Error(
					"This person is already a volunteer for this competition.",
				)
			}
		}

		// Look up competition name for the invite email
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
			columns: { name: true },
		})
		const competitionName = competition?.name ?? "a competition"

		await inviteUserToTeam({
			teamId: data.competitionTeamId,
			email: data.email,
			roleId: "volunteer",
			isSystemRole: true,
			metadata: JSON.stringify(metadata),
			skipPermissionCheck: true,
			// Always create an invitation even for existing users so they receive
			// an email and complete the acceptance form (volunteer questions)
			forceInvitation: true,
			emailOverrideFn: async ({ email, token, inviterName }) => {
				await sendVolunteerDirectInviteEmail({
					email,
					invitationToken: token,
					competitionName,
					inviterName,
				})
			},
		})

		return { success: true }
	})

/**
 * Add a volunteer role type to a membership
 */
export const addVolunteerRoleTypeFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipOrInvitationIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleType: volunteerRoleTypeSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const isInvitation = data.membershipId.startsWith("tinv_")

		if (isInvitation) {
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.id, data.membershipId),
			})

			if (!invitation) {
				throw new Error(`Invitation ${data.membershipId} not found`)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = invitation.metadata
					? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]

			await db
				.update(teamInvitationTable)
				.set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
				.where(eq(teamInvitationTable.id, data.membershipId))
		} else {
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, data.membershipId),
			})

			if (!membership) {
				throw new Error(`Membership ${data.membershipId} not found`)
			}

			if (!isVolunteer(membership)) {
				throw new Error(
					"Cannot add volunteer role type to non-volunteer membership",
				)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = membership.metadata
					? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]

			await db
				.update(teamMembershipTable)
				.set({ metadata: JSON.stringify(metadata) })
				.where(eq(teamMembershipTable.id, data.membershipId))
		}

		return { success: true }
	})

/**
 * Remove a volunteer role type from a membership
 */
export const removeVolunteerRoleTypeFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipOrInvitationIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleType: volunteerRoleTypeSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const isInvitation = data.membershipId.startsWith("tinv_")

		if (isInvitation) {
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.id, data.membershipId),
			})

			if (!invitation) {
				throw new Error(`Invitation ${data.membershipId} not found`)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = invitation.metadata
					? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (!currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = currentRoleTypes.filter(
				(r) => r !== data.roleType,
			)

			await db
				.update(teamInvitationTable)
				.set({ metadata: JSON.stringify(metadata), updatedAt: new Date() })
				.where(eq(teamInvitationTable.id, data.membershipId))
		} else {
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, data.membershipId),
			})

			if (!membership) {
				throw new Error(`Membership ${data.membershipId} not found`)
			}

			let metadata: VolunteerMembershipMetadata
			try {
				metadata = membership.metadata
					? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
					: { volunteerRoleTypes: [] }
			} catch {
				metadata = { volunteerRoleTypes: [] }
			}

			const currentRoleTypes = metadata.volunteerRoleTypes ?? []
			if (!currentRoleTypes.includes(data.roleType)) {
				return { success: true }
			}

			metadata.volunteerRoleTypes = currentRoleTypes.filter(
				(r) => r !== data.roleType,
			)

			await db
				.update(teamMembershipTable)
				.set({ metadata: JSON.stringify(metadata) })
				.where(eq(teamMembershipTable.id, data.membershipId))
		}

		return { success: true }
	})

/**
 * Grant score input access to a volunteer
 */
export const grantScoreAccessFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				volunteerId: z.string().min(1, "Volunteer ID is required"),
				competitionTeamId: competitionTeamIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				grantedBy: z.string().min(1, "Granter ID is required"),
				expiresAt: z.date().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		// Ensure the entitlement type exists (create if not)
		const existingType = await db.query.entitlementTypeTable.findFirst({
			where: eq(entitlementTypeTable.id, SCORE_INPUT_TYPE_ID),
		})

		if (!existingType) {
			await db.insert(entitlementTypeTable).values({
				id: SCORE_INPUT_TYPE_ID,
				name: "Competition Score Input",
				description:
					"Allows a volunteer to input scores for a competition event",
			})
		}

		// Check if volunteer already has score access
		const existingAccess = await db.query.entitlementTable.findFirst({
			where: and(
				eq(entitlementTable.userId, data.volunteerId),
				eq(entitlementTable.teamId, data.competitionTeamId),
				eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
				isNull(entitlementTable.deletedAt),
			),
		})

		if (
			existingAccess &&
			existingAccess.metadata?.competitionId === data.competitionId
		) {
			return { success: true }
		}

		await createEntitlement({
			userId: data.volunteerId,
			teamId: data.competitionTeamId,
			entitlementTypeId: SCORE_INPUT_TYPE_ID,
			sourceType: "MANUAL",
			sourceId: data.grantedBy,
			metadata: {
				competitionId: data.competitionId,
				grantedAt: new Date().toISOString(),
			},
			expiresAt: data.expiresAt,
		})

		return { success: true }
	})

/**
 * Revoke score input access from a user
 */
export const revokeScoreAccessFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				userId: z.string().min(1, "User ID is required"),
				competitionTeamId: competitionTeamIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		const entitlements = await db.query.entitlementTable.findMany({
			where: and(
				eq(entitlementTable.userId, data.userId),
				eq(entitlementTable.teamId, data.competitionTeamId),
				eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
				isNull(entitlementTable.deletedAt),
			),
		})

		if (entitlements.length === 0) {
			return { success: true }
		}

		const entitlementIds = entitlements.map((e) => e.id)

		await db
			.update(entitlementTable)
			.set({ deletedAt: new Date() })
			.where(inArray(entitlementTable.id, entitlementIds))

		return { success: true }
	})

/**
 * Update volunteer membership metadata
 */
export const updateVolunteerMetadataFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipOrInvitationIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				metadata: z.record(z.string(), z.unknown()),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("NOT_AUTHORIZED: You must be logged in")
		}

		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const isInvitation = data.membershipId.startsWith("tinv_")
		const newMetadata = data.metadata as Record<string, unknown>
		const isApprovingStatus = newMetadata.status === "approved"

		if (isInvitation) {
			const invitation = await db.query.teamInvitationTable.findFirst({
				where: eq(teamInvitationTable.id, data.membershipId),
			})

			if (!invitation) {
				throw new Error("NOT_FOUND: Invitation not found")
			}

			const currentMetadata = invitation.metadata
				? (JSON.parse(invitation.metadata) as Record<string, unknown>)
				: {}

			const wasApproved =
				currentMetadata.status !== "approved" && isApprovingStatus

			if (wasApproved) {
				// Handle approval - create membership if user exists
				const existingUser = await db.query.userTable.findFirst({
					where: eq(userTable.email, invitation.email),
				})

				const now = new Date()
				const updatedMetadata = { ...currentMetadata, ...newMetadata }

				await db
					.update(teamInvitationTable)
					.set({
						invitedBy: session.userId,
						metadata: JSON.stringify(updatedMetadata),
						updatedAt: now,
						acceptedAt: now,
						acceptedBy: existingUser?.id ?? null,
					})
					.where(eq(teamInvitationTable.id, data.membershipId))

				if (existingUser) {
					const existingMembership =
						await db.query.teamMembershipTable.findFirst({
							where: and(
								eq(teamMembershipTable.teamId, invitation.teamId),
								eq(teamMembershipTable.userId, existingUser.id),
								eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
								eq(teamMembershipTable.isSystemRole, true),
							),
						})

					if (!existingMembership) {
						await db.insert(teamMembershipTable).values({
							id: createTeamMembershipId(),
							teamId: invitation.teamId,
							userId: existingUser.id,
							roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
							isSystemRole: true,
							invitedBy: session.userId,
							invitedAt: now,
							joinedAt: now,
							isActive: true,
							metadata: JSON.stringify(updatedMetadata),
						})
					}
				}
			} else {
				const updatedMetadata = { ...currentMetadata, ...newMetadata }
				await db
					.update(teamInvitationTable)
					.set({
						metadata: JSON.stringify(updatedMetadata),
						updatedAt: new Date(),
					})
					.where(eq(teamInvitationTable.id, data.membershipId))
			}
		} else {
			const membership = await db.query.teamMembershipTable.findFirst({
				where: eq(teamMembershipTable.id, data.membershipId),
			})

			if (!membership) {
				throw new Error("NOT_FOUND: Membership not found")
			}

			const currentMetadata = membership.metadata
				? (JSON.parse(membership.metadata) as Record<string, unknown>)
				: {}
			const updatedMetadata = { ...currentMetadata, ...newMetadata }

			await db
				.update(teamMembershipTable)
				.set({
					metadata: JSON.stringify(updatedMetadata),
					updatedAt: new Date(),
				})
				.where(eq(teamMembershipTable.id, data.membershipId))
		}

		return { success: true }
	})

/**
 * Bulk assign a role type to multiple volunteers
 */
export const bulkAssignVolunteerRoleFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipIds: z
					.array(membershipOrInvitationIdSchema)
					.min(1, "Select at least one volunteer"),
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				roleType: volunteerRoleTypeSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		const results = await Promise.allSettled(
			data.membershipIds.map(async (membershipId) => {
				const isInvitation = membershipId.startsWith("tinv_")

				if (isInvitation) {
					const invitation = await db.query.teamInvitationTable.findFirst({
						where: eq(teamInvitationTable.id, membershipId),
					})
					if (!invitation) return

					let metadata: VolunteerMembershipMetadata
					try {
						metadata = invitation.metadata
							? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
							: { volunteerRoleTypes: [] }
					} catch {
						metadata = { volunteerRoleTypes: [] }
					}

					const currentRoleTypes = metadata.volunteerRoleTypes ?? []
					if (!currentRoleTypes.includes(data.roleType)) {
						metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]
						await db
							.update(teamInvitationTable)
							.set({
								metadata: JSON.stringify(metadata),
								updatedAt: new Date(),
							})
							.where(eq(teamInvitationTable.id, membershipId))
					}
				} else {
					const membership = await db.query.teamMembershipTable.findFirst({
						where: eq(teamMembershipTable.id, membershipId),
					})
					if (!membership || !isVolunteer(membership)) return

					let metadata: VolunteerMembershipMetadata
					try {
						metadata = membership.metadata
							? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
							: { volunteerRoleTypes: [] }
					} catch {
						metadata = { volunteerRoleTypes: [] }
					}

					const currentRoleTypes = metadata.volunteerRoleTypes ?? []
					if (!currentRoleTypes.includes(data.roleType)) {
						metadata.volunteerRoleTypes = [...currentRoleTypes, data.roleType]
						await db
							.update(teamMembershipTable)
							.set({ metadata: JSON.stringify(metadata) })
							.where(eq(teamMembershipTable.id, membershipId))
					}
				}
			}),
		)

		const succeeded = results.filter((r) => r.status === "fulfilled").length
		const failed = results.filter((r) => r.status === "rejected").length

		return { success: true, succeeded, failed }
	})

/**
 * Get all volunteer assignments (shifts and judge heats) for a competition
 * Returns a map of membershipId -> { shifts: [...], judgeHeats: [...] }
 */
export const getVolunteerAssignmentsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get all shift IDs for this competition
		const shifts = await db.query.volunteerShiftsTable.findMany({
			where: eq(volunteerShiftsTable.competitionId, data.competitionId),
			columns: { id: true },
		})
		const shiftIds = shifts.map((s) => s.id)

		// Get all heat IDs for this competition
		const heats = await db.query.competitionHeatsTable.findMany({
			where: eq(competitionHeatsTable.competitionId, data.competitionId),
		})
		const heatIds = heats.map((h) => h.id)

		// Build a map of heatId -> heat details for later lookup
		const heatDetailsMap = new Map(
			heats.map((h) => [
				h.id,
				{
					heatNumber: h.heatNumber,
					trackWorkoutId: h.trackWorkoutId,
					scheduledTime: h.scheduledTime,
				},
			]),
		)

		// Get track workout details for event names
		const trackWorkoutIds = [...new Set(heats.map((h) => h.trackWorkoutId))]
		const trackWorkoutsData =
			trackWorkoutIds.length > 0
				? await db
						.select({
							id: trackWorkoutsTable.id,
							workoutName: workouts.name,
						})
						.from(trackWorkoutsTable)
						.innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
						.where(inArray(trackWorkoutsTable.id, trackWorkoutIds))
				: []

		// Build a map of trackWorkoutId -> event name
		const eventNameMap = new Map(
			trackWorkoutsData.map((tw) => [tw.id, tw.workoutName]),
		)

		// Query shift assignments with shift details
		const shiftAssignments =
			shiftIds.length > 0
				? await db.query.volunteerShiftAssignmentsTable.findMany({
						where: inArray(volunteerShiftAssignmentsTable.shiftId, shiftIds),
						with: {
							shift: true,
						},
					})
				: []

		// Query judge heat assignments
		const judgeAssignments =
			heatIds.length > 0
				? await db.query.judgeHeatAssignmentsTable.findMany({
						where: inArray(judgeHeatAssignmentsTable.heatId, heatIds),
					})
				: []

		// Build the map: membershipId -> assignments
		const assignmentMap: Record<
			string,
			{
				shifts: Array<{
					id: string
					shiftId: string
					name: string
					roleType: string
					startTime: Date
					endTime: Date
					location: string | null
					notes: string | null
				}>
				judgeHeats: Array<{
					id: string
					heatId: string
					eventName: string
					heatNumber: number
					scheduledTime: Date | null
					laneNumber: number | null
					position: string | null
				}>
			}
		> = {}

		// Process shift assignments
		for (const assignment of shiftAssignments) {
			if (!assignmentMap[assignment.membershipId]) {
				assignmentMap[assignment.membershipId] = { shifts: [], judgeHeats: [] }
			}
			assignmentMap[assignment.membershipId].shifts.push({
				id: assignment.id,
				shiftId: assignment.shiftId,
				name: assignment.shift.name,
				roleType: assignment.shift.roleType,
				startTime: assignment.shift.startTime,
				endTime: assignment.shift.endTime,
				location: assignment.shift.location,
				notes: assignment.shift.notes,
			})
		}

		// Process judge heat assignments
		for (const assignment of judgeAssignments) {
			const heatDetails = heatDetailsMap.get(assignment.heatId)
			if (!heatDetails) continue

			const eventName =
				eventNameMap.get(heatDetails.trackWorkoutId) || "Unknown Event"

			if (!assignmentMap[assignment.membershipId]) {
				assignmentMap[assignment.membershipId] = { shifts: [], judgeHeats: [] }
			}
			assignmentMap[assignment.membershipId].judgeHeats.push({
				id: assignment.id,
				heatId: assignment.heatId,
				eventName,
				heatNumber: heatDetails.heatNumber,
				scheduledTime: heatDetails.scheduledTime,
				laneNumber: assignment.laneNumber,
				position: assignment.position,
			})
		}

		return assignmentMap
	})
