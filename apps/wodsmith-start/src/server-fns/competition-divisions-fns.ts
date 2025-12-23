/**
 * Competition Divisions Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-divisions.ts
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  competitionsTable,
  competitionRegistrationsTable,
} from '@/db/schemas/competitions'
import {scalingLevelsTable} from '@/db/schemas/scaling'
import {eq, and, sql} from 'drizzle-orm'

// ============================================================================
// Types
// ============================================================================

/**
 * Parse competition settings from JSON string
 */
function parseCompetitionSettings(settings: string | null): {
  divisions?: {scalingGroupId?: string}
} | null {
  if (!settings) return null
  try {
    return JSON.parse(settings)
  } catch {
    return null
  }
}

export interface PublicCompetitionDivision {
  id: string
  label: string
  description: string | null
  registrationCount: number
  feeCents: number
  teamSize: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPublicCompetitionDivisionsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get divisions for public competition display
 * Returns divisions with descriptions and registration counts
 * Used by competition details page
 */
export const getPublicCompetitionDivisionsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getPublicCompetitionDivisionsInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    // Get competition with settings
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    if (!competition) {
      return {divisions: []}
    }

    const settings = parseCompetitionSettings(competition.settings)
    const scalingGroupId = settings?.divisions?.scalingGroupId

    if (!scalingGroupId) {
      return {divisions: []}
    }

    // Get divisions with registration counts
    // Note: In wodsmith-start we don't have competitionDivisionsTable yet,
    // so we'll return a simplified version without descriptions and fees
    const divisions = await db
      .select({
        id: scalingLevelsTable.id,
        label: scalingLevelsTable.label,
        teamSize: scalingLevelsTable.teamSize,
        position: scalingLevelsTable.position,
        registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as integer)`,
      })
      .from(scalingLevelsTable)
      .leftJoin(
        competitionRegistrationsTable,
        and(
          eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
        ),
      )
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
      .groupBy(scalingLevelsTable.id)
      .orderBy(scalingLevelsTable.position)

    // Apply default fee from competition
    const result: PublicCompetitionDivision[] = divisions.map((d) => ({
      id: d.id,
      label: d.label,
      description: null, // TODO: Add competitionDivisionsTable support
      registrationCount: d.registrationCount,
      feeCents: competition.defaultRegistrationFeeCents ?? 0,
      teamSize: d.teamSize,
    }))

    return {divisions: result}
  })
