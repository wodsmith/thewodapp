/**
 * Programming Tracks Server Functions for TanStack Start
 * Port of programming track logic from wodsmith app
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  programmingTracksTable,
  teamProgrammingTracksTable,
  trackWorkoutsTable,
  PROGRAMMING_TRACK_TYPE,
} from '@/db/schemas/programming'
import {teamTable} from '@/db/schemas/teams'
import {workouts as workoutsTable} from '@/db/schemas/workouts'
import {
  createProgrammingTrackId,
  createTrackWorkoutId,
} from '@/db/schemas/common'
import {eq, and} from 'drizzle-orm'
import {getSessionFromCookie} from '@/utils/auth'

// ============================================================================
// Types
// ============================================================================

export interface ProgrammingTrackWithOwner {
  id: string
  name: string
  description: string | null
  type: string
  ownerTeamId: string | null
  isPublic: number
  scalingGroupId: string | null
  competitionId: string | null
  createdAt: Date
  updatedAt: Date
  updateCounter: number | null
  ownerTeam: {
    id: string
    name: string
  } | null
}

export interface TeamProgrammingTrack extends ProgrammingTrackWithOwner {
  subscribedAt: Date
}

export interface TrackWorkoutWithDetails {
  id: string
  trackId: string
  workoutId: string
  trackOrder: number
  notes: string | null
  pointsMultiplier: number | null
  heatStatus: string | null
  eventStatus: string | null
  sponsorId: string | null
  defaultHeatsCount: number | null
  defaultLaneShiftPattern: string | null
  minHeatBuffer: number | null
  createdAt: Date
  updatedAt: Date
  updateCounter: number | null
  workout: {
    id: string
    name: string
    description: string | null
    scheme: string
    scope: string
    teamId: string | null
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const getTeamProgrammingTracksInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

const getProgrammingTrackByIdInputSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
})

const createProgrammingTrackInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum([
    PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
    PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
    PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY,
  ]),
  ownerTeamId: z.string().min(1, 'Owner team ID is required'),
  isPublic: z.boolean().default(false),
  scalingGroupId: z.string().optional(),
})

export type CreateProgrammingTrackInput = z.infer<
  typeof createProgrammingTrackInputSchema
>

const updateProgrammingTrackInputSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z
    .enum([
      PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED,
      PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
      PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY,
    ])
    .optional(),
})

export type UpdateProgrammingTrackInput = z.infer<
  typeof updateProgrammingTrackInputSchema
>

const deleteProgrammingTrackInputSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
})

const getTrackWorkoutsInputSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
})

const addWorkoutToTrackInputSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
  workoutId: z.string().min(1, 'Workout ID is required'),
  trackOrder: z.number().int().min(1, 'Track order must be at least 1'),
  notes: z.string().optional(),
})

export type AddWorkoutToTrackInput = z.infer<
  typeof addWorkoutToTrackInputSchema
>

const removeWorkoutFromTrackInputSchema = z.object({
  trackWorkoutId: z.string().min(1, 'Track workout ID is required'),
})

const updateTrackVisibilityInputSchema = z.object({
  trackId: z.string().min(1, 'Track ID is required'),
  isPublic: z.boolean(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all programming tracks owned by or subscribed to by a team
 */
export const getTeamProgrammingTracksFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getTeamProgrammingTracksInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const tracks = await db
      .select({
        id: programmingTracksTable.id,
        name: programmingTracksTable.name,
        description: programmingTracksTable.description,
        type: programmingTracksTable.type,
        ownerTeamId: programmingTracksTable.ownerTeamId,
        isPublic: programmingTracksTable.isPublic,
        scalingGroupId: programmingTracksTable.scalingGroupId,
        competitionId: programmingTracksTable.competitionId,
        createdAt: programmingTracksTable.createdAt,
        updatedAt: programmingTracksTable.updatedAt,
        updateCounter: programmingTracksTable.updateCounter,
        ownerTeam: {
          id: teamTable.id,
          name: teamTable.name,
        },
        subscribedAt: teamProgrammingTracksTable.subscribedAt,
      })
      .from(teamProgrammingTracksTable)
      .innerJoin(
        programmingTracksTable,
        eq(teamProgrammingTracksTable.trackId, programmingTracksTable.id),
      )
      .leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
      .where(
        and(
          eq(teamProgrammingTracksTable.teamId, data.teamId),
          eq(teamProgrammingTracksTable.isActive, 1),
        ),
      )

    return {tracks}
  })

/**
 * Get a single programming track by ID with owner details
 */
export const getProgrammingTrackByIdFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getProgrammingTrackByIdInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const result = await db
      .select({
        id: programmingTracksTable.id,
        name: programmingTracksTable.name,
        description: programmingTracksTable.description,
        type: programmingTracksTable.type,
        ownerTeamId: programmingTracksTable.ownerTeamId,
        isPublic: programmingTracksTable.isPublic,
        scalingGroupId: programmingTracksTable.scalingGroupId,
        competitionId: programmingTracksTable.competitionId,
        createdAt: programmingTracksTable.createdAt,
        updatedAt: programmingTracksTable.updatedAt,
        updateCounter: programmingTracksTable.updateCounter,
        ownerTeam: {
          id: teamTable.id,
          name: teamTable.name,
        },
      })
      .from(programmingTracksTable)
      .leftJoin(teamTable, eq(programmingTracksTable.ownerTeamId, teamTable.id))
      .where(eq(programmingTracksTable.id, data.trackId))
      .limit(1)

    return {track: result[0] || null}
  })

/**
 * Create a new programming track
 */
export const createProgrammingTrackFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    createProgrammingTrackInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Create the programming track
    const trackId = createProgrammingTrackId()
    const [newTrack] = await db
      .insert(programmingTracksTable)
      .values({
        id: trackId,
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        ownerTeamId: data.ownerTeamId,
        isPublic: data.isPublic ? 1 : 0,
        scalingGroupId: data.scalingGroupId ?? null,
      })
      .returning()

    if (!newTrack) {
      throw new Error('Failed to create programming track')
    }

    // Automatically subscribe the owner team to the track
    await db.insert(teamProgrammingTracksTable).values({
      teamId: data.ownerTeamId,
      trackId: newTrack.id,
      isActive: 1,
      subscribedAt: new Date(),
    })

    return {track: newTrack}
  })

/**
 * Update an existing programming track
 */
export const updateProgrammingTrackFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    updateProgrammingTrackInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Build update object with only provided fields
    const updateData: {
      name?: string
      description?: string | null
      type?: string
      updatedAt: Date
    } = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null
    }
    if (data.type !== undefined) {
      updateData.type = data.type
    }

    // Update the track
    const [updatedTrack] = await db
      .update(programmingTracksTable)
      .set(updateData)
      .where(eq(programmingTracksTable.id, data.trackId))
      .returning()

    if (!updatedTrack) {
      throw new Error('Programming track not found')
    }

    return {track: updatedTrack}
  })

/**
 * Delete a programming track
 * Note: This will cascade delete all track workouts due to foreign key constraints
 */
export const deleteProgrammingTrackFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    deleteProgrammingTrackInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Delete the track (cascades to track_workouts)
    const result = await db
      .delete(programmingTracksTable)
      .where(eq(programmingTracksTable.id, data.trackId))
      .returning()

    if (!result[0]) {
      throw new Error('Programming track not found')
    }

    return {success: true}
  })

/**
 * Get all workouts in a programming track with workout details
 */
export const getTrackWorkoutsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => getTrackWorkoutsInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    const trackWorkouts = await db
      .select({
        trackWorkout: trackWorkoutsTable,
        workout: workoutsTable,
      })
      .from(trackWorkoutsTable)
      .innerJoin(
        workoutsTable,
        eq(trackWorkoutsTable.workoutId, workoutsTable.id),
      )
      .where(eq(trackWorkoutsTable.trackId, data.trackId))
      .orderBy(trackWorkoutsTable.trackOrder)

    // Transform to the expected format
    const workoutsWithDetails: TrackWorkoutWithDetails[] = trackWorkouts.map(
      (row) => ({
        ...row.trackWorkout,
        workout: {
          id: row.workout.id,
          name: row.workout.name,
          description: row.workout.description,
          scheme: row.workout.scheme,
          scope: row.workout.scope,
          teamId: row.workout.teamId,
        },
      }),
    )

    return {workouts: workoutsWithDetails}
  })

/**
 * Add a workout to a programming track
 */
export const addWorkoutToTrackFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => addWorkoutToTrackInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    // Verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Create the track workout
    const trackWorkoutId = createTrackWorkoutId()
    const [newTrackWorkout] = await db
      .insert(trackWorkoutsTable)
      .values({
        id: trackWorkoutId,
        trackId: data.trackId,
        workoutId: data.workoutId,
        trackOrder: data.trackOrder,
        notes: data.notes ?? null,
      })
      .returning()

    if (!newTrackWorkout) {
      throw new Error('Failed to add workout to track')
    }

    return {trackWorkout: newTrackWorkout}
  })

/**
 * Remove a workout from a programming track
 */
export const removeWorkoutFromTrackFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    removeWorkoutFromTrackInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Delete the track workout
    const result = await db
      .delete(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .returning()

    if (!result[0]) {
      throw new Error('Track workout not found')
    }

    return {success: true}
  })

/**
 * Update track visibility (public/private)
 */
export const updateTrackVisibilityFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    updateTrackVisibilityInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Update the track visibility
    const [updatedTrack] = await db
      .update(programmingTracksTable)
      .set({
        isPublic: data.isPublic ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(programmingTracksTable.id, data.trackId))
      .returning()

    if (!updatedTrack) {
      throw new Error('Programming track not found')
    }

    return {track: updatedTrack}
  })
