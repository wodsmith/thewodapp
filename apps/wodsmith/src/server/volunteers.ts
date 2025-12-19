/**
 * Volunteer Management Server Functions
 * Helper functions for managing competition volunteers and their permissions
 */
import "server-only"

import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>

import type { TeamInvitation, TeamMembership, User } from "@/db/schema"
import {
	entitlementTable,
	SYSTEM_ROLES_ENUM,
	teamInvitationTable,
	teamMembershipTable,
	userTable,
} from "@/db/schema"

/** Membership with user relation included for volunteer queries */
export type TeamMembershipWithUser = TeamMembership & {
	user: User | null
}

import type {
	VolunteerMembershipMetadata,
	VolunteerRoleType,
} from "@/db/schemas/volunteers"
import { autochunk } from "@/utils/batch-query"
import { createEntitlement } from "./entitlements"

// ============================================================================
// VOLUNTEER ROLE TYPE HELPERS
// ============================================================================

/**
 * Parse volunteerRoleTypes from membership metadata
 * Returns empty array if no metadata or no volunteer roles
 */
export function getVolunteerRoleTypes(
	membership: TeamMembership,
): VolunteerRoleType[] {
	if (!membership.metadata) return []

	try {
		const metadata = JSON.parse(
			membership.metadata,
		) as VolunteerMembershipMetadata
		return metadata.volunteerRoleTypes ?? []
	} catch {
		return []
	}
}

/**
 * Check if a membership has the volunteer role
 */
export function isVolunteer(membership: TeamMembership): boolean {
	return (
		membership.roleId === SYSTEM_ROLES_ENUM.VOLUNTEER &&
		membership.isSystemRole === 1
	)
}

/**
 * Check if a membership has a specific volunteer role type
 */
export function hasRoleType(
	membership: TeamMembership,
	roleType: VolunteerRoleType,
): boolean {
	const roleTypes = getVolunteerRoleTypes(membership)
	return roleTypes.includes(roleType)
}

// ============================================================================
// VOLUNTEER QUERIES
// ============================================================================

/**
 * Get pending volunteer invitations (not yet accepted/converted to memberships)
 */
export async function getPendingVolunteerInvitations(
	db: Db,
	competitionTeamId: string,
): Promise<TeamInvitation[]> {
	return db.query.teamInvitationTable.findMany({
		where: and(
			eq(teamInvitationTable.teamId, competitionTeamId),
			eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
			eq(teamInvitationTable.isSystemRole, 1),
			isNull(teamInvitationTable.acceptedAt),
		),
	})
}

/**
 * Get pending volunteer invitations for a specific email (for athlete profile page)
 * Filters to only invitations with status "pending" in metadata
 */
export async function getPendingVolunteerInvitationsForEmail(
	db: Db,
	email: string,
): Promise<TeamInvitation[]> {
	const invitations = await db.query.teamInvitationTable.findMany({
		where: and(
			eq(teamInvitationTable.email, email.toLowerCase()),
			eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
			eq(teamInvitationTable.isSystemRole, 1),
			isNull(teamInvitationTable.acceptedAt),
		),
	})

	// Filter to only pending status
	return invitations.filter((inv) => {
		try {
			const meta = JSON.parse(
				inv.metadata || "{}",
			) as VolunteerMembershipMetadata
			return meta.status === "pending"
		} catch {
			return false
		}
	})
}

/**
 * Get active volunteer memberships for a user (for athlete profile page)
 * Returns memberships with status "approved" in metadata
 */
export async function getUserVolunteerMemberships(
	db: Db,
	userId: string,
): Promise<TeamMembershipWithUser[]> {
	const memberships = (await db.query.teamMembershipTable.findMany({
		where: and(
			eq(teamMembershipTable.userId, userId),
			eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
			eq(teamMembershipTable.isSystemRole, 1),
			eq(teamMembershipTable.isActive, 1),
		),
		with: {
			user: true,
		},
	})) as unknown as TeamMembershipWithUser[]

	// Filter to only approved status
	return memberships.filter((membership) => {
		try {
			const meta = JSON.parse(
				membership.metadata || "{}",
			) as VolunteerMembershipMetadata
			return meta.status === "approved"
		} catch {
			return false
		}
	})
}

/**
 * Get all team members with volunteer role for a competition team
 */
export async function getCompetitionVolunteers(
	db: Db,
	competitionTeamId: string,
): Promise<TeamMembershipWithUser[]> {
	// Note: We don't filter by isActive here because volunteer approval
	// is tracked via metadata.status ("pending" | "approved" | "rejected").
	// Public signups create memberships with isActive: 0, and the admin
	// UI shows pending/approved tabs based on metadata.status.
	return db.query.teamMembershipTable.findMany({
		where: and(
			eq(teamMembershipTable.teamId, competitionTeamId),
			eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
			eq(teamMembershipTable.isSystemRole, 1),
		),
		with: {
			user: true,
		},
	}) as unknown as Promise<TeamMembershipWithUser[]>
}

/**
 * Get volunteers filtered by specific role type (judge, head_judge, etc.)
 * Uses sql-batching for safe inArray queries
 */
export async function getVolunteersByRoleType(
	db: Db,
	competitionTeamId: string,
	roleType: VolunteerRoleType,
) {
	// First get all volunteers for this competition
	const allVolunteers = await getCompetitionVolunteers(db, competitionTeamId)

	// Filter by role type using metadata
	const matchingVolunteers = allVolunteers.filter((membership) =>
		hasRoleType(membership, roleType),
	)

	// If we need to query by IDs in the future, use autochunk
	// Example:
	// const membershipIds = matchingVolunteers.map(v => v.id)
	// const results = await autochunk(
	//   { items: membershipIds, otherParametersCount: 1 },
	//   async (chunk) => db.query.somethingTable.findMany({
	//     where: inArray(somethingTable.membershipId, chunk)
	//   })
	// )

	return matchingVolunteers
}

// ============================================================================
// VOLUNTEER ROLE TYPE MANAGEMENT
// ============================================================================

/**
 * Add a volunteer role type to a membership's metadata
 * Idempotent - won't duplicate if already exists
 */
export async function addVolunteerRoleType(
	db: Db,
	membershipId: string,
	roleType: VolunteerRoleType,
): Promise<void> {
	const membership = await db.query.teamMembershipTable.findFirst({
		where: eq(teamMembershipTable.id, membershipId),
	})

	if (!membership) {
		throw new Error(`Membership ${membershipId} not found`)
	}

	// Ensure this is a volunteer membership
	if (!isVolunteer(membership)) {
		throw new Error(
			"Cannot add volunteer role type to non-volunteer membership",
		)
	}

	// Get current role types
	const currentRoleTypes = getVolunteerRoleTypes(membership)

	// If already has this role type, nothing to do
	if (currentRoleTypes.includes(roleType)) {
		return
	}

	// Parse existing metadata or create new
	let metadata: VolunteerMembershipMetadata
	try {
		metadata = membership.metadata
			? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
			: { volunteerRoleTypes: [] }
	} catch {
		metadata = { volunteerRoleTypes: [] }
	}

	// Add new role type
	metadata.volunteerRoleTypes = [...currentRoleTypes, roleType]

	// Update membership
	await db
		.update(teamMembershipTable)
		.set({ metadata: JSON.stringify(metadata) })
		.where(eq(teamMembershipTable.id, membershipId))
}

/**
 * Remove a volunteer role type from a membership's metadata
 */
export async function removeVolunteerRoleType(
	db: Db,
	membershipId: string,
	roleType: VolunteerRoleType,
): Promise<void> {
	const membership = await db.query.teamMembershipTable.findFirst({
		where: eq(teamMembershipTable.id, membershipId),
	})

	if (!membership) {
		throw new Error(`Membership ${membershipId} not found`)
	}

	const currentRoleTypes = getVolunteerRoleTypes(membership)

	// If doesn't have this role type, nothing to do
	if (!currentRoleTypes.includes(roleType)) {
		return
	}

	// Parse existing metadata
	let metadata: VolunteerMembershipMetadata
	try {
		metadata = membership.metadata
			? (JSON.parse(membership.metadata) as VolunteerMembershipMetadata)
			: { volunteerRoleTypes: [] }
	} catch {
		metadata = { volunteerRoleTypes: [] }
	}

	// Remove role type
	metadata.volunteerRoleTypes = currentRoleTypes.filter((r) => r !== roleType)

	// Update membership
	await db
		.update(teamMembershipTable)
		.set({ metadata: JSON.stringify(metadata) })
		.where(eq(teamMembershipTable.id, membershipId))
}

// ============================================================================
// SCORE INPUT PERMISSIONS (using entitlements system)
// ============================================================================

const SCORE_INPUT_ENTITLEMENT_TYPE = "competition_score_input"

/**
 * Grant temporary score input access to a volunteer
 * Uses the existing entitlements system for fine-grained access control
 */
export async function grantScoreAccess({
	db,
	volunteerId,
	competitionTeamId,
	competitionId,
	grantedBy,
	expiresAt,
}: {
	db: Db
	volunteerId: string // userId of the volunteer
	competitionTeamId: string
	competitionId: string
	grantedBy: string // userId of the person granting access
	expiresAt?: Date
}): Promise<void> {
	// Check if volunteer already has score access for this competition
	const existingAccess = await db.query.entitlementTable.findFirst({
		where: and(
			eq(entitlementTable.userId, volunteerId),
			eq(entitlementTable.teamId, competitionTeamId),
			eq(entitlementTable.entitlementTypeId, SCORE_INPUT_ENTITLEMENT_TYPE),
			isNull(entitlementTable.deletedAt),
		),
	})

	// If already has access and it's for this competition, don't duplicate
	if (
		existingAccess &&
		existingAccess.metadata?.competitionId === competitionId
	) {
		return
	}

	// Create new entitlement for score input
	await createEntitlement({
		userId: volunteerId,
		teamId: competitionTeamId,
		entitlementTypeId: SCORE_INPUT_ENTITLEMENT_TYPE,
		sourceType: "MANUAL",
		sourceId: grantedBy,
		metadata: {
			competitionId,
			grantedAt: new Date().toISOString(),
		},
		expiresAt,
	})
}

/**
 * Check if a user can input scores for a competition team
 * Checks both volunteer membership and score input entitlement
 */
export async function canInputScores(
	db: Db,
	userId: string,
	competitionTeamId: string,
): Promise<boolean> {
	// Check if user has active score input entitlement
	const entitlements = await db.query.entitlementTable.findMany({
		where: and(
			eq(entitlementTable.userId, userId),
			eq(entitlementTable.teamId, competitionTeamId),
			eq(entitlementTable.entitlementTypeId, SCORE_INPUT_ENTITLEMENT_TYPE),
			isNull(entitlementTable.deletedAt),
			or(
				isNull(entitlementTable.expiresAt),
				gt(entitlementTable.expiresAt, new Date()),
			),
		),
	})

	return entitlements.length > 0
}

/**
 * Revoke score input access for a user in a competition team
 * Soft deletes the entitlement to maintain audit trail
 */
export async function revokeScoreAccess(
	db: Db,
	userId: string,
	competitionTeamId: string,
): Promise<void> {
	// Find all active score input entitlements for this user/team
	const entitlements = await db.query.entitlementTable.findMany({
		where: and(
			eq(entitlementTable.userId, userId),
			eq(entitlementTable.teamId, competitionTeamId),
			eq(entitlementTable.entitlementTypeId, SCORE_INPUT_ENTITLEMENT_TYPE),
			isNull(entitlementTable.deletedAt),
		),
	})

	if (entitlements.length === 0) {
		return
	}

	// Use autochunk for safe batch deletion in case many entitlements
	const entitlementIds = entitlements.map((e) => e.id)

	await autochunk({ items: entitlementIds }, async (chunk) => {
		await db
			.update(entitlementTable)
			.set({ deletedAt: new Date() })
			.where(inArray(entitlementTable.id, chunk))

		return [] // autochunk expects array return
	})

	// Invalidate user's sessions to refresh permissions
	const { invalidateUserSessions } = await import("@/utils/kv-session")
	await invalidateUserSessions(userId)
}

// ============================================================================
// VOLUNTEER APPROVAL
// ============================================================================

/**
 * Approve a volunteer invitation and optionally create membership if user exists
 *
 * @param db - Database instance
 * @param invitationId - ID of the team invitation to approve
 * @param approverId - User ID of the admin approving the volunteer
 * @returns The updated invitation
 * @throws Error if invitation not found or not a volunteer invitation
 */
export async function approveVolunteerInvitation({
	db,
	invitationId,
	approverId,
}: {
	db: Db
	invitationId: string
	approverId: string
}): Promise<TeamInvitation> {
	// Fetch the invitation
	const invitation = await db.query.teamInvitationTable.findFirst({
		where: eq(teamInvitationTable.id, invitationId),
	})

	if (!invitation) {
		throw new Error("Invitation not found")
	}

	// Verify this is a volunteer invitation
	if (
		invitation.roleId !== SYSTEM_ROLES_ENUM.VOLUNTEER ||
		invitation.isSystemRole !== 1
	) {
		throw new Error("This is not a volunteer invitation")
	}

	// Parse current metadata
	let metadata: VolunteerMembershipMetadata
	try {
		metadata = invitation.metadata
			? (JSON.parse(invitation.metadata) as VolunteerMembershipMetadata)
			: { volunteerRoleTypes: [] }
	} catch {
		metadata = { volunteerRoleTypes: [] }
	}

	// Update metadata status to approved
	metadata.status = "approved"

	// Update invitation with approved status and set invitedBy
	await db
		.update(teamInvitationTable)
		.set({
			invitedBy: approverId,
			metadata: JSON.stringify(metadata),
			updatedAt: new Date(),
		})
		.where(eq(teamInvitationTable.id, invitationId))

	// Check if user exists with this email
	const existingUser = await db.query.userTable.findFirst({
		where: eq(userTable.email, invitation.email),
	})

	// If user exists, create the team membership immediately
	if (existingUser) {
		// Check if membership doesn't already exist
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, invitation.teamId),
				eq(teamMembershipTable.userId, existingUser.id),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamMembershipTable.isSystemRole, 1),
			),
		})

		if (!existingMembership) {
			// Create active membership
			await db.insert(teamMembershipTable).values({
				teamId: invitation.teamId,
				userId: existingUser.id,
				roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
				isSystemRole: 1,
				invitedBy: approverId,
				invitedAt: new Date(),
				joinedAt: new Date(),
				isActive: 1,
				metadata: JSON.stringify(metadata),
			})
		}
	}
	// If user doesn't exist, they'll get the membership when they sign up
	// (handled by task 4 - auto-associate approved invitations)

	// Return updated invitation
	const updatedInvitation = await db.query.teamInvitationTable.findFirst({
		where: eq(teamInvitationTable.id, invitationId),
	})

	if (!updatedInvitation) {
		throw new Error("Failed to retrieve updated invitation")
	}

	return updatedInvitation
}

// ============================================================================
// PUBLIC VOLUNTEER SIGN-UP
// ============================================================================

/**
 * Create a pending volunteer sign-up from the public form
 * Creates a team invitation that can be approved later by competition admin
 *
 * @throws Error if email is already signed up as a volunteer for this competition
 */
export async function createVolunteerSignup({
	db,
	competitionTeamId,
	signupName,
	signupEmail,
	signupPhone,
	availabilityNotes,
	credentials,
}: {
	db: Db
	competitionTeamId: string
	signupName: string
	signupEmail: string
	signupPhone?: string
	availabilityNotes?: string
	credentials?: string
}): Promise<TeamInvitation> {
	// Check for duplicate email sign-up
	// Look for existing volunteer invitations with this email
	const existingInvitations = await db.query.teamInvitationTable.findMany({
		where: and(
			eq(teamInvitationTable.teamId, competitionTeamId),
			eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
			eq(teamInvitationTable.isSystemRole, 1),
		),
	})

	// Check for matching email (case-insensitive)
	for (const invitation of existingInvitations) {
		if (invitation.email.toLowerCase() === signupEmail.toLowerCase()) {
			throw new Error(
				"This email has already been used to sign up as a volunteer for this competition",
			)
		}
	}

	// Also check if there's already an accepted membership with this email
	// (user might have signed up and been approved already)
	const existingUser = await db.query.userTable.findFirst({
		where: eq(userTable.email, signupEmail),
	})

	if (existingUser) {
		const existingMembership = await db.query.teamMembershipTable.findFirst({
			where: and(
				eq(teamMembershipTable.teamId, competitionTeamId),
				eq(teamMembershipTable.userId, existingUser.id),
				eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
				eq(teamMembershipTable.isSystemRole, 1),
			),
		})

		if (existingMembership) {
			throw new Error(
				"An account with this email is already volunteering for this competition",
			)
		}
	}

	// Create volunteer signup metadata
	const metadata: VolunteerMembershipMetadata = {
		volunteerRoleTypes: [], // Admin will assign roles after approval
		credentials,
		status: "pending",
		signupEmail,
		signupName,
		signupPhone,
		availabilityNotes,
	}

	// Create team invitation for volunteer signup
	// These invitations don't expire like regular invites - they're pending until approved/rejected
	const oneYearFromNow = new Date()
	oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

	const newInvitation = await db
		.insert(teamInvitationTable)
		.values({
			teamId: competitionTeamId,
			email: signupEmail,
			roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
			isSystemRole: 1,
			token: crypto.randomUUID(),
			invitedBy: null, // Will be set on approval by admin
			expiresAt: oneYearFromNow,
			metadata: JSON.stringify(metadata),
		})
		.returning()

	const invitation = newInvitation[0]
	if (!invitation) {
		throw new Error("Failed to create volunteer invitation")
	}

	return invitation
}
