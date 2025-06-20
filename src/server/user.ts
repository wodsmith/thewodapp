import "server-only"

import { getDB } from "@/db"
import { teamMembershipTable, teamTable } from "@/db/schema"
import type { User } from "@/db/schema"
import { ZSAError } from "zsa"

/**
 * Creates a personal team for a user upon account creation
 * @param user - The user object returned from user creation
 * @returns Promise<{ teamId: string }> - The created team's ID
 */
export async function createPersonalTeamForUser(
	user: User,
): Promise<{ teamId: string }> {
	const db = getDB()

	// Create a personal team for the user
	const personalTeamName = `${user.firstName || "Personal"}'s Team`
	const personalTeamSlug = `${user.firstName?.toLowerCase() || "personal"}-${user.id.slice(-6)}`

	const [personalTeam] = await db
		.insert(teamTable)
		.values({
			name: personalTeamName,
			slug: personalTeamSlug,
			description:
				"Personal team for individual programming track subscriptions",
			isPersonalTeam: 1,
			personalTeamOwnerId: user.id,
		})
		.returning()

	if (!personalTeam) {
		throw new ZSAError(
			"INTERNAL_SERVER_ERROR",
			"Failed to create personal team",
		)
	}

	// Add the user as a member of their personal team
	await db.insert(teamMembershipTable).values({
		teamId: personalTeam.id,
		userId: user.id,
		roleId: "owner", // System role for team owner
		isSystemRole: 1,
		joinedAt: new Date(),
		isActive: 1,
	})

	return { teamId: personalTeam.id }
}
