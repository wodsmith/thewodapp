/**
 * Workout Server Functions for TanStack Start
 * Port of getUserWorkouts logic from wodsmith app
 */

import {createId} from '@paralleldrive/cuid2'
import {createServerFn} from '@tanstack/react-start'
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  programmingTracksTable,
  scheduledWorkoutInstancesTable,
  trackWorkoutsTable,
} from '@/db/schemas/programming'
import {scalingLevelsTable} from '@/db/schemas/scaling'
import {scoresTable} from '@/db/schemas/scores'
import {
  movements,
  SCORE_TYPE_VALUES,
  tags,
  WORKOUT_SCHEME_VALUES,
  workoutMovements,
  workouts,
  workoutTags,
} from '@/db/schemas/workouts'
import {autochunk} from '@/utils/batch-query'
import {getSessionFromCookie} from '@/utils/auth'

// Workout type filter values
const WORKOUT_TYPE_FILTER_VALUES = ['all', 'original', 'remix'] as const

// Input validation schema with advanced filters
const getWorkoutsInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  // Advanced filters
  tagIds: z.array(z.string()).optional(),
  movementIds: z.array(z.string()).optional(),
  workoutType: z.enum(WORKOUT_SCHEME_VALUES).optional(),
  trackId: z.string().optional(),
  type: z.enum(WORKOUT_TYPE_FILTER_VALUES).optional(),
})

type GetWorkoutsInput = z.infer<typeof getWorkoutsInputSchema>

/**
 * Helper function to fetch tags by workout IDs (batched for D1 100-param limit)
 */
async function fetchTagsByWorkoutId(
  db: ReturnType<typeof getDb>,
  workoutIds: string[],
): Promise<Map<string, Array<{id: string; name: string}>>> {
  if (workoutIds.length === 0) return new Map()

  const workoutTagsData = await autochunk({items: workoutIds}, async (chunk) =>
    db
      .select({
        workoutId: workoutTags.workoutId,
        tagId: tags.id,
        tagName: tags.name,
      })
      .from(workoutTags)
      .innerJoin(tags, eq(workoutTags.tagId, tags.id))
      .where(inArray(workoutTags.workoutId, chunk)),
  )

  const tagsByWorkoutId = new Map<string, Array<{id: string; name: string}>>()

  for (const item of workoutTagsData) {
    if (!tagsByWorkoutId.has(item.workoutId)) {
      tagsByWorkoutId.set(item.workoutId, [])
    }
    tagsByWorkoutId.get(item.workoutId)?.push({
      id: item.tagId,
      name: item.tagName,
    })
  }

  return tagsByWorkoutId
}

/**
 * Helper function to fetch movements by workout IDs (batched for D1 100-param limit)
 */
async function fetchMovementsByWorkoutId(
  db: ReturnType<typeof getDb>,
  workoutIds: string[],
): Promise<Map<string, Array<{id: string; name: string; type: string}>>> {
  if (workoutIds.length === 0) return new Map()

  const workoutMovementsData = await autochunk(
    {items: workoutIds},
    async (chunk) =>
      db
        .select({
          workoutId: workoutMovements.workoutId,
          movementId: movements.id,
          movementName: movements.name,
          movementType: movements.type,
        })
        .from(workoutMovements)
        .innerJoin(movements, eq(workoutMovements.movementId, movements.id))
        .where(inArray(workoutMovements.workoutId, chunk)),
  )

  const movementsByWorkoutId = new Map<
    string,
    Array<{id: string; name: string; type: string}>
  >()

  for (const item of workoutMovementsData) {
    if (item.workoutId && !movementsByWorkoutId.has(item.workoutId)) {
      movementsByWorkoutId.set(item.workoutId, [])
    }
    if (item.workoutId) {
      movementsByWorkoutId.get(item.workoutId)?.push({
        id: item.movementId,
        name: item.movementName,
        type: item.movementType,
      })
    }
  }

  return movementsByWorkoutId
}

/**
 * Get workouts for a team with advanced filtering
 * Returns team-owned workouts and public workouts
 * Supports filtering by tags, movements, workout type (scheme), track, and original/remix type
 */
export const getWorkoutsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => getWorkoutsInputSchema.parse(data))
  .handler(async ({data}) => {
    const validatedData = data as GetWorkoutsInput
    const db = getDb()
    const offset = (validatedData.page - 1) * validatedData.pageSize

    // Determine which joins we need based on filters
    const needsTrackJoin = !!validatedData.trackId
    const needsTagJoin = validatedData.tagIds && validatedData.tagIds.length > 0
    const needsMovementJoin =
      validatedData.movementIds && validatedData.movementIds.length > 0

    // Build base query conditions
    const conditions: ReturnType<typeof eq>[] = []

    // Base condition: team-owned or public workouts
    const teamOrPublicCondition = or(
      eq(workouts.teamId, validatedData.teamId),
      eq(workouts.scope, 'public'),
    )
    if (teamOrPublicCondition) {
      conditions.push(teamOrPublicCondition)
    }

    // Search filter
    if (validatedData.search) {
      const searchLower = validatedData.search.toLowerCase()
      const searchCondition = or(
        sql`LOWER(${workouts.name}) LIKE ${`%${searchLower}%`}`,
        sql`LOWER(${workouts.description}) LIKE ${`%${searchLower}%`}`,
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    // Workout scheme filter (AMRAP, FOR_TIME, etc.)
    if (validatedData.workoutType) {
      conditions.push(eq(workouts.scheme, validatedData.workoutType))
    }

    // Original/remix type filter
    if (validatedData.type === 'original') {
      conditions.push(isNull(workouts.sourceWorkoutId))
    } else if (validatedData.type === 'remix') {
      conditions.push(isNotNull(workouts.sourceWorkoutId))
    }

    // Track filter - requires join
    if (needsTrackJoin && validatedData.trackId) {
      conditions.push(eq(trackWorkoutsTable.trackId, validatedData.trackId))
    }

    // Tag filter - requires join (filter workouts that have ANY of the selected tags)
    if (
      needsTagJoin &&
      validatedData.tagIds &&
      validatedData.tagIds.length > 0
    ) {
      conditions.push(inArray(workoutTags.tagId, validatedData.tagIds))
    }

    // Movement filter - requires join (filter workouts that have ANY of the selected movements)
    if (
      needsMovementJoin &&
      validatedData.movementIds &&
      validatedData.movementIds.length > 0
    ) {
      conditions.push(
        inArray(workoutMovements.movementId, validatedData.movementIds),
      )
    }

    // Strategy: For filters that require joins (tags, movements, track),
    // first get the matching workout IDs, then fetch the full workout data.
    // This avoids duplicate rows and complex query type issues with mocks.
    let filteredWorkoutIds: string[] | null = null

    // If we have join-based filters, first get matching workout IDs
    if (needsTrackJoin || needsTagJoin || needsMovementJoin) {
      // Build a query to get distinct workout IDs that match the join filters
      // Use a subquery approach: get IDs first, then fetch full data
      let idQuery = db.select({id: workouts.id}).from(workouts).$dynamic()

      // Add necessary joins
      if (needsTrackJoin) {
        idQuery = idQuery.innerJoin(
          trackWorkoutsTable,
          eq(trackWorkoutsTable.workoutId, workouts.id),
        )
      }
      if (needsTagJoin) {
        idQuery = idQuery.innerJoin(
          workoutTags,
          eq(workoutTags.workoutId, workouts.id),
        )
      }
      if (needsMovementJoin) {
        idQuery = idQuery.innerJoin(
          workoutMovements,
          eq(workoutMovements.workoutId, workouts.id),
        )
      }

      // Get the workout IDs (may have duplicates due to joins)
      const matchingRows = await idQuery.where(and(...conditions))

      // Deduplicate IDs
      const idSet = new Set<string>()
      for (const row of matchingRows) {
        idSet.add(row.id)
      }
      filteredWorkoutIds = Array.from(idSet)

      // If no workouts match, return early
      if (filteredWorkoutIds.length === 0) {
        return {
          workouts: [],
          totalCount: 0,
          currentPage: validatedData.page,
          pageSize: validatedData.pageSize,
        }
      }
    }

    // Build the main query for workout data
    // If we have filtered IDs, use them; otherwise use the base conditions
    const mainConditions = filteredWorkoutIds
      ? [inArray(workouts.id, filteredWorkoutIds)]
      : conditions

    // Get total count for pagination
    const countResult = await db
      .select({count: sql<number>`count(*)`})
      .from(workouts)
      .where(and(...mainConditions))

    const totalCount = countResult[0]?.count ?? 0

    // Fetch workouts with pagination
    const workoutsList = await db
      .select({
        id: workouts.id,
        name: workouts.name,
        description: workouts.description,
        scheme: workouts.scheme,
        scope: workouts.scope,
        teamId: workouts.teamId,
        sourceWorkoutId: workouts.sourceWorkoutId,
        createdAt: workouts.createdAt,
        updatedAt: workouts.updatedAt,
      })
      .from(workouts)
      .where(and(...mainConditions))
      .orderBy(desc(workouts.updatedAt))
      .limit(validatedData.pageSize)
      .offset(offset)

    // Fetch related tags and movements for all returned workouts
    const workoutIds = workoutsList.map((w) => w.id)
    const [tagsByWorkoutId, movementsByWorkoutId] = await Promise.all([
      fetchTagsByWorkoutId(db, workoutIds),
      fetchMovementsByWorkoutId(db, workoutIds),
    ])

    // Compose final structure with related data
    const workoutsWithRelations = workoutsList.map((w) => ({
      ...w,
      tags: tagsByWorkoutId.get(w.id) || [],
      movements: movementsByWorkoutId.get(w.id) || [],
    }))

    return {
      workouts: workoutsWithRelations,
      totalCount,
      currentPage: validatedData.page,
      pageSize: validatedData.pageSize,
    }
  })

// Input validation schema for single workout
const getWorkoutByIdInputSchema = z.object({
  id: z.string().min(1, 'Workout ID is required'),
})

/**
 * Get a single workout by ID
 */
export const getWorkoutByIdFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => getWorkoutByIdInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    const workout = await db
      .select({
        id: workouts.id,
        name: workouts.name,
        description: workouts.description,
        scheme: workouts.scheme,
        scope: workouts.scope,
        teamId: workouts.teamId,
        scoreType: workouts.scoreType,
        repsPerRound: workouts.repsPerRound,
        roundsToScore: workouts.roundsToScore,
        timeCap: workouts.timeCap,
        tiebreakScheme: workouts.tiebreakScheme,
        createdAt: workouts.createdAt,
        updatedAt: workouts.updatedAt,
      })
      .from(workouts)
      .where(eq(workouts.id, data.id))
      .limit(1)

    if (!workout[0]) {
      return {workout: null}
    }

    return {workout: workout[0]}
  })

// Schema for creating a workout
const createWorkoutInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  scheme: z.enum(WORKOUT_SCHEME_VALUES),
  scoreType: z.enum(SCORE_TYPE_VALUES).optional(),
  scope: z.enum(['private', 'public']).default('private'),
  timeCap: z.number().int().min(1).optional(),
  roundsToScore: z.number().int().min(1).optional(),
  teamId: z.string().min(1, 'Team ID is required'),
  sourceWorkoutId: z.string().optional(), // For remix tracking
})

export type CreateWorkoutInput = z.infer<typeof createWorkoutInputSchema>

/**
 * Create a new workout
 */
export const createWorkoutFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => createWorkoutInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    // Get session to verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Create the workout
    const workoutId = `workout_${createId()}`
    const newWorkout = await db
      .insert(workouts)
      .values({
        id: workoutId,
        name: data.name,
        description: data.description,
        scheme: data.scheme,
        scoreType: data.scoreType ?? null,
        scope: data.scope,
        timeCap: data.timeCap ?? null,
        roundsToScore: data.roundsToScore ?? null,
        teamId: data.teamId,
        sourceWorkoutId: data.sourceWorkoutId ?? null, // For remix tracking
      })
      .returning()

    return {workout: newWorkout[0]}
  })

// Schema for updating a workout
const updateWorkoutInputSchema = z.object({
  id: z.string().min(1, 'Workout ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  scheme: z.enum(WORKOUT_SCHEME_VALUES),
  scoreType: z.enum(SCORE_TYPE_VALUES).optional(),
  scope: z.enum(['private', 'public']),
  timeCap: z.number().int().min(1).optional(),
  roundsToScore: z.number().int().min(1).optional(),
})

export type UpdateWorkoutInput = z.infer<typeof updateWorkoutInputSchema>

/**
 * Update an existing workout
 */
export const updateWorkoutFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => updateWorkoutInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    // Get session to verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Update the workout
    const updatedWorkout = await db
      .update(workouts)
      .set({
        name: data.name,
        description: data.description,
        scheme: data.scheme,
        scoreType: data.scoreType ?? null,
        scope: data.scope,
        timeCap: data.timeCap ?? null,
        roundsToScore: data.roundsToScore ?? null,
        updatedAt: new Date(),
      })
      .where(eq(workouts.id, data.id))
      .returning()

    if (!updatedWorkout[0]) {
      throw new Error('Workout not found')
    }

    return {workout: updatedWorkout[0]}
  })

// Schema for scheduling a workout
const scheduleWorkoutInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  workoutId: z.string().min(1, 'Workout ID is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'), // ISO string
})

export type ScheduleWorkoutInput = z.infer<typeof scheduleWorkoutInputSchema>

/**
 * Schedule a standalone workout for a team
 */
export const scheduleWorkoutFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => scheduleWorkoutInputSchema.parse(data))
  .handler(async ({data}) => {
    const db = getDb()

    // Get session to verify user is authenticated
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Import the scheduled workout instances table
    const {scheduledWorkoutInstancesTable} =
      await import('@/db/schemas/programming')
    const {createScheduledWorkoutInstanceId} =
      await import('@/db/schemas/common')

    // Parse the date and normalize to noon UTC to avoid timezone boundary issues
    const scheduledDate = new Date(data.scheduledDate)
    scheduledDate.setUTCHours(12, 0, 0, 0)

    // Create the scheduled workout instance
    const [instance] = await db
      .insert(scheduledWorkoutInstancesTable)
      .values({
        id: createScheduledWorkoutInstanceId(),
        teamId: data.teamId,
        trackWorkoutId: null, // No track workout for standalone
        workoutId: data.workoutId, // Direct workout reference
        scheduledDate: scheduledDate,
      })
      .returning()

    if (!instance) {
      throw new Error('Failed to schedule workout')
    }

    return {success: true, instance}
  })

// Schema for getting scheduled workouts
const getScheduledWorkoutsInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  startDate: z.string().min(1, 'Start date is required'), // ISO string
  endDate: z.string().min(1, 'End date is required'), // ISO string
})

export type GetScheduledWorkoutsInput = z.infer<
  typeof getScheduledWorkoutsInputSchema
>

export interface ScheduledWorkoutWithDetails {
  id: string
  scheduledDate: Date
  workout: {
    id: string
    name: string
    description: string | null
    scheme: string
  } | null
}

/**
 * Get scheduled workouts for a team within a date range
 */
export const getScheduledWorkoutsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getScheduledWorkoutsInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    // Get scheduled workout instances with workout details
    const instances = await db
      .select({
        id: scheduledWorkoutInstancesTable.id,
        scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
        workoutId: scheduledWorkoutInstancesTable.workoutId,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
      })
      .from(scheduledWorkoutInstancesTable)
      .leftJoin(
        workouts,
        eq(scheduledWorkoutInstancesTable.workoutId, workouts.id),
      )
      .where(
        and(
          eq(scheduledWorkoutInstancesTable.teamId, data.teamId),
          gte(scheduledWorkoutInstancesTable.scheduledDate, startDate),
          lte(scheduledWorkoutInstancesTable.scheduledDate, endDate),
        ),
      )
      .orderBy(scheduledWorkoutInstancesTable.scheduledDate)

    // Transform to expected format
    const scheduledWorkouts: ScheduledWorkoutWithDetails[] = instances.map(
      (instance) => ({
        id: instance.id,
        scheduledDate: instance.scheduledDate,
        workout: instance.workoutId
          ? {
              id: instance.workoutId,
              name: instance.workoutName || 'Unknown Workout',
              description: instance.workoutDescription,
              scheme: instance.workoutScheme || 'time',
            }
          : null,
      }),
    )

    return {scheduledWorkouts}
  })

// Schema for getting scheduled workouts with results
const getScheduledWorkoutsWithResultsInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  startDate: z.string().min(1, 'Start date is required'), // ISO string
  endDate: z.string().min(1, 'End date is required'), // ISO string
})

export type GetScheduledWorkoutsWithResultsInput = z.infer<
  typeof getScheduledWorkoutsWithResultsInputSchema
>

export interface ScheduledWorkoutWithResult {
  id: string
  scheduledDate: Date
  workout: {
    id: string
    name: string
    description: string | null
    scheme: string
  } | null
  result: {
    scoreValue: number | null
    displayScore: string
    scalingLabel: string | null
    asRx: boolean
    recordedAt: Date
  } | null
}

/**
 * Get scheduled workouts for a team within a date range with user's results
 * This combines scheduled workout instances with the user's logged scores
 */
// Schema for getting scheduled instances for a specific workout
const getWorkoutScheduledInstancesInputSchema = z.object({
  workoutId: z.string().min(1, 'Workout ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
})

export type GetWorkoutScheduledInstancesInput = z.infer<
  typeof getWorkoutScheduledInstancesInputSchema
>

export interface WorkoutScheduledInstance {
  id: string
  scheduledDate: Date
}

/**
 * Get all scheduled instances for a specific workout
 */
export const getWorkoutScheduledInstancesFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getWorkoutScheduledInstancesInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const instances = await db
      .select({
        id: scheduledWorkoutInstancesTable.id,
        scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
      })
      .from(scheduledWorkoutInstancesTable)
      .where(
        and(
          eq(scheduledWorkoutInstancesTable.workoutId, data.workoutId),
          eq(scheduledWorkoutInstancesTable.teamId, data.teamId),
        ),
      )
      .orderBy(desc(scheduledWorkoutInstancesTable.scheduledDate))

    return {instances}
  })

export const getScheduledWorkoutsWithResultsFn = createServerFn({
  method: 'GET',
})
  .inputValidator((data: unknown) =>
    getScheduledWorkoutsWithResultsInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    // Get scheduled workout instances with workout details
    const instances = await db
      .select({
        id: scheduledWorkoutInstancesTable.id,
        scheduledDate: scheduledWorkoutInstancesTable.scheduledDate,
        workoutId: scheduledWorkoutInstancesTable.workoutId,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
      })
      .from(scheduledWorkoutInstancesTable)
      .leftJoin(
        workouts,
        eq(scheduledWorkoutInstancesTable.workoutId, workouts.id),
      )
      .where(
        and(
          eq(scheduledWorkoutInstancesTable.teamId, data.teamId),
          gte(scheduledWorkoutInstancesTable.scheduledDate, startDate),
          lte(scheduledWorkoutInstancesTable.scheduledDate, endDate),
        ),
      )
      .orderBy(scheduledWorkoutInstancesTable.scheduledDate)

    // Fetch user's scores for these scheduled instances
    // We'll query by userId + date range to get all scores, then match them up
    const scores = await db
      .select({
        scoreId: scoresTable.id,
        scoreValue: scoresTable.scoreValue,
        scheme: scoresTable.scheme,
        scheduledWorkoutInstanceId: scoresTable.scheduledWorkoutInstanceId,
        workoutId: scoresTable.workoutId,
        recordedAt: scoresTable.recordedAt,
        asRx: scoresTable.asRx,
        scalingLevelId: scoresTable.scalingLevelId,
        scalingLabel: scalingLevelsTable.label,
      })
      .from(scoresTable)
      .leftJoin(
        scalingLevelsTable,
        eq(scoresTable.scalingLevelId, scalingLevelsTable.id),
      )
      .where(
        and(
          eq(scoresTable.userId, data.userId),
          eq(scoresTable.teamId, data.teamId),
          gte(scoresTable.recordedAt, startDate),
          lte(scoresTable.recordedAt, endDate),
        ),
      )

    // Helper function to format score value for display
    const formatScoreValue = (
      scoreValue: number | null,
      scheme: string,
    ): string => {
      if (scoreValue === null) return 'No score'

      switch (scheme) {
        case 'time':
        case 'time-with-cap': {
          // Time is stored in milliseconds
          const totalSeconds = Math.floor(scoreValue / 1000)
          const minutes = Math.floor(totalSeconds / 60)
          const seconds = totalSeconds % 60
          return `${minutes}:${seconds.toString().padStart(2, '0')}`
        }
        case 'rounds-reps': {
          // Encoded as rounds * 100000 + reps
          const rounds = Math.floor(scoreValue / 100000)
          const reps = scoreValue % 100000
          return `${rounds}+${reps}`
        }
        case 'reps':
          return `${scoreValue} reps`
        case 'load': {
          // Load is stored in grams, convert to lbs or kg
          const lbs = Math.round(scoreValue / 453.592)
          return `${lbs} lbs`
        }
        case 'calories':
          return `${scoreValue} cal`
        case 'meters':
          return `${scoreValue} m`
        case 'feet':
          return `${scoreValue} ft`
        case 'points':
          return `${scoreValue} pts`
        default:
          return String(scoreValue)
      }
    }

    // Create a map of scores by scheduled instance ID or workout ID
    const scoresMap = new Map<
      string,
      {
        scoreValue: number | null
        displayScore: string
        scalingLabel: string | null
        asRx: boolean
        recordedAt: Date
      }
    >()

    for (const score of scores) {
      const formattedScore = {
        scoreValue: score.scoreValue,
        displayScore: formatScoreValue(score.scoreValue, score.scheme),
        scalingLabel: score.scalingLabel,
        asRx: score.asRx,
        recordedAt: score.recordedAt,
      }

      // Match by scheduled instance ID first
      if (score.scheduledWorkoutInstanceId) {
        scoresMap.set(score.scheduledWorkoutInstanceId, formattedScore)
      } else if (score.workoutId) {
        // Fallback to workout ID matching
        scoresMap.set(score.workoutId, formattedScore)
      }
    }

    // Transform to expected format with results attached
    const scheduledWorkoutsWithResults: ScheduledWorkoutWithResult[] =
      instances.map((instance) => {
        // Try to find a score by instance ID first, then by workout ID
        const result =
          scoresMap.get(instance.id) ||
          (instance.workoutId ? scoresMap.get(instance.workoutId) : null) ||
          null

        return {
          id: instance.id,
          scheduledDate: instance.scheduledDate,
          workout: instance.workoutId
            ? {
                id: instance.workoutId,
                name: instance.workoutName || 'Unknown Workout',
                description: instance.workoutDescription,
                scheme: instance.workoutScheme || 'time',
              }
            : null,
          result,
        }
      })

    return {scheduledWorkoutsWithResults}
  })

// Schema for getting filter options
const getWorkoutFilterOptionsInputSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

export type GetWorkoutFilterOptionsInput = z.infer<
  typeof getWorkoutFilterOptionsInputSchema
>

/**
 * Get available filter options for workouts (tags, movements, tracks)
 * Returns all tags, movements, and tracks that are available to the team
 */
export const getWorkoutFilterOptionsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getWorkoutFilterOptionsInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Get all tags from workouts accessible to the team (team-owned or public)
    const availableTags = await db
      .selectDistinct({
        id: tags.id,
        name: tags.name,
      })
      .from(tags)
      .innerJoin(workoutTags, eq(workoutTags.tagId, tags.id))
      .innerJoin(workouts, eq(workouts.id, workoutTags.workoutId))
      .where(or(eq(workouts.teamId, data.teamId), eq(workouts.scope, 'public')))
      .orderBy(tags.name)

    // Get all movements from workouts accessible to the team
    const availableMovements = await db
      .selectDistinct({
        id: movements.id,
        name: movements.name,
        type: movements.type,
      })
      .from(movements)
      .innerJoin(
        workoutMovements,
        eq(workoutMovements.movementId, movements.id),
      )
      .innerJoin(workouts, eq(workouts.id, workoutMovements.workoutId))
      .where(or(eq(workouts.teamId, data.teamId), eq(workouts.scope, 'public')))
      .orderBy(movements.name)

    // Get all programming tracks accessible to the team
    // (tracks owned by the team, tracks the team is subscribed to, or public tracks)
    const availableTracks = await db
      .selectDistinct({
        id: programmingTracksTable.id,
        name: programmingTracksTable.name,
      })
      .from(programmingTracksTable)
      .innerJoin(
        trackWorkoutsTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .innerJoin(workouts, eq(workouts.id, trackWorkoutsTable.workoutId))
      .where(
        or(
          eq(programmingTracksTable.ownerTeamId, data.teamId),
          eq(programmingTracksTable.isPublic, 1),
        ),
      )
      .orderBy(programmingTracksTable.name)

    return {
      tags: availableTags,
      movements: availableMovements,
      tracks: availableTracks,
    }
  })
