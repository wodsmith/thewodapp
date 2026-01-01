/**
 * Team Authorization Utilities for TanStack Start
 * Port from apps/wodsmith/src/utils/team-auth.ts
 *
 * IMPORTANT: This file uses dynamic imports for cookie operations
 * to avoid bundling @tanstack/react-start/server into client bundles.
 * See tanstack-start-boundaries skill for details.
 */

import { ROLES_ENUM } from "@/db/schema"
import { getSessionFromCookie } from "./auth"

/**
 * Get the active team ID from cookie or fallback to first team
 *
 * Priority:
 * 1. Cookie value (if user is still a member of that team)
 * 2. First team in session (fallback)
 * 3. null (if no teams)
 *
 * This handles stale cookies gracefully - if the cookie contains
 * a team ID the user is no longer a member of, we fall back to
 * the first available team.
 *
 * @returns The active team ID or null if no teams available
 */
export async function getActiveTeamId(): Promise<string | null> {
	// Dynamic import to avoid bundling server code into client
	const { getCookie } = await import("@tanstack/react-start/server")
	const { ACTIVE_TEAM_COOKIE_NAME } = await import("@/constants")

	const session = await getSessionFromCookie()

	// No session means no teams
	if (!session) {
		return null
	}

	const teams = session.teams ?? []

	// No teams in session
	if (teams.length === 0) {
		return null
	}

	// Try to get team ID from cookie
	const cookieTeamId = getCookie(ACTIVE_TEAM_COOKIE_NAME)

	if (cookieTeamId) {
		// Validate that the cookie team is still valid (user is a member)
		const isValidTeam = teams.some((team) => team.id === cookieTeamId)

		if (isValidTeam) {
			return cookieTeamId
		}
		// Cookie is stale - fall through to first team fallback
	}

	// Fallback to first team
	return teams[0]?.id ?? null
}

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
