/**
 * Leaderboard Server Functions for TanStack Start
 * Based on apps/wodsmith/src/server/leaderboard.ts
 *
 * Note: This is a simplified version for competition leaderboard.
 * The full wodsmith implementation includes scheduled workout instances
 * which may not be needed for competition leaderboards initially.
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  competitionRegistrationsTable,
  competitionsTable,
} from '@/db/schemas/competitions'
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from '@/db/schemas/programming'
import {eq, and} from 'drizzle-orm'

// ============================================================================
// Types
// ============================================================================

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
  competitionId: z.string().min(1, 'Competition ID is required'),
  divisionId: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get leaderboard data for a competition
 * Returns registrations grouped by division
 *
 * Note: This is a placeholder implementation. In a full competition system,
 * you would need:
 * 1. Competition results table to store scores
 * 2. Score calculation logic based on workout schemes
 * 3. Ranking algorithm based on multiple workouts
 *
 * For now, this returns basic registration data grouped by division.
 */
export const getLeaderboardDataFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => getLeaderboardDataInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    // Verify competition exists
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    if (!competition) {
      return {leaderboard: [], workouts: []}
    }

    // Get published workouts for this competition
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.competitionId, data.competitionId),
    })

    const trackWorkoutsWithWorkouts = track
      ? await db.query.trackWorkoutsTable.findMany({
          where: and(
            eq(trackWorkoutsTable.trackId, track.id),
            eq(trackWorkoutsTable.eventStatus, 'published'),
          ),
          with: {
            workout: true,
          },
          orderBy: (trackWorkouts, {asc}) => [asc(trackWorkouts.trackOrder)],
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
        orderBy: (regs, {asc}) => [asc(regs.registeredAt)],
      },
    )

    // Transform to leaderboard format
    // In a real implementation, this would query actual competition results
    const leaderboard: LeaderboardEntry[] = registrations.map((reg) => {
      const fullName =
        `${reg.user.firstName || ''} ${reg.user.lastName || ''}`.trim()

      return {
        userId: reg.userId,
        userName: fullName || reg.user.email || 'Unknown',
        userAvatar: reg.user.avatar,
        score: null, // Would come from results table
        aggregatedScore: null, // Would be calculated from all event scores
        formattedScore: 'N/A', // Pending results
        scalingLevelId: reg.divisionId,
        scalingLevelLabel: reg.division?.label ?? null,
        scalingLevelPosition: reg.division?.position ?? null,
        asRx: false, // Would come from results
        completedAt: reg.registeredAt,
        isTimeCapped: false,
      }
    })

    return {
      leaderboard,
      workouts: trackWorkoutsWithWorkouts.map((tw) => ({
        id: tw.id,
        workoutId: tw.workoutId,
        name: (tw as any).workout?.name ?? 'Unknown Workout',
        trackOrder: tw.trackOrder,
      })),
    }
  })
