/**
 * Leaderboard Server Functions for TanStack Start
 *
 * Provides server functions for competition leaderboard data.
 * Uses the configurable scoring system from @/server/competition-leaderboard.ts
 *
 * @see docs/plans/configurable-scoring-system.md
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

// ============================================================================
// Types (Re-export from server layer)
// ============================================================================

export type {
	CompetitionLeaderboardEntry,
	CompetitionLeaderboardResult,
	EventLeaderboardEntry,
	TeamMemberInfo,
} from "@/server/competition-leaderboard"

// Legacy type for backwards compatibility
export interface LeaderboardEntry {
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

// ============================================================================
// Input Schemas
// ============================================================================

const getLeaderboardDataInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().optional(),
})

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
 * Get full competition leaderboard with configurable scoring.
 *
 * Uses the ScoringConfig from competition settings to determine:
 * - Scoring algorithm (traditional, p_score, custom)
 * - Tiebreaker method (countback, head_to_head, none)
 * - Status handling (DNF, DNS, withdrawn)
 */
export const getCompetitionLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionLeaderboardInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const { getCompetitionLeaderboard } = await import(
			"@/server/competition-leaderboard"
		)
		return getCompetitionLeaderboard({
			competitionId: data.competitionId,
			divisionId: data.divisionId,
		})
	})

/**
 * Get leaderboard for a specific event.
 */
export const getEventLeaderboardFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventLeaderboardInputSchema.parse(data))
	.handler(async ({ data }) => {
		const { getEventLeaderboard } = await import(
			"@/server/competition-leaderboard"
		)
		return getEventLeaderboard({
			competitionId: data.competitionId,
			trackWorkoutId: data.trackWorkoutId,
			divisionId: data.divisionId,
		})
	})

/**
 * Get leaderboard data for a competition (legacy interface).
 *
 * Returns registrations with basic info and workouts list.
 * For full scoring data, use getCompetitionLeaderboardFn instead.
 *
 * @deprecated Use getCompetitionLeaderboardFn for full scoring support
 */
export const getLeaderboardDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getLeaderboardDataInputSchema.parse(data))
	.handler(async ({ data }) => {
		const { getDb } = await import("@/db")
		const { competitionsTable } = await import("@/db/schemas/competitions")
		const { programmingTracksTable, trackWorkoutsTable } = await import(
			"@/db/schemas/programming"
		)
		const { competitionRegistrationsTable } = await import(
			"@/db/schemas/competitions"
		)
		const { eq, and } = await import("drizzle-orm")

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

		// Transform to leaderboard format
		const leaderboard: LeaderboardEntry[] = registrations.map((reg) => {
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
