/**
 * Competition Workouts Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-workouts.ts
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  programmingTracksTable,
  trackWorkoutsTable,
  type TrackWorkout,
} from '@/db/schemas/programming'
import {workouts, type Workout} from '@/db/schemas/workouts'
import {
  scalingLevelsTable,
  workoutScalingDescriptionsTable,
} from '@/db/schemas/scaling'
import {eq, and, inArray} from 'drizzle-orm'
import {autochunk} from '@/utils/batch-query'

// ============================================================================
// Types
// ============================================================================

export interface DivisionDescription {
  divisionId: string
  divisionLabel: string
  description: string | null
  position: number
}

export interface CompetitionWorkout {
  id: string
  trackId: string
  workoutId: string
  trackOrder: number
  notes: string | null
  pointsMultiplier: number | null
  heatStatus: TrackWorkout['heatStatus']
  eventStatus: TrackWorkout['eventStatus']
  sponsorId: string | null
  createdAt: Date
  updatedAt: Date
  workout: {
    id: string
    name: string
    description: string | null
    scheme: Workout['scheme']
    scoreType: Workout['scoreType']
    roundsToScore: number | null
    repsPerRound: number | null
    tiebreakScheme: Workout['tiebreakScheme']
    timeCap: number | null
  }
  divisionDescriptions?: DivisionDescription[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPublishedCompetitionWorkoutsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
})

const getWorkoutDivisionDescriptionsInputSchema = z.object({
  workoutId: z.string().min(1, 'Workout ID is required'),
  divisionIds: z.array(z.string()),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get published workouts for a competition (for public views)
 * Returns only workouts with eventStatus = 'published'
 */
export const getPublishedCompetitionWorkoutsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getPublishedCompetitionWorkoutsInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Get the competition's programming track
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.competitionId, data.competitionId),
    })

    if (!track) {
      return {workouts: []}
    }

    // Get only published workouts for this track
    const trackWorkouts = await db
      .select({
        id: trackWorkoutsTable.id,
        trackId: trackWorkoutsTable.trackId,
        workoutId: trackWorkoutsTable.workoutId,
        trackOrder: trackWorkoutsTable.trackOrder,
        notes: trackWorkoutsTable.notes,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        heatStatus: trackWorkoutsTable.heatStatus,
        eventStatus: trackWorkoutsTable.eventStatus,
        sponsorId: trackWorkoutsTable.sponsorId,
        createdAt: trackWorkoutsTable.createdAt,
        updatedAt: trackWorkoutsTable.updatedAt,
        workout: {
          id: workouts.id,
          name: workouts.name,
          description: workouts.description,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          roundsToScore: workouts.roundsToScore,
          repsPerRound: workouts.repsPerRound,
          tiebreakScheme: workouts.tiebreakScheme,
          timeCap: workouts.timeCap,
        },
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(
        and(
          eq(trackWorkoutsTable.trackId, track.id),
          eq(trackWorkoutsTable.eventStatus, 'published'),
        ),
      )
      .orderBy(trackWorkoutsTable.trackOrder)

    return {workouts: trackWorkouts as CompetitionWorkout[]}
  })

/**
 * Get division descriptions for a workout
 * Returns descriptions for specific divisions for a given workout
 */
export const getWorkoutDivisionDescriptionsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getWorkoutDivisionDescriptionsInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    if (data.divisionIds.length === 0) {
      return {descriptions: []}
    }

    const db = getDb()

    // Get the scaling levels (divisions) with their descriptions for this workout (batched)
    const divisions = await autochunk(
      {items: data.divisionIds},
      async (chunk: string[]) => {
        const rows = await db
          .select({
            divisionId: scalingLevelsTable.id,
            divisionLabel: scalingLevelsTable.label,
            position: scalingLevelsTable.position,
          })
          .from(scalingLevelsTable)
          .where(inArray(scalingLevelsTable.id, chunk))
        return rows
      },
    )

    // Get existing descriptions for this workout (batched)
    const descriptions = await autochunk(
      {items: data.divisionIds, otherParametersCount: 1}, // +1 for workoutId
      async (chunk: string[]) => {
        const rows = await db
          .select({
            scalingLevelId: workoutScalingDescriptionsTable.scalingLevelId,
            description: workoutScalingDescriptionsTable.description,
          })
          .from(workoutScalingDescriptionsTable)
          .where(
            and(
              eq(workoutScalingDescriptionsTable.workoutId, data.workoutId),
              inArray(workoutScalingDescriptionsTable.scalingLevelId, chunk),
            ),
          )
        return rows
      },
    )

    // Create a map for quick lookup
    const descriptionMap = new Map(
      descriptions.map((d) => [d.scalingLevelId, d.description] as const),
    )

    // Combine divisions with their descriptions
    const result: DivisionDescription[] = divisions.map((division) => ({
      divisionId: division.divisionId,
      divisionLabel: division.divisionLabel,
      description: descriptionMap.get(division.divisionId) ?? null,
      position: division.position,
    }))

    return {descriptions: result}
  })
