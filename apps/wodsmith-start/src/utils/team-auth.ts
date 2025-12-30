/**
 * Team Authorization Utilities for TanStack Start
 * Port from apps/wodsmith/src/utils/team-auth.ts
 */

import { ROLES_ENUM } from "@/db/schema"
import { getSessionFromCookie } from "./auth"

/**
 * Check if the user has a specific permission in a team
 */
export async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()

	if (!session) {
		return false
	}

	const team = session.teams?.find((t) => t.id === teamId)

	if (!team) {
		return false
	}

	return team.permissions.includes(permission)
}

/**
 * Require team permission (throws if doesn't have permission)
 */
export async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("NOT_AUTHORIZED: Not authenticated")
	}

	const hasPermission = await hasTeamPermission(teamId, permission)

	if (!hasPermission) {
		throw new Error(
			"FORBIDDEN: You don't have the required permission in this team",
		)
	}
}

/**
 * Check if the user is a member of a specific team
 */
export async function isTeamMember(teamId: string): Promise<boolean> {
	const session = await getSessionFromCookie()

	if (!session) {
		return false
	}

	return session.teams?.some((team) => team.id === teamId) || false
}

/**
 * Require team membership (throws if not a member)
 */
export async function requireTeamMembership(teamId: string): Promise<void> {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("NOT_AUTHORIZED: Not authenticated")
	}

	const isMember = await isTeamMember(teamId)

	if (!isMember) {
		throw new Error("FORBIDDEN: You are not a member of this team")
	}
}

/**
 * Require team permission OR site admin role
 * Allows admins to bypass team-based authorization
 *
 * @param teamId - The team ID to check permissions for
 * @param permission - The permission required (bypassed for site admins)
 * @returns Promise<void> - Resolves if authorized
 * @throws Error if not authenticated or lacks both permission and admin role
 */
export async function requireTeamPermissionOrAdmin(
	teamId: string,
	permission: string,
): Promise<void> {
	const session = await getSessionFromCookie()

	if (!session) {
		throw new Error("NOT_AUTHORIZED: Not authenticated")
	}

	// Admin bypass - site admins can access any team's resources
	if (session.user.role === ROLES_ENUM.ADMIN) {
		return
	}

	// Normal team permission check
	const hasPermission = await hasTeamPermission(teamId, permission)

	if (!hasPermission) {
		throw new Error(
			"FORBIDDEN: You don't have the required permission in this team",
		)
	}
}
