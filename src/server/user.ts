import "server-only"

import { and, eq } from "drizzle-orm"
import { ZSAError } from "zsa"
import { getDefaultProgrammingTracks } from "@/config/programming-tracks"
import { getDd } from "@/db"
import type { User } from "@/db/schema"
import {
	programmingTracksTable,
	teamMembershipTable,
	teamProgrammingTracksTable,
	teamTable,
} from "@/db/schema"

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

	// Auto-subscribe to default programming tracks (Girls and Heroes)
	try {
		const defaultTracks = getDefaultProgrammingTracks()
		const trackIds = [
			defaultTracks.girls,
			defaultTracks.heroes,
			defaultTracks.open,
		]

		// Verify that the tracks exist before subscribing
		const existingTracks = await db.query.programmingTracksTable.findMany({
			where: (_tracks, { inArray }) =>
				inArray(programmingTracksTable.id, trackIds),
			columns: { id: true },
		})

		if (existingTracks.length > 0) {
			// Subscribe to the tracks that exist
			const subscriptions = existingTracks.map((track) => ({
				teamId: personalTeam.id,
				trackId: track.id,
				isActive: 1,
				subscribedAt: new Date(),
				startDayOffset: 0,
			}))

			await db.insert(teamProgrammingTracksTable).values(subscriptions)
			console.log(
				`Auto-subscribed personal team ${personalTeam.id} to ${existingTracks.length} programming tracks`,
			)
		} else {
			console.warn(
				"Default programming tracks not found. Skipping auto-subscription.",
			)
		}
	} catch (error) {
		// Log error but don't fail the user creation
		console.error("Failed to auto-subscribe to programming tracks:", error)
	}

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
