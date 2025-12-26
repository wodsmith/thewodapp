/**
 * Judge Scheduling Server Functions for TanStack Start
 * Stub implementation - full functionality to be migrated later
 */

import {createServerFn} from '@tanstack/react-start'
import {and, eq} from 'drizzle-orm'
import {z} from 'zod'
import {getDb} from '@/db'
import {
  competitionJudgeRotationsTable,
  judgeAssignmentVersionsTable,
  SYSTEM_ROLES_ENUM,
  teamMembershipTable,
} from '@/db/schema'
import type {VolunteerMembershipMetadata} from '@/db/schemas/volunteers'

// ============================================================================
// Types
// ============================================================================

export interface JudgeVolunteerInfo {
  membershipId: string
  userId: string
  firstName: string | null
  lastName: string | null
  avatar: string | null
  availability: string | null
  credentials: string | null
}

export interface JudgeHeatAssignment {
  id: string
  heatId: string
  membershipId: string
  laneNumber: number
  rotationId: string | null
  createdAt: Date
  volunteer?: JudgeVolunteerInfo
}

// ============================================================================
// Input Schemas
// ============================================================================

const competitionTeamIdSchema = z
  .string()
  .startsWith('team_', 'Invalid team ID')

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all volunteers with judge role type for a competition team
 */
export const getJudgeVolunteersFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z.object({competitionTeamId: competitionTeamIdSchema}).parse(data),
  )
  .handler(async ({data}): Promise<JudgeVolunteerInfo[]> => {
    const db = getDb()

    // Get all volunteer memberships for this team with user relation
    const membershipsRaw = await db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.teamId, data.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, 1),
      ),
      with: {
        user: true,
      },
    })

    // Cast to include user relation
    type MembershipWithUser = (typeof membershipsRaw)[number] & {
      user: {
        firstName: string | null
        lastName: string | null
        avatar: string | null
      } | null
    }
    const memberships = membershipsRaw as unknown as MembershipWithUser[]

    // Filter to only those with judge role type
    const judges: JudgeVolunteerInfo[] = []

    for (const membership of memberships) {
      if (!membership.metadata) continue

      try {
        const metadata = JSON.parse(
          membership.metadata,
        ) as VolunteerMembershipMetadata
        const roleTypes = metadata.volunteerRoleTypes ?? []

        // Check if they have judge or head_judge role
        if (roleTypes.includes('judge') || roleTypes.includes('head_judge')) {
          judges.push({
            membershipId: membership.id,
            userId: membership.userId,
            firstName: membership.user?.firstName ?? null,
            lastName: membership.user?.lastName ?? null,
            avatar: membership.user?.avatar ?? null,
            availability: metadata.availability ?? null,
            credentials: metadata.credentials ?? null,
          })
        }
      } catch {
        // Invalid metadata, skip
      }
    }

    return judges
  })

/**
 * Get judge heat assignments for an event
 * Stub implementation - returns empty array for now
 */
export const getJudgeHeatAssignmentsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z.object({eventId: z.string()}).parse(data),
  )
  .handler(async (): Promise<JudgeHeatAssignment[]> => {
    // TODO: Implement full query with heat -> assignment join
    return []
  })

/**
 * Get rotations for an event
 */
export const getRotationsForEventFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z.object({eventId: z.string()}).parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    const rotations = await db.query.competitionJudgeRotationsTable.findMany({
      where: eq(competitionJudgeRotationsTable.trackWorkoutId, data.eventId),
      orderBy: (table, {asc}) => [asc(table.startingHeat)],
    })

    // Get event defaults from the first rotation (they're stored per-event)
    const eventDefaults = {
      defaultHeatsCount: rotations[0]?.heatsCount ?? null,
      defaultLaneShiftPattern: rotations[0]?.laneShiftPattern ?? null,
      minHeatBuffer: null as number | null,
    }

    return {
      rotations,
      eventDefaults,
    }
  })

/**
 * Get version history for an event
 */
export const getVersionHistoryFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z.object({eventId: z.string()}).parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    return db.query.judgeAssignmentVersionsTable.findMany({
      where: eq(judgeAssignmentVersionsTable.trackWorkoutId, data.eventId),
      orderBy: (table, {desc}) => [desc(table.version)],
    })
  })

/**
 * Get active version for an event
 */
export const getActiveVersionFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z.object({eventId: z.string()}).parse(data),
  )
  .handler(async ({data}) => {
    const db = getDb()

    return db.query.judgeAssignmentVersionsTable.findFirst({
      where: and(
        eq(judgeAssignmentVersionsTable.trackWorkoutId, data.eventId),
        eq(judgeAssignmentVersionsTable.isActive, true),
      ),
    })
  })
