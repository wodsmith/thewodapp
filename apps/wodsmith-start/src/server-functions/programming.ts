import { createServerFn } from "@tanstack/react-start/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "~/db/index.server"
import {
	programmingTracksTable,
	teamProgrammingTracksTable,
} from "~/db/schemas/programming"
import { TEAM_PERMISSIONS, teamTable } from "~/db/schemas/teams"
import { getSessionFromCookie } from "~/utils/auth.server"
import { requireTeamPermission } from "~/utils/team-auth.server"

// Subscribe to track schema
const subscribeToTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
})

// Unsubscribe from track schema
const unsubscribeFromTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
})

// Get team subscriptions schema
const getTeamSubscriptionsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

// Set default track schema
const setDefaultTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackId: z.string().min(1, "Track ID is required"),
})

export const subscribeToTrackFn = createServerFn({ method: "POST" })
	.validator(subscribeToTrackSchema)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new Error("Not authenticated")
			}

			await requireTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			console.info(
				`INFO: Track subscription UI action initiated for track: ${data.trackId} by team: ${data.teamId}`,
			)

			const db = getDb()

			const track = await db
				.select()
				.from(programmingTracksTable)
				.where(eq(programmingTracksTable.id, data.trackId))
				.get()

			if (!track) {
				throw new Error("Programming track not found")
			}

			if (!track.isPublic) {
				throw new Error("Cannot subscribe to private track")
			}

			if (track.ownerTeamId === data.teamId) {
				throw new Error("Cannot subscribe to your own team's track")
			}

			const existing = await db
				.select()
				.from(teamProgrammingTracksTable)
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, data.teamId),
						eq(teamProgrammingTracksTable.trackId, data.trackId),
					),
				)
				.get()

			if (existing) {
				if (existing.isActive) {
					throw new Error("Already subscribed to this track")
				}

				await db
					.update(teamProgrammingTracksTable)
					.set({
						isActive: 1,
						subscribedAt: new Date(),
					})
					.where(
						and(
							eq(teamProgrammingTracksTable.teamId, data.teamId),
							eq(teamProgrammingTracksTable.trackId, data.trackId),
						),
					)
			} else {
				await db.insert(teamProgrammingTracksTable).values({
					teamId: data.teamId,
					trackId: data.trackId,
					isActive: 1,
				})
			}

			return { success: true }
		} catch (error) {
			console.error(
				`ERROR: Unauthorized subscription attempt - User lacks MANAGE_PROGRAMMING permission for team ${data.teamId}`,
			)
			throw error
		}
	})

export const unsubscribeFromTrackFn = createServerFn({ method: "POST" })
	.validator(unsubscribeFromTrackSchema)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new Error("Not authenticated")
			}

			await requireTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const db = getDb()

			const _result = await db
				.update(teamProgrammingTracksTable)
				.set({ isActive: 0 })
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, data.teamId),
						eq(teamProgrammingTracksTable.trackId, data.trackId),
					),
				)

			return { success: true }
		} catch (error) {
			console.error("Failed to unsubscribe from track:", error)
			throw error
		}
	})

export const getTeamSubscriptionsFn = createServerFn({ method: "POST" })
	.validator(getTeamSubscriptionsSchema)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new Error("Not authenticated")
			}

			await requireTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const db = getDb()

			const subscriptions = await db
				.select({
					id: programmingTracksTable.id,
					name: programmingTracksTable.name,
					description: programmingTracksTable.description,
					type: programmingTracksTable.type,
					ownerTeam: {
						id: teamTable.id,
						name: teamTable.name,
					},
					subscribedAt: teamProgrammingTracksTable.subscribedAt,
					isActive: teamProgrammingTracksTable.isActive,
				})
				.from(teamProgrammingTracksTable)
				.innerJoin(
					programmingTracksTable,
					eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
				)
				.leftJoin(
					teamTable,
					eq(programmingTracksTable.ownerTeamId, teamTable.id),
				)
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, data.teamId),
						eq(teamProgrammingTracksTable.isActive, 1),
					),
				)

			return { success: true, data: subscriptions }
		} catch (error) {
			console.error("Failed to get team subscriptions:", error)
			throw error
		}
	})

export const setDefaultTrackFn = createServerFn({ method: "POST" })
	.validator(setDefaultTrackSchema)
	.handler(async ({ data }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new Error("Not authenticated")
			}

			await requireTeamPermission(
				data.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const db = getDb()

			const subscription = await db
				.select()
				.from(teamProgrammingTracksTable)
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, data.teamId),
						eq(teamProgrammingTracksTable.trackId, data.trackId),
						eq(teamProgrammingTracksTable.isActive, 1),
					),
				)
				.get()

			if (!subscription) {
				throw new Error("Team is not subscribed to this track")
			}

			await db
				.update(teamTable)
				.set({ defaultTrackId: data.trackId })
				.where(eq(teamTable.id, data.teamId))

			console.info(
				`INFO: Default track updated for team ${data.teamId} to track ${data.trackId}`,
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to set default track:", error)
			throw error
		}
	})
