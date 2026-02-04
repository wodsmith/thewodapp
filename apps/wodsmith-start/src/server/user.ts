/**
 * User Service Stub for TanStack Start PoC
 * This is a minimal implementation for auth flow testing.
 * Full implementation will be migrated from wodsmith app.
 */

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { teamMembershipTable, teamTable } from "@/db/schema"

/**
 * Get user's personal team ID
 */
export async function getUserPersonalTeamId(userId: string): Promise<string> {
	const db = getDb()

	const personalTeam = await db.query.teamTable.findFirst({
		where: and(
			eq(teamTable.isPersonalTeam, true),
			eq(teamTable.personalTeamOwnerId, userId),
		),
	})

	if (!personalTeam) {
		throw new Error("Personal team not found for user")
	}

	return personalTeam.id
}

/**
 * Create a personal team for a user
 * Note: This is now inlined in sign-up.tsx for the PoC
 * This function is kept for compatibility with other code paths
 */
export async function createPersonalTeamForUser(user: {
	id: string
	firstName: string | null
	lastName: string | null
	email: string
}): Promise<{ teamId: string }> {
	const db = getDb()

	const personalTeamName = `${user.firstName || "Personal"}'s Team (personal)`
	const personalTeamSlug = `${
		user.firstName?.toLowerCase() || "personal"
	}-${user.id.slice(-6)}`

	// Generate team ID for use in membership insert
	const { createTeamId } = await import("@/db/schemas/common")
	const teamId = createTeamId()

	await db.insert(teamTable).values({
		id: teamId,
		name: personalTeamName,
		slug: personalTeamSlug,
		description:
			"Personal team for individual programming track subscriptions",
		isPersonalTeam: true,
		personalTeamOwnerId: user.id,
	})

	// Add the user as a member of their personal team
	await db.insert(teamMembershipTable).values({
		teamId,
		userId: user.id,
		roleId: "owner",
		isSystemRole: true,
		joinedAt: new Date(),
		isActive: true,
	})

	return { teamId }
}
