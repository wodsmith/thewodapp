import { ZSAError } from "@repo/zsa"
import { requireVerifiedEmail } from "./auth"

// Get the current user's teams
export async function getUserTeams() {
	const session = await requireVerifiedEmail()

	if (!session) {
		return []
	}

	return session.teams || []
}

// Get the current user's team IDs
export async function getUserTeamIds(userId: string) {
	const session = await requireVerifiedEmail()

	if (!session || session.userId !== userId) {
		return []
	}

	return session.teams?.map((team) => team.id) || []
}

// Check if the user is a member of a specific team
export async function isTeamMember(teamId: string) {
	const session = await requireVerifiedEmail()

	if (!session) {
		return false
	}

	return session.teams?.some((team) => team.id === teamId) || false
}

// Check if the user has team membership and return both access status and session
// This function doesn't throw exceptions, making it easier to use in pages
export async function hasTeamMembership(teamId: string) {
	const session = await requireVerifiedEmail()

	if (!session) {
		return { hasAccess: false }
	}

	const isMember = session.teams?.some((team) => team.id === teamId) || false

	return {
		hasAccess: isMember,
		session: isMember ? session : undefined,
	}
}

// Check if the user has a specific role in a team
export async function hasTeamRole(
	teamId: string,
	roleId: string,
	isSystemRole = false,
) {
	const session = await requireVerifiedEmail()

	if (!session) {
		return false
	}

	const team = session.teams?.find((t) => t.id === teamId)

	if (!team) {
		return false
	}

	if (isSystemRole) {
		return team.role.isSystemRole && team.role.id === roleId
	}

	return !team.role.isSystemRole && team.role.id === roleId
}

// Check if the user has any system role in a team
export async function hasSystemRole(teamId: string, role: string) {
	return hasTeamRole(teamId, role, true)
}

// Check if the user has a specific permission in a team
export async function hasTeamPermission(
	teamId: string,
	permission: string,
) {
	const session = await requireVerifiedEmail()

	if (!session) {
		return false
	}

	const team = session.teams?.find((t) => t.id === teamId)

	if (!team) {
		return false
	}

	// Check if the permission is in the user's permissions for this team
	return team.permissions.includes(permission)
}

// Require team membership (throws if not a member)
export async function requireTeamMembership(teamId: string) {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const isMember = await isTeamMember(teamId)

	if (!isMember) {
		throw new ZSAError("FORBIDDEN", "You are not a member of this team")
	}

	return session
}

// Require team role (throws if doesn't have role)
export async function requireTeamRole(
	teamId: string,
	roleId: string,
	isSystemRole = false,
) {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const hasRole = await hasTeamRole(teamId, roleId, isSystemRole)

	if (!hasRole) {
		throw new ZSAError(
			"FORBIDDEN",
			"You don't have the required role in this team",
		)
	}

	return session
}

// Require system role (throws if doesn't have system role)
export async function requireSystemRole(teamId: string, role: string) {
	return requireTeamRole(teamId, role, true)
}

// Require team permission (throws if doesn't have permission)
export async function requireTeamPermission(
	teamId: string,
	permission: string,
) {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const hasPermission = await hasTeamPermission(teamId, permission)

	if (!hasPermission) {
		throw new ZSAError(
			"FORBIDDEN",
			"You don't have the required permission in this team",
		)
	}

	return session
}

// ========================================
// Competition Platform Helpers
// ========================================

/**
 * Check if a team can host competitions
 * Uses the entitlements system to check for HOST_COMPETITIONS feature
 *
 * @param teamId - The team ID to check
 * @returns boolean - true if team has competition hosting access
 */
export async function canHostCompetitions(
	teamId: string,
): Promise<boolean> {
	try {
		// Import dynamically to avoid circular dependencies
		const { hasFeature } = await import("@/server/entitlements")
		const { FEATURES } = await import("@/config/features")

		return await hasFeature(teamId, FEATURES.HOST_COMPETITIONS)
	} catch {
		return false
	}
}

/**
 * Require that a team has competition hosting access
 * Throws ZSAError if team cannot host competitions
 *
 * @param teamId - The team ID to check
 * @returns Session - The current session if authorized
 * @throws ZSAError if team doesn't have competition hosting feature
 */
export async function requireCompetitionHostingAccess(teamId: string) {
	const session = await requireTeamMembership(teamId)
	const canHost = await canHostCompetitions(teamId)

	if (!canHost) {
		throw new ZSAError(
			"FORBIDDEN",
			"This team does not have access to host competitions. Please upgrade your plan.",
		)
	}

	return session
}

/**
 * Check if a team is a competition event team
 *
 * @param teamId - The team ID to check
 * @returns boolean - true if team type is 'competition_event'
 */
export async function isCompetitionEventTeam(
	teamId: string,
): Promise<boolean> {
	const { getDb } = await import("@/db")
	const { teamTable } = await import("@/db/schema")
	const { eq } = await import("drizzle-orm")

	const db = getDb()
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
		columns: { type: true },
	})

	return team?.type === "competition_event"
}

/**
 * Get the parent organization ID for a competition event team
 *
 * @param competitionTeamId - The competition event team ID
 * @returns string | null - The parent organization ID or null if not a competition event team
 */
export async function getParentOrganizationId(
	competitionTeamId: string,
): Promise<string | null> {
	const { getDb } = await import("@/db")
	const { teamTable } = await import("@/db/schema")
	const { eq } = await import("drizzle-orm")

	const db = getDb()
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, competitionTeamId),
		columns: { parentOrganizationId: true, type: true },
	})

	if (team?.type !== "competition_event") {
		return null
	}

	return team.parentOrganizationId || null
}
