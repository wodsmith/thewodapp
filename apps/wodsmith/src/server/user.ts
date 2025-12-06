import "server-only"

import { and, eq } from "drizzle-orm"
import { ZSAError } from "@repo/zsa"
import { getDefaultProgrammingTracks } from "@/config/programming-tracks"
import { getDb } from "@/db"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"
import type { User } from "@/db/schema"
import {
	programmingTracksTable,
	teamMembershipTable,
	teamProgrammingTracksTable,
	teamTable,
	userTable,
} from "@/db/schema"

/**
 * Creates a personal team for a user upon account creation
 * @param user - The user object returned from user creation
 * @returns Promise<{ teamId: string }> - The created team's ID
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
		.returning()
	const personalTeam = personalTeamResult[0]

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
			logInfo({
				message: "[user] Auto-subscribed personal team to tracks",
				attributes: {
					personalTeamId: personalTeam.id,
					tracks: existingTracks.length,
				},
			})
		} else {
			logWarning({
				message:
					"[user] Default programming tracks not found. Skipping auto-subscription.",
			})
		}
	} catch (error) {
		// Log error but don't fail the user creation
		logError({
			message: "[user] Failed to auto-subscribe to programming tracks",
			error,
		})
	}

	return { teamId: personalTeam.id }
}

/**
 * Get a user's personal team ID
 * @param userId - The user's ID
 * @returns Promise<string> - The personal team's ID
 */
export async function getUserPersonalTeamId(userId: string): Promise<string> {
	const db = getDb()

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

/**
 * Get user's primary gym affiliation
 * Returns the first active GYM type team (not competition_event or personal teams)
 * @param userId - The user's ID
 * @returns Promise<{ id: string; name: string; type: string } | null> - The gym team or null
 */
export async function getUserGymAffiliation(userId: string) {
	const db = getDb()

	const membership = await db
		.select({
			id: teamTable.id,
			name: teamTable.name,
			type: teamTable.type,
		})
		.from(teamMembershipTable)
		.innerJoin(teamTable, eq(teamMembershipTable.teamId, teamTable.id))
		.where(
			and(
				eq(teamMembershipTable.userId, userId),
				eq(teamMembershipTable.isActive, 1),
				eq(teamTable.type, "gym"),
			),
		)
		.limit(1)

	return membership[0] ?? null
}

/**
 * Get user's notable metcon workout results (Fran, Grace, Helen, Diane, Murph)
 * @param userId - The user's ID
 * @returns Promise<Array> - Array of workout results with workout details
 */
export async function getUserNotableMetconResults(userId: string) {
	const db = getDb()
	const { results, workouts } = await import("@/db/schema")
	const { inArray } = await import("drizzle-orm")

	const notableMetconNames = ["Fran", "Grace", "Helen", "Diane", "Murph"]

	// Query results joined with workouts, filtering for notable metcons only
	const workoutResults = await db
		.select({
			workoutId: workouts.id,
			workoutName: workouts.name,
			wodScore: results.wodScore,
			asRx: results.asRx,
			date: results.date,
		})
		.from(results)
		.innerJoin(workouts, eq(results.workoutId, workouts.id))
		.where(
			and(
				eq(results.userId, userId),
				eq(results.type, "wod"),
				inArray(workouts.name, notableMetconNames),
			),
		)
		.orderBy(results.date)

	// Get the best result for each metcon (fastest time)
	const metconResults = new Map()

	for (const result of workoutResults) {
		const workoutName = result.workoutName

		// Only keep the best (fastest) result for each metcon
		if (
			!metconResults.has(workoutName) ||
			(result.wodScore &&
				result.wodScore < metconResults.get(workoutName).wodScore)
		) {
			metconResults.set(workoutName, result)
		}
	}

	return Array.from(metconResults.values())
}

/**
 * Check if an email address already has an account
 */
export async function checkEmailExists(email: string): Promise<boolean> {
	const db = getDb()

	const user = await db.query.userTable.findFirst({
		where: eq(userTable.email, email.toLowerCase()),
		columns: { id: true },
	})

	return !!user
}
