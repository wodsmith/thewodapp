import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if current user is a site admin
 */
export async function isSiteAdmin(): Promise<boolean> {
	const session = await getSessionFromCookie()
	return session?.user?.role === ROLES_ENUM.ADMIN
}

/**
 * Check if user has permission for a team (or is a site admin)
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	// Site admins have all permissions
	if (session.user?.role === ROLES_ENUM.ADMIN) return true

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 * Site admins bypass this check
 */
export async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}
/**
 * Require team membership (any role)
 * Site admins bypass this check
 */
export async function requireTeamMembership(teamId: string): Promise<void> {
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		throw new Error("Not authenticated")
	}

	// Site admins bypass membership check
	if (session.user?.role === ROLES_ENUM.ADMIN) {
		return
	}

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) {
		throw new Error("Not a member of this team")
	}
}
