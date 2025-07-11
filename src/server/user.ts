import "server-only"

import { and, eq } from "drizzle-orm"
import { ZSAError } from "zsa"
import { getDd } from "@/db"
import type { User } from "@/db/schema"
import { teamMembershipTable, teamTable } from "@/db/schema"

/**
 * Creates a personal team for a user upon account creation
 * @param user - The user object returned from user creation
 * @returns Promise<{ teamId: string }> - The created team's ID
 */
export async function createPersonalTeamForUser(
	user: User,
): Promise<{ teamId: string }> {
	const db = getDd()

	// Create a personal team for the user
	const personalTeamName = `${user.firstName || "Personal"}'s Team (personal)`
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

/**
 * Get a user's personal team ID
 * @param userId - The user's ID
 * @returns Promise<string> - The personal team's ID
 */
export async function getUserPersonalTeamId(userId: string): Promise<string> {
	const db = getDd()

	const personalTeam = await db.query.teamTable.findFirst({
		where: and(
			eq(teamTable.personalTeamOwnerId, userId),
			eq(teamTable.isPersonalTeam, 1),
		),
		columns: { id: true },
	})

	if (!personalTeam) {
		throw new ZSAError("NOT_FOUND", "Personal team not found for user")
	}

	return personalTeam.id
}
