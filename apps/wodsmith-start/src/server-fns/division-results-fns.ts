/**
 * Division Results Publishing Server Functions for TanStack Start
 *
 * Handles publishing/unpublishing division results for competitions.
 * Results publishing controls visibility of division leaderboards/results to athletes.
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'

// ============================================================================
// Types
// ============================================================================

export interface DivisionResultStatus {
  divisionId: string
  label: string
  position: number
  registrationCount: number
  scoredCount: number
  missingScoreCount: number
  resultsPublishedAt: Date | null
  isPublished: boolean
}

export interface DivisionResultsStatusResponse {
  divisions: DivisionResultStatus[]
  publishedCount: number
  totalCount: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const getDivisionResultsStatusInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  organizingTeamId: z.string().min(1, 'Organizing team ID is required'),
})

const publishDivisionResultsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  organizingTeamId: z.string().min(1, 'Organizing team ID is required'),
  divisionId: z.string().min(1, 'Division ID is required'),
  publish: z.boolean(),
})

const publishAllDivisionResultsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  organizingTeamId: z.string().min(1, 'Organizing team ID is required'),
  publish: z.boolean(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse competition settings from JSON string
 */
function parseCompetitionSettings(settings: string | null): {
  divisions?: {scalingGroupId?: string}
  divisionResults?: {[divisionId: string]: {publishedAt: number | null}}
} | null {
  if (!settings) return null
  try {
    return JSON.parse(settings)
  } catch {
    return null
  }
}

/**
 * Stringify competition settings to JSON
 */
function stringifyCompetitionSettings(
  settings: {
    divisions?: {scalingGroupId?: string}
    divisionResults?: {[divisionId: string]: {publishedAt: number | null}}
    [key: string]: unknown
  } | null,
): string | null {
  if (!settings) return null
  try {
    return JSON.stringify(settings)
  } catch {
    return null
  }
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get division results publishing status for a competition
 * Returns each division with its publish status and missing score warnings
 */
export const getDivisionResultsStatusFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getDivisionResultsStatusInputSchema.parse(data),
  )
  .handler(async ({data}): Promise<DivisionResultsStatusResponse> => {
    const {getDb} = await import('@/db')
    const {eq, and, sql, inArray, isNotNull} = await import('drizzle-orm')
    const {competitionsTable, competitionRegistrationsTable} = await import(
      '@/db/schemas/competitions'
    )
    const {scalingLevelsTable} = await import('@/db/schemas/scaling')
    const {scoresTable} = await import('@/db/schemas/scores')
    const {trackWorkoutsTable, programmingTracksTable} = await import(
      '@/db/schemas/programming'
    )
    const {TEAM_PERMISSIONS} = await import('@/db/schemas/teams')
    const {getSessionFromCookie} = await import('@/utils/auth')
    const {autochunk} = await import('@/utils/batch-query')

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error('Not authenticated')
    }

    // Check permission
    const team = session.teams?.find((t) => t.id === data.organizingTeamId)
    if (!team?.permissions.includes(TEAM_PERMISSIONS.ACCESS_DASHBOARD)) {
      throw new Error('Missing required permission')
    }

    const db = getDb()

    // Get competition with settings
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error('Competition not found')
    }

    if (competition.organizingTeamId !== data.organizingTeamId) {
      throw new Error('Competition does not belong to this team')
    }

    const settings = parseCompetitionSettings(competition.settings)
    const scalingGroupId = settings?.divisions?.scalingGroupId

    if (!scalingGroupId) {
      return {divisions: [], publishedCount: 0, totalCount: 0}
    }

    // Get all divisions for this competition
    const divisions = await db
      .select({
        id: scalingLevelsTable.id,
        label: scalingLevelsTable.label,
        position: scalingLevelsTable.position,
      })
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

    if (divisions.length === 0) {
      return {divisions: [], publishedCount: 0, totalCount: 0}
    }

    // Get registrations per division
    const divisionIds = divisions.map((d) => d.id)
    const registrationCounts = await autochunk(
      {items: divisionIds, otherParametersCount: 1},
      async (chunk) =>
        db
          .select({
            divisionId: competitionRegistrationsTable.divisionId,
            count: sql<number>`cast(count(*) as integer)`,
          })
          .from(competitionRegistrationsTable)
          .where(
            and(
              eq(competitionRegistrationsTable.eventId, data.competitionId),
              inArray(competitionRegistrationsTable.divisionId, chunk),
            ),
          )
          .groupBy(competitionRegistrationsTable.divisionId),
    )

    const registrationCountMap = new Map<string, number>()
    for (const row of registrationCounts) {
      if (row.divisionId) {
        registrationCountMap.set(row.divisionId, row.count)
      }
    }

    // Get the competition's programming track to find all events
    const [track] = await db
      .select({id: programmingTracksTable.id})
      .from(programmingTracksTable)
      .where(eq(programmingTracksTable.competitionId, data.competitionId))

    if (!track) {
      // No events yet, return divisions with zero counts
      const divisionResults = settings?.divisionResults ?? {}
      const results: DivisionResultStatus[] = divisions.map((d) => {
        const publishedInfo = divisionResults[d.id]
        return {
          divisionId: d.id,
          label: d.label,
          position: d.position,
          registrationCount: registrationCountMap.get(d.id) ?? 0,
          scoredCount: 0,
          missingScoreCount: 0,
          resultsPublishedAt: publishedInfo?.publishedAt
            ? new Date(publishedInfo.publishedAt)
            : null,
          isPublished: !!publishedInfo?.publishedAt,
        }
      })

      return {
        divisions: results.sort((a, b) => a.position - b.position),
        publishedCount: results.filter((d) => d.isPublished).length,
        totalCount: results.length,
      }
    }

    // Get all events (track workouts) for this competition
    const events = await db
      .select({id: trackWorkoutsTable.id})
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.trackId, track.id))

    const eventIds = events.map((e) => e.id)
    const totalEvents = eventIds.length

    // Get scored counts per division
    // We need to count unique (userId, divisionId) pairs that have at least one score
    const registrations = await db
      .select({
        id: competitionRegistrationsTable.id,
        userId: competitionRegistrationsTable.userId,
        divisionId: competitionRegistrationsTable.divisionId,
      })
      .from(competitionRegistrationsTable)
      .where(eq(competitionRegistrationsTable.eventId, data.competitionId))

    // For each division, count how many athletes have complete scores (all events)
    const divisionScoreCounts = new Map<
      string,
      {scored: number; missing: number}
    >()

    if (totalEvents > 0 && registrations.length > 0) {
      // Get all scores for this competition's events
      const allScores =
        eventIds.length > 0
          ? await autochunk(
              {items: eventIds, otherParametersCount: 0},
              async (chunk) =>
                db
                  .select({
                    userId: scoresTable.userId,
                    competitionEventId: scoresTable.competitionEventId,
                  })
                  .from(scoresTable)
                  .where(
                    and(
                      inArray(scoresTable.competitionEventId, chunk),
                      isNotNull(scoresTable.scoreValue),
                    ),
                  ),
            )
          : []

      // Build a map of userId -> set of event IDs with scores
      const userScoreMap = new Map<string, Set<string>>()
      for (const score of allScores) {
        if (score.competitionEventId) {
          const existing = userScoreMap.get(score.userId) ?? new Set()
          existing.add(score.competitionEventId)
          userScoreMap.set(score.userId, existing)
        }
      }

      // For each division, count scored vs missing
      for (const division of divisions) {
        const divRegistrations = registrations.filter(
          (r) => r.divisionId === division.id,
        )
        let scoredCount = 0
        let missingCount = 0

        for (const reg of divRegistrations) {
          const userScores = userScoreMap.get(reg.userId) ?? new Set()
          if (userScores.size === totalEvents) {
            scoredCount++
          } else {
            missingCount++
          }
        }

        divisionScoreCounts.set(division.id, {
          scored: scoredCount,
          missing: missingCount,
        })
      }
    } else {
      // No events, all registrations have missing scores
      for (const division of divisions) {
        const count = registrationCountMap.get(division.id) ?? 0
        divisionScoreCounts.set(division.id, {scored: 0, missing: count})
      }
    }

    // Build response with published status from settings
    const divisionResults = settings?.divisionResults ?? {}
    const results: DivisionResultStatus[] = divisions.map((d) => {
      const counts = divisionScoreCounts.get(d.id) ?? {scored: 0, missing: 0}
      const publishedInfo = divisionResults[d.id]

      return {
        divisionId: d.id,
        label: d.label,
        position: d.position,
        registrationCount: registrationCountMap.get(d.id) ?? 0,
        scoredCount: counts.scored,
        missingScoreCount: counts.missing,
        resultsPublishedAt: publishedInfo?.publishedAt
          ? new Date(publishedInfo.publishedAt)
          : null,
        isPublished: !!publishedInfo?.publishedAt,
      }
    })

    return {
      divisions: results.sort((a, b) => a.position - b.position),
      publishedCount: results.filter((d) => d.isPublished).length,
      totalCount: results.length,
    }
  })

/**
 * Publish or unpublish results for a single division
 */
export const publishDivisionResultsFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    publishDivisionResultsInputSchema.parse(data),
  )
  .handler(
    async ({data}): Promise<{success: boolean; publishedAt: Date | null}> => {
      const {getDb} = await import('@/db')
      const {eq} = await import('drizzle-orm')
      const {competitionsTable} = await import('@/db/schemas/competitions')
      const {TEAM_PERMISSIONS} = await import('@/db/schemas/teams')
      const {getSessionFromCookie} = await import('@/utils/auth')

      // Verify authentication
      const session = await getSessionFromCookie()
      if (!session?.userId) {
        throw new Error('Not authenticated')
      }

      // Check permission
      const team = session.teams?.find((t) => t.id === data.organizingTeamId)
      if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING)) {
        throw new Error('Missing required permission')
      }

      const db = getDb()

      // Get competition with settings
      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!competition) {
        throw new Error('Competition not found')
      }

      if (competition.organizingTeamId !== data.organizingTeamId) {
        throw new Error('Competition does not belong to this team')
      }

      // Parse current settings
      const settings = parseCompetitionSettings(competition.settings) ?? {}

      // Update division results status
      const divisionResults = settings.divisionResults ?? {}
      const publishedAt = data.publish ? Date.now() : null

      divisionResults[data.divisionId] = {publishedAt}

      // Save updated settings
      const newSettings = stringifyCompetitionSettings({
        ...settings,
        divisionResults,
      })

      await db
        .update(competitionsTable)
        .set({settings: newSettings, updatedAt: new Date()})
        .where(eq(competitionsTable.id, data.competitionId))

      return {
        success: true,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      }
    },
  )

/**
 * Publish or unpublish results for all divisions at once
 */
export const publishAllDivisionResultsFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    publishAllDivisionResultsInputSchema.parse(data),
  )
  .handler(
    async ({data}): Promise<{success: boolean; updatedCount: number}> => {
      const {getDb} = await import('@/db')
      const {eq} = await import('drizzle-orm')
      const {competitionsTable} = await import('@/db/schemas/competitions')
      const {scalingLevelsTable} = await import('@/db/schemas/scaling')
      const {TEAM_PERMISSIONS} = await import('@/db/schemas/teams')
      const {getSessionFromCookie} = await import('@/utils/auth')

      // Verify authentication
      const session = await getSessionFromCookie()
      if (!session?.userId) {
        throw new Error('Not authenticated')
      }

      // Check permission
      const team = session.teams?.find((t) => t.id === data.organizingTeamId)
      if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_PROGRAMMING)) {
        throw new Error('Missing required permission')
      }

      const db = getDb()

      // Get competition with settings
      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!competition) {
        throw new Error('Competition not found')
      }

      if (competition.organizingTeamId !== data.organizingTeamId) {
        throw new Error('Competition does not belong to this team')
      }

      // Parse current settings
      const settings = parseCompetitionSettings(competition.settings) ?? {}
      const scalingGroupId = settings?.divisions?.scalingGroupId

      if (!scalingGroupId) {
        return {success: true, updatedCount: 0}
      }

      // Get all divisions
      const divisions = await db
        .select({id: scalingLevelsTable.id})
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

      if (divisions.length === 0) {
        return {success: true, updatedCount: 0}
      }

      // Update all divisions at once
      const divisionResults = settings.divisionResults ?? {}
      const publishedAt = data.publish ? Date.now() : null

      for (const division of divisions) {
        divisionResults[division.id] = {publishedAt}
      }

      // Save updated settings
      const newSettings = stringifyCompetitionSettings({
        ...settings,
        divisionResults,
      })

      await db
        .update(competitionsTable)
        .set({settings: newSettings, updatedAt: new Date()})
        .where(eq(competitionsTable.id, data.competitionId))

      return {success: true, updatedCount: divisions.length}
    },
  )
