/**
 * Competition Leaderboard Server Functions for TanStack Start
 *
 * Thin wrapper around the server leaderboard implementation.
 * Uses the configurable scoring system for all algorithms.
 *
 * @see @/server/competition-leaderboard for implementation
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { competitionRegistrationsTable } from "@/db/schemas/competitions"
import { programmingTracksTable, trackWorkoutsTable } from "@/db/schemas/programming"
import {
	getCompetitionLeaderboard,
	getEventLeaderboard,
	type CompetitionLeaderboardEntry as ServerLeaderboardEntry,
	type EventLeaderboardEntry as ServerEventLeaderboardEntry,
	type TeamMemberInfo as ServerTeamMemberInfo,
} from "@/server/competition-leaderboard"
import type { ScoringAlgorithm } from "@/types/scoring"

// ============================================================================
// Types (Re-export from server layer with additions)
// ============================================================================

export type TeamMemberInfo = ServerTeamMemberInfo

export type CompetitionLeaderboardEntry = ServerLeaderboardEntry

export type EventLeaderboardEntry = ServerEventLeaderboardEntry

/**
 * Response from the leaderboard function - includes scoring algorithm
 * for the frontend to display points appropriately
 */
export interface CompetitionLeaderboardResponse {
	entries: CompetitionLeaderboardEntry[]
	scoringAlgorithm: ScoringAlgorithm
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionLeaderboardInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().optional(),
})

const getEventLeaderboardInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	divisionId: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the competition leaderboard with scoring algorithm info
 */
export const getCompetitionLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionLeaderboardInputSchema.parse(data),
	)
	.handler(async ({ data }): Promise<CompetitionLeaderboardResponse> => {
		const result = await getCompetitionLeaderboard({
			competitionId: data.competitionId,
			divisionId: data.divisionId,
		})

		return {
			entries: result.entries,
			scoringAlgorithm: result.scoringConfig.algorithm,
		}
	})

/**
 * Get leaderboard for a specific event
 */
export const getEventLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventLeaderboardInputSchema.parse(data))
	.handler(async ({ data }) => {
		return getEventLeaderboard({
			competitionId: data.competitionId,
			trackWorkoutId: data.trackWorkoutId,
			divisionId: data.divisionId,
		})
	})

// ============================================================================
// Legacy API (for backwards compatibility with existing components)
// ============================================================================

export interface LegacyLeaderboardEntry {
	userId: string
	userName: string
	userAvatar: string | null
	score: string | null
	aggregatedScore: number | null
	formattedScore: string
	scalingLevelId: string | null
	scalingLevelLabel: string | null
	scalingLevelPosition: number | null
	asRx: boolean
	completedAt: Date
	isTimeCapped?: boolean
}

const getLeaderboardDataInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().optional(),
})

/**
 * Legacy leaderboard function for backwards compatibility.
 * Returns a simplified structure matching the old placeholder API.
 */
export const getLeaderboardDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getLeaderboardDataInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify competition exists
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
		})

		if (!competition) {
			return { leaderboard: [], workouts: [] }
		}

		// Get published workouts for this competition
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, data.competitionId),
		})

		const trackWorkoutsWithWorkouts = track
			? await db.query.trackWorkoutsTable.findMany({
					where: and(
						eq(trackWorkoutsTable.trackId, track.id),
						eq(trackWorkoutsTable.eventStatus, "published"),
					),
					with: {
						workout: true,
					},
					orderBy: (trackWorkouts, { asc }) => [asc(trackWorkouts.trackOrder)],
				})
			: []

		// Get registrations for this competition
		const registrations = await db.query.competitionRegistrationsTable.findMany(
			{
				where: data.divisionId
					? and(
							eq(competitionRegistrationsTable.eventId, data.competitionId),
							eq(competitionRegistrationsTable.divisionId, data.divisionId),
						)
					: eq(competitionRegistrationsTable.eventId, data.competitionId),
				with: {
					user: true,
					division: true,
				},
				orderBy: (regs, { asc }) => [asc(regs.registeredAt)],
			},
		)

		// Transform to legacy leaderboard format
		const leaderboard: LegacyLeaderboardEntry[] = registrations.map((reg) => {
			const fullName =
				`${reg.user.firstName || ""} ${reg.user.lastName || ""}`.trim()

			return {
				userId: reg.userId,
				userName: fullName || reg.user.email || "Unknown",
				userAvatar: reg.user.avatar,
				score: null,
				aggregatedScore: null,
				formattedScore: "N/A",
				scalingLevelId: reg.divisionId,
				scalingLevelLabel: reg.division?.label ?? null,
				scalingLevelPosition: reg.division?.position ?? null,
				asRx: false,
				completedAt: reg.registeredAt,
				isTimeCapped: false,
			}
		})

		return {
			leaderboard,
			workouts: trackWorkoutsWithWorkouts.map((tw) => ({
				id: tw.id,
				workoutId: tw.workoutId,
				name:
					(tw as unknown as { workout?: { name: string } }).workout?.name ??
					"Unknown Workout",
				trackOrder: tw.trackOrder,
			})),
		}
	})
