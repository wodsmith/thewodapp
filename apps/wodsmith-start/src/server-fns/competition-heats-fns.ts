/**
 * Competition Heats Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-heats.ts
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  competitionHeatsTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationsTable,
  competitionVenuesTable,
  type CompetitionHeat,
  type CompetitionVenue,
} from '@/db/schemas/competitions'
import {scalingLevelsTable} from '@/db/schemas/scaling'
import {userTable} from '@/db/schemas/users'
import {eq, asc, inArray} from 'drizzle-orm'
import {chunk, SQL_BATCH_SIZE} from '@/utils/batch-query'

const BATCH_SIZE = SQL_BATCH_SIZE

// ============================================================================
// Types
// ============================================================================

export interface HeatWithAssignments extends CompetitionHeat {
  venue: CompetitionVenue | null
  division: {id: string; label: string} | null
  assignments: Array<{
    id: string
    laneNumber: number
    registration: {
      id: string
      teamName: string | null
      user: {id: string; firstName: string | null; lastName: string | null}
      division: {id: string; label: string} | null
      affiliate: string | null
    }
  }>
}

// ============================================================================
// Metadata Parsing
// ============================================================================

const registrationMetadataSchema = z
  .object({
    affiliates: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

/**
 * Extract affiliate from registration metadata with runtime validation
 */
function getAffiliate(metadata: string | null, userId: string): string | null {
  if (!metadata) return null
  try {
    const result = registrationMetadataSchema.safeParse(JSON.parse(metadata))
    if (!result.success) return null
    return result.data.affiliates?.[userId] ?? null
  } catch {
    return null
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const getHeatsForCompetitionInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all heats for a competition (full schedule)
 * Returns heats with assignments, sorted by scheduled time and heat number
 */
export const getHeatsForCompetitionFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getHeatsForCompetitionInputSchema.parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const heats = await db
      .select()
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, data.competitionId))
      .orderBy(
        asc(competitionHeatsTable.scheduledTime),
        asc(competitionHeatsTable.heatNumber),
      )

    if (heats.length === 0) {
      return {heats: []}
    }

    // Get venue IDs and division IDs
    const venueIds = heats
      .map((h) => h.venueId)
      .filter((id): id is string => id !== null)
    const divisionIds = heats
      .map((h) => h.divisionId)
      .filter((id): id is string => id !== null)

    // Fetch venues
    const venues =
      venueIds.length > 0
        ? await db
            .select()
            .from(competitionVenuesTable)
            .where(inArray(competitionVenuesTable.id, venueIds))
        : []
    const venueMap = new Map(venues.map((v) => [v.id, v]))

    // Fetch divisions
    const divisions =
      divisionIds.length > 0
        ? await db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
            })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, divisionIds))
        : []
    const divisionMap = new Map(divisions.map((d) => [d.id, d]))

    // Fetch assignments in batches to avoid SQLite variable limit
    const heatIds = heats.map((h) => h.id)
    const assignmentBatches = await Promise.all(
      chunk(heatIds, BATCH_SIZE).map((batch) =>
        db
          .select({
            id: competitionHeatAssignmentsTable.id,
            heatId: competitionHeatAssignmentsTable.heatId,
            laneNumber: competitionHeatAssignmentsTable.laneNumber,
            registrationId: competitionHeatAssignmentsTable.registrationId,
          })
          .from(competitionHeatAssignmentsTable)
          .where(inArray(competitionHeatAssignmentsTable.heatId, batch))
          .orderBy(asc(competitionHeatAssignmentsTable.laneNumber)),
      ),
    )
    const assignments = assignmentBatches.flat()

    // Fetch registrations in batches
    const registrationIds = [
      ...new Set(assignments.map((a) => a.registrationId)),
    ]
    const registrationBatches =
      registrationIds.length > 0
        ? await Promise.all(
            chunk(registrationIds, BATCH_SIZE).map((batch) =>
              db
                .select({
                  id: competitionRegistrationsTable.id,
                  teamName: competitionRegistrationsTable.teamName,
                  userId: competitionRegistrationsTable.userId,
                  divisionId: competitionRegistrationsTable.divisionId,
                  metadata: competitionRegistrationsTable.metadata,
                })
                .from(competitionRegistrationsTable)
                .where(inArray(competitionRegistrationsTable.id, batch)),
            ),
          )
        : []
    const registrations = registrationBatches.flat()

    // Fetch users in batches
    const userIds = [...new Set(registrations.map((r) => r.userId))]
    const userBatches =
      userIds.length > 0
        ? await Promise.all(
            chunk(userIds, BATCH_SIZE).map((batch) =>
              db
                .select({
                  id: userTable.id,
                  firstName: userTable.firstName,
                  lastName: userTable.lastName,
                })
                .from(userTable)
                .where(inArray(userTable.id, batch)),
            ),
          )
        : []
    const users = userBatches.flat()
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Fetch divisions for registrations in batches
    const regDivisionIds = [
      ...new Set(
        registrations
          .map((r) => r.divisionId)
          .filter((id): id is string => id !== null),
      ),
    ]
    const regDivBatches =
      regDivisionIds.length > 0
        ? await Promise.all(
            chunk(regDivisionIds, BATCH_SIZE).map((batch) =>
              db
                .select({
                  id: scalingLevelsTable.id,
                  label: scalingLevelsTable.label,
                })
                .from(scalingLevelsTable)
                .where(inArray(scalingLevelsTable.id, batch)),
            ),
          )
        : []
    const regDivisions = regDivBatches.flat()
    const regDivisionMap = new Map(regDivisions.map((d) => [d.id, d]))

    // Build registration map
    const registrationMap = new Map(
      registrations.map((r) => [
        r.id,
        {
          id: r.id,
          teamName: r.teamName,
          user: userMap.get(r.userId) ?? {
            id: r.userId,
            firstName: null,
            lastName: null,
          },
          division: r.divisionId
            ? (regDivisionMap.get(r.divisionId) ?? null)
            : null,
          affiliate: getAffiliate(r.metadata, r.userId),
        },
      ]),
    )

    // Group assignments by heat
    const assignmentsByHeat = new Map<string, typeof assignments>()
    for (const assignment of assignments) {
      const existing = assignmentsByHeat.get(assignment.heatId) ?? []
      existing.push(assignment)
      assignmentsByHeat.set(assignment.heatId, existing)
    }

    // Build result
    const heatsWithAssignments: HeatWithAssignments[] = heats.map((heat) => ({
      ...heat,
      venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
      division: heat.divisionId
        ? (divisionMap.get(heat.divisionId) ?? null)
        : null,
      assignments: (assignmentsByHeat.get(heat.id) ?? []).map((a) => ({
        id: a.id,
        laneNumber: a.laneNumber,
        registration: registrationMap.get(a.registrationId) ?? {
          id: a.registrationId,
          teamName: null,
          user: {id: '', firstName: null, lastName: null},
          division: null,
          affiliate: null,
        },
      })),
    }))

    return {heats: heatsWithAssignments}
  })
