import { getDb } from "~/db/index.server"
import { teamTable, type User } from "~/db/schema.server"

/**
 * Create a personal team for a new user.
 * This is called during signup or when a user first signs in via OAuth.
 *
 * @param user - The user object with id, firstName, etc.
 * @returns The created team ID
 */
export async function createPersonalTeamForUser(
	user: User,
): Promise<{ teamId: string }> {
	const db = getDb()

	// Create a personal team for the user
	const personalTeamName = `${user.firstName || "Personal"}'s Team (personal)`
	const personalTeamSlug = `${
		user.firstName?.toLowerCase() || "personal"
	}-${user.id.slice(-6)}`

	const personalTeamResult = await db
		.insert(teamTable)
		.values({
			name: personalTeamName,
			slug: personalTeamSlug,
			description:
				"Personal team for individual programming track subscriptions",
			isPersonalTeam: 1,
			personalTeamOwnerId: user.id,
		})
		.returning({ id: teamTable.id })

	if (!personalTeamResult[0]) {
		throw new Error("Failed to create personal team")
	}

	return {
		teamId: personalTeamResult[0].id,
	}
}

/**
 * Get a user's personal team ID.
 * Returns the personal team for the given user.
 *
 * @param userId - The user's ID
 * @returns The personal team ID
 */
export async function getUserPersonalTeamId(userId: string): Promise<string> {
	const db = getDb()

	const personalTeam = await db.query.teamTable.findFirst({
		where: (table, { eq, and }) =>
			and(eq(table.personalTeamOwnerId, userId), eq(table.isPersonalTeam, 1)),
		columns: { id: true },
	})

	if (!personalTeam) {
		throw new Error("Personal team not found")
	}

	return personalTeam.id
}
