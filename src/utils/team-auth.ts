import "server-only"
import { cache } from "react"
import { ZSAError } from "zsa"
import { requireVerifiedEmail } from "./auth"

// Get the current user's teams
export const getUserTeams = cache(async () => {
	const session = await requireVerifiedEmail()

	if (!session) {
		return []
	}

	return session.teams || []
})

// Check if the user is a member of a specific team
export const isTeamMember = cache(async (teamId: string) => {
	const session = await requireVerifiedEmail()

	if (!session) {
		return false
	}

	return session.teams?.some((team) => team.id === teamId) || false
})

// Check if the user has team membership and return both access status and session
// This function doesn't throw exceptions, making it easier to use in pages
export const hasTeamMembership = cache(async (teamId: string) => {
	const session = await requireVerifiedEmail()

	if (!session) {
		return { hasAccess: false }
	}

	const isMember = session.teams?.some((team) => team.id === teamId) || false

	return {
		hasAccess: isMember,
		session: isMember ? session : undefined,
	}
})

// Check if the user has a specific role in a team
export const hasTeamRole = cache(
	async (teamId: string, roleId: string, isSystemRole = false) => {
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
	},
)

// Check if the user has any system role in a team
export const hasSystemRole = cache(async (teamId: string, role: string) => {
	return hasTeamRole(teamId, role, true)
})

// Check if the user has a specific permission in a team
export const hasTeamPermission = cache(
	async (teamId: string, permission: string) => {
		const session = await requireVerifiedEmail()

		if (!session) {
			console.log("DEBUG: [TeamAuth] No session found for permission check")
			return false
		}

		console.log(
			`DEBUG: [TeamAuth] Checking permission '${permission}' for teamId '${teamId}'`,
		)
		console.log(
			`DEBUG: [TeamAuth] User has ${session.teams?.length || 0} teams`,
		)

		const team = session.teams?.find((t) => t.id === teamId)

		if (!team) {
			console.log(
				`DEBUG: [TeamAuth] Team '${teamId}' not found in user's session teams`,
			)
			console.log(
				"DEBUG: [TeamAuth] Available teams:",
				session.teams?.map((t) => ({ id: t.id, name: t.name, role: t.role })),
			)
			return false
		}

		console.log(
			`DEBUG: [TeamAuth] Found team '${team.name}' with role '${team.role.name}' (${team.role.isSystemRole ? "system" : "custom"})`,
		)
		console.log("DEBUG: [TeamAuth] Team permissions:", team.permissions)

		// Check if the permission is in the user's permissions for this team
		const hasPermission = team.permissions.includes(permission)
		console.log(
			`DEBUG: [TeamAuth] Has permission '${permission}': ${hasPermission}`,
		)

		return hasPermission
	},
)

// Require team membership (throws if not a member)
export const requireTeamMembership = cache(async (teamId: string) => {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const isMember = await isTeamMember(teamId)

	if (!isMember) {
		throw new ZSAError("FORBIDDEN", "You are not a member of this team")
	}

	return session
})

// Require team role (throws if doesn't have role)
export const requireTeamRole = cache(
	async (teamId: string, roleId: string, isSystemRole = false) => {
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
	},
)

// Require system role (throws if doesn't have system role)
export const requireSystemRole = cache(async (teamId: string, role: string) => {
	return requireTeamRole(teamId, role, true)
})

// Require team permission (throws if doesn't have permission)
export const requireTeamPermission = cache(
	async (teamId: string, permission: string) => {
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
	},
)
