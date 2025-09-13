import "server-only"
import { eq, and, inArray } from "drizzle-orm"
import { getDd } from "@/db"
import {
	programmingTracksTable,
	teamProgrammingTracksTable,
	type ProgrammingTrack,
} from "@/db/schemas/programming"
import { teamTable } from "@/db/schemas/teams"

/**
 * Enhanced programming track type that includes subscription information for multiple teams
 */
export interface ProgrammingTrackWithTeamSubscriptions
	extends ProgrammingTrack {
	ownerTeam: {
		id: string
		name: string
	} | null
	subscribedTeams: {
		teamId: string
		teamName: string
		subscribedAt: Date
		isActive: boolean
	}[]
}

/**
 * Get all public programming tracks with subscription status for all user's teams
 */
export async function getPublicTracksWithTeamSubscriptions(
	userTeamIds: string[],
): Promise<ProgrammingTrackWithTeamSubscriptions[]> {
	console.info("INFO: Fetching public tracks with team subscriptions", {
		teamCount: userTeamIds.length,
	})

	const db = getDd()

	// Get all public tracks
	const publicTracks = await db
		.select({
			id: programmingTracksTable.id,
			name: programmingTracksTable.name,
			description: programmingTracksTable.description,
			type: programmingTracksTable.type,
			ownerTeamId: programmingTracksTable.ownerTeamId,
			isPublic: programmingTracksTable.isPublic,
			createdAt: programmingTracksTable.createdAt,
			updatedAt: programmingTracksTable.updatedAt,
			updateCounter: programmingTracksTable.updateCounter,
			ownerTeamName: teamTable.name,
		})
		.from(programmingTracksTable)
		.leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
		.where(eq(programmingTracksTable.isPublic, 1))

	// Get all subscriptions for user's teams
	const subscriptions =
		userTeamIds.length > 0
			? await db
					.select({
						trackId: teamProgrammingTracksTable.trackId,
						teamId: teamProgrammingTracksTable.teamId,
						teamName: teamTable.name,
						subscribedAt: teamProgrammingTracksTable.subscribedAt,
						isActive: teamProgrammingTracksTable.isActive,
					})
					.from(teamProgrammingTracksTable)
					.innerJoin(
						teamTable,
						eq(teamProgrammingTracksTable.teamId, teamTable.id),
					)
					.where(
						and(
							inArray(teamProgrammingTracksTable.teamId, userTeamIds),
							eq(teamProgrammingTracksTable.isActive, 1),
						),
					)
			: []

	// Create a map of track subscriptions grouped by trackId
	const subscriptionsByTrack = new Map<
		string,
		{
			teamId: string
			teamName: string
			subscribedAt: Date
			isActive: boolean
		}[]
	>()

	for (const sub of subscriptions) {
		if (!subscriptionsByTrack.has(sub.trackId)) {
			subscriptionsByTrack.set(sub.trackId, [])
		}
		subscriptionsByTrack.get(sub.trackId)!.push({
			teamId: sub.teamId,
			teamName: sub.teamName,
			subscribedAt: sub.subscribedAt,
			isActive: sub.isActive === 1,
		})
	}

	// Combine tracks with their subscription data
	return publicTracks.map((track) => ({
		...track,
		ownerTeam: track.ownerTeamId
			? {
					id: track.ownerTeamId,
					name: track.ownerTeamName || "Unknown",
				}
			: null,
		subscribedTeams: subscriptionsByTrack.get(track.id) || [],
	}))
}

/**
 * Get programming tracks for a specific team with subscription status
 */
export async function getTeamSpecificProgrammingTracks(teamId: string): Promise<
	{
		track: ProgrammingTrack & {
			ownerTeam: { id: string; name: string } | null
		}
		isSubscribed: boolean
		subscribedAt: Date | null
	}[]
> {
	const db = getDd()

	// Get all public tracks
	const publicTracks = await db
		.select({
			track: programmingTracksTable,
			ownerTeamName: teamTable.name,
		})
		.from(programmingTracksTable)
		.leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
		.where(eq(programmingTracksTable.isPublic, 1))

	// Get team's subscriptions
	const teamSubscriptions = await db
		.select({
			trackId: teamProgrammingTracksTable.trackId,
			subscribedAt: teamProgrammingTracksTable.subscribedAt,
		})
		.from(teamProgrammingTracksTable)
		.where(
			and(
				eq(teamProgrammingTracksTable.teamId, teamId),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)

	const subscriptionMap = new Map(
		teamSubscriptions.map((sub) => [sub.trackId, sub.subscribedAt]),
	)

	return publicTracks.map(({ track, ownerTeamName }) => ({
		track: {
			...track,
			ownerTeam: track.ownerTeamId
				? {
						id: track.ownerTeamId,
						name: ownerTeamName || "Unknown",
					}
				: null,
		},
		isSubscribed: subscriptionMap.has(track.id),
		subscribedAt: subscriptionMap.get(track.id) || null,
	}))
}

/**
 * Check which teams are subscribed to a specific track
 */
export async function getTrackSubscribedTeams(
	trackId: string,
	userTeamIds: string[],
): Promise<
	{
		teamId: string
		teamName: string
		subscribedAt: Date
	}[]
> {
	if (userTeamIds.length === 0) {
		return []
	}

	const db = getDd()
	const subscriptions = await db
		.select({
			teamId: teamProgrammingTracksTable.teamId,
			teamName: teamTable.name,
			subscribedAt: teamProgrammingTracksTable.subscribedAt,
		})
		.from(teamProgrammingTracksTable)
		.innerJoin(teamTable, eq(teamProgrammingTracksTable.teamId, teamTable.id))
		.where(
			and(
				eq(teamProgrammingTracksTable.trackId, trackId),
				inArray(teamProgrammingTracksTable.teamId, userTeamIds),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)

	return subscriptions
}

/**
 * Get all subscribed tracks grouped by team
 */
export async function getSubscriptionsByTeam(userTeamIds: string[]): Promise<
	Map<
		string,
		{
			teamId: string
			teamName: string
			tracks: {
				trackId: string
				trackName: string
				trackDescription: string | null
				subscribedAt: Date
			}[]
		}
	>
> {
	if (userTeamIds.length === 0) {
		return new Map()
	}

	const db = getDd()
	const subscriptions = await db
		.select({
			teamId: teamProgrammingTracksTable.teamId,
			teamName: teamTable.name,
			trackId: programmingTracksTable.id,
			trackName: programmingTracksTable.name,
			trackDescription: programmingTracksTable.description,
			subscribedAt: teamProgrammingTracksTable.subscribedAt,
		})
		.from(teamProgrammingTracksTable)
		.innerJoin(
			programmingTracksTable,
			eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
		)
		.innerJoin(teamTable, eq(teamProgrammingTracksTable.teamId, teamTable.id))
		.where(
			and(
				inArray(teamProgrammingTracksTable.teamId, userTeamIds),
				eq(teamProgrammingTracksTable.isActive, 1),
			),
		)
		.orderBy(teamTable.name, programmingTracksTable.name)

	const result = new Map<
		string,
		{
			teamId: string
			teamName: string
			tracks: {
				trackId: string
				trackName: string
				trackDescription: string | null
				subscribedAt: Date
			}[]
		}
	>()

	for (const sub of subscriptions) {
		if (!result.has(sub.teamId)) {
			result.set(sub.teamId, {
				teamId: sub.teamId,
				teamName: sub.teamName,
				tracks: [],
			})
		}
		result.get(sub.teamId)!.tracks.push({
			trackId: sub.trackId,
			trackName: sub.trackName,
			trackDescription: sub.trackDescription,
			subscribedAt: sub.subscribedAt,
		})
	}

	return result
}
