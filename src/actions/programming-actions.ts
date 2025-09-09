"use server"

import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getDd } from "@/db"
import {
	teamProgrammingTracksTable,
	programmingTracksTable,
} from "@/db/schemas/programming"
import { teamTable } from "@/db/schemas/teams"
import { eq, and } from "drizzle-orm"

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

export const subscribeToTrackAction = createServerAction()
	.input(subscribeToTrackSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has programming management permission for the team
			await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			console.info(
				`INFO: Track subscription UI action initiated for track: ${input.trackId} by team: ${input.teamId}`,
			)

			const db = getDd()

			// Check if track exists and is public
			const track = await db
				.select()
				.from(programmingTracksTable)
				.where(eq(programmingTracksTable.id, input.trackId))
				.get()

			if (!track) {
				throw new ZSAError("NOT_FOUND", "Programming track not found")
			}

			if (!track.isPublic) {
				throw new ZSAError("FORBIDDEN", "Cannot subscribe to private track")
			}

			// Prevent teams from subscribing to their own tracks
			if (track.ownerTeamId === input.teamId) {
				throw new ZSAError(
					"FORBIDDEN",
					"Cannot subscribe to your own team's track",
				)
			}

			// Check if already subscribed
			const existing = await db
				.select()
				.from(teamProgrammingTracksTable)
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, input.teamId),
						eq(teamProgrammingTracksTable.trackId, input.trackId),
					),
				)
				.get()

			if (existing) {
				if (existing.isActive) {
					throw new ZSAError("CONFLICT", "Already subscribed to this track")
				}

				// Reactivate subscription
				await db
					.update(teamProgrammingTracksTable)
					.set({
						isActive: 1,
						subscribedAt: new Date(),
					})
					.where(
						and(
							eq(teamProgrammingTracksTable.teamId, input.teamId),
							eq(teamProgrammingTracksTable.trackId, input.trackId),
						),
					)
			} else {
				// Create new subscription
				await db.insert(teamProgrammingTracksTable).values({
					teamId: input.teamId,
					trackId: input.trackId,
					isActive: 1,
				})
			}

			return { success: true }
		} catch (error) {
			console.error(
				`ERROR: Unauthorized subscription attempt - User lacks MANAGE_PROGRAMMING permission for team ${input.teamId}`,
			)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to subscribe to track",
			)
		}
	})

export const unsubscribeFromTrackAction = createServerAction()
	.input(unsubscribeFromTrackSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has programming management permission for the team
			await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const db = getDd()

			// Deactivate subscription instead of deleting
			const result = await db
				.update(teamProgrammingTracksTable)
				.set({ isActive: 0 })
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, input.teamId),
						eq(teamProgrammingTracksTable.trackId, input.trackId),
					),
				)

			return { success: true }
		} catch (error) {
			console.error("Failed to unsubscribe from track:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to unsubscribe from track",
			)
		}
	})

export const getTeamSubscriptionsAction = createServerAction()
	.input(getTeamSubscriptionsSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has access to the team
			await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const db = getDd()

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
						eq(teamProgrammingTracksTable.teamId, input.teamId),
						eq(teamProgrammingTracksTable.isActive, 1),
					),
				)

			return { success: true, data: subscriptions }
		} catch (error) {
			console.error("Failed to get team subscriptions:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get team subscriptions",
			)
		}
	})

export const setDefaultTrackAction = createServerAction()
	.input(setDefaultTrackSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session || !session.user) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
			}

			// Check if user has programming management permission for the team
			await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			const db = getDd()

			// Verify the team is subscribed to this track
			const subscription = await db
				.select()
				.from(teamProgrammingTracksTable)
				.where(
					and(
						eq(teamProgrammingTracksTable.teamId, input.teamId),
						eq(teamProgrammingTracksTable.trackId, input.trackId),
						eq(teamProgrammingTracksTable.isActive, 1),
					),
				)
				.get()

			if (!subscription) {
				throw new ZSAError("FORBIDDEN", "Team is not subscribed to this track")
			}

			// Update team's default track
			await db
				.update(teamTable)
				.set({ defaultTrackId: input.trackId })
				.where(eq(teamTable.id, input.teamId))

			console.info(
				`INFO: Default track updated for team ${input.teamId} to track ${input.trackId}`,
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to set default track:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to set default track")
		}
	})
