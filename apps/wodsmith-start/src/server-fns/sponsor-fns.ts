/**
 * Sponsor Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/sponsors.ts
 */

import {createServerFn} from '@tanstack/react-start'
import {and, asc, eq} from 'drizzle-orm'
import {z} from 'zod'
import {getDb} from '@/db'
import {competitionsTable} from '@/db/schemas/competitions'
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from '@/db/schemas/programming'
import type {Sponsor, SponsorGroup} from '@/db/schemas/sponsors'
import {sponsorGroupsTable, sponsorsTable} from '@/db/schemas/sponsors'
import {TEAM_PERMISSIONS} from '@/db/schemas/teams'
import {getSessionFromCookie} from '@/utils/auth'

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if user has permission for a team
 */
async function hasTeamPermission(
  teamId: string,
  permission: string,
): Promise<boolean> {
  const session = await getSessionFromCookie()
  if (!session?.userId) return false

  const team = session.teams?.find((t) => t.id === teamId)
  if (!team) return false

  return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
  teamId: string,
  permission: string,
): Promise<void> {
  const hasPermission = await hasTeamPermission(teamId, permission)
  if (!hasPermission) {
    throw new Error(`Missing required permission: ${permission}`)
  }
}

// ============================================================================
// Types
// ============================================================================

export type SponsorGroupWithSponsors = SponsorGroup & {
  sponsors: Sponsor[]
}

export type CompetitionSponsorsResult = {
  groups: SponsorGroupWithSponsors[]
  ungroupedSponsors: Sponsor[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionSponsorsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
})

const getSponsorInputSchema = z.object({
  sponsorId: z.string().min(1, 'Sponsor ID is required'),
})

const getUserSponsorsInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

const getCompetitionSponsorGroupsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
})

const createSponsorGroupInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  name: z.string().min(1, 'Name is required'),
  displayOrder: z.number().int().optional(),
})

const updateSponsorGroupInputSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  competitionId: z.string().min(1, 'Competition ID is required'),
  name: z.string().min(1).optional(),
  displayOrder: z.number().int().optional(),
})

const deleteSponsorGroupInputSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  competitionId: z.string().min(1, 'Competition ID is required'),
})

const reorderSponsorGroupsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  groupIds: z.array(z.string().min(1)),
})

const createSponsorInputSchema = z.object({
  competitionId: z.string().optional(),
  userId: z.string().optional(),
  groupId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  logoUrl: z.string().optional(),
  website: z.string().optional(),
  displayOrder: z.number().int().optional(),
})

const updateSponsorInputSchema = z.object({
  sponsorId: z.string().min(1, 'Sponsor ID is required'),
  groupId: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
})

const deleteSponsorInputSchema = z.object({
  sponsorId: z.string().min(1, 'Sponsor ID is required'),
})

const reorderSponsorsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  sponsorOrders: z.array(
    z.object({
      sponsorId: z.string().min(1),
      groupId: z.string().nullable(),
      displayOrder: z.number().int(),
    }),
  ),
})

const assignWorkoutSponsorInputSchema = z.object({
  trackWorkoutId: z.string().min(1, 'Track workout ID is required'),
  competitionId: z.string().min(1, 'Competition ID is required'),
  sponsorId: z.string().nullable(),
})

// ============================================================================
// Server Functions - Queries
// ============================================================================

/**
 * Get a single sponsor by ID
 */
export const getSponsorFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => getSponsorInputSchema.parse(data))
  .handler(async ({data}): Promise<{sponsor: Sponsor | null}> => {
    const db = getDb()

    const [sponsor] = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.id, data.sponsorId))

    return {sponsor: sponsor ?? null}
  })

/**
 * Get all sponsors for a competition, organized by groups
 */
export const getCompetitionSponsorsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getCompetitionSponsorsInputSchema.parse(data),
  )
  .handler(async ({data}): Promise<CompetitionSponsorsResult> => {
    const db = getDb()

    // Get all sponsor groups for this competition
    const groups = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorGroupsTable.displayOrder))

    // Get all sponsors for this competition
    const sponsors = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorsTable.displayOrder))

    // Organize sponsors by group
    const groupsWithSponsors: SponsorGroupWithSponsors[] = groups.map(
      (group) => ({
        ...group,
        sponsors: sponsors.filter((s) => s.groupId === group.id),
      }),
    )

    // Get ungrouped sponsors
    const ungroupedSponsors = sponsors.filter((s) => s.groupId === null)

    return {
      groups: groupsWithSponsors,
      ungroupedSponsors,
    }
  })

/**
 * Get all sponsor groups for a competition
 */
export const getCompetitionSponsorGroupsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getCompetitionSponsorGroupsInputSchema.parse(data),
  )
  .handler(async ({data}): Promise<{groups: SponsorGroup[]}> => {
    const db = getDb()

    const groups = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorGroupsTable.displayOrder))

    return {groups}
  })

/**
 * Get all sponsors for a user (athlete sponsors)
 */
export const getUserSponsorsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) => getUserSponsorsInputSchema.parse(data))
  .handler(async ({data}): Promise<{sponsors: Sponsor[]}> => {
    const db = getDb()

    const sponsors = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.userId, data.userId))
      .orderBy(asc(sponsorsTable.displayOrder))

    return {sponsors}
  })

// ============================================================================
// Server Functions - Sponsor Group CRUD
// ============================================================================

/**
 * Create a sponsor group
 */
export const createSponsorGroupFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => createSponsorGroupInputSchema.parse(data))
  .handler(async ({data}): Promise<{group: SponsorGroup}> => {
    const db = getDb()

    // Get competition to find organizing team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error('Competition not found')
    }

    // Check permission
    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // If no displayOrder provided, put at end
    let order = data.displayOrder
    if (order === undefined) {
      const existingGroups = await db
        .select()
        .from(sponsorGroupsTable)
        .where(eq(sponsorGroupsTable.competitionId, data.competitionId))

      order = existingGroups.length
    }

    const [created] = await db
      .insert(sponsorGroupsTable)
      .values({
        competitionId: data.competitionId,
        name: data.name,
        displayOrder: order,
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create sponsor group')
    }

    return {group: created}
  })

/**
 * Update a sponsor group
 */
export const updateSponsorGroupFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => updateSponsorGroupInputSchema.parse(data))
  .handler(async ({data}): Promise<{group: SponsorGroup | null}> => {
    const db = getDb()

    // Get competition to find organizing team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error('Competition not found')
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Verify group belongs to competition
    const [existing] = await db
      .select()
      .from(sponsorGroupsTable)
      .where(
        and(
          eq(sponsorGroupsTable.id, data.groupId),
          eq(sponsorGroupsTable.competitionId, data.competitionId),
        ),
      )

    if (!existing) {
      return {group: null}
    }

    const [updated] = await db
      .update(sponsorGroupsTable)
      .set({
        name: data.name ?? existing.name,
        displayOrder: data.displayOrder ?? existing.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(sponsorGroupsTable.id, data.groupId))
      .returning()

    return {group: updated ?? null}
  })

/**
 * Delete a sponsor group
 * Sponsors in the group become ungrouped (groupId set to null via FK)
 */
export const deleteSponsorGroupFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => deleteSponsorGroupInputSchema.parse(data))
  .handler(async ({data}): Promise<{success: boolean; error?: string}> => {
    const db = getDb()

    // Get competition to find organizing team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      return {success: false, error: 'Competition not found'}
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Verify group belongs to competition
    const [existing] = await db
      .select()
      .from(sponsorGroupsTable)
      .where(
        and(
          eq(sponsorGroupsTable.id, data.groupId),
          eq(sponsorGroupsTable.competitionId, data.competitionId),
        ),
      )

    if (!existing) {
      return {success: true} // Already deleted
    }

    await db
      .delete(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.id, data.groupId))

    return {success: true}
  })

/**
 * Reorder sponsor groups
 */
export const reorderSponsorGroupsFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    reorderSponsorGroupsInputSchema.parse(data),
  )
  .handler(async ({data}): Promise<{success: boolean}> => {
    const db = getDb()

    // Get competition to find organizing team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error('Competition not found')
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Update each group's displayOrder
    for (let i = 0; i < data.groupIds.length; i++) {
      const groupId = data.groupIds[i]
      if (!groupId) continue

      await db
        .update(sponsorGroupsTable)
        .set({displayOrder: i, updatedAt: new Date()})
        .where(
          and(
            eq(sponsorGroupsTable.id, groupId),
            eq(sponsorGroupsTable.competitionId, data.competitionId),
          ),
        )
    }

    return {success: true}
  })

// ============================================================================
// Server Functions - Sponsor CRUD
// ============================================================================

/**
 * Create a sponsor (competition or user)
 */
export const createSponsorFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => createSponsorInputSchema.parse(data))
  .handler(async ({data}): Promise<{sponsor: Sponsor}> => {
    const db = getDb()

    // Validate one of competitionId or userId is set
    if (!data.competitionId && !data.userId) {
      throw new Error('Either competitionId or userId is required')
    }

    // For competition sponsors, check permission
    if (data.competitionId) {
      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))

      if (!competition) {
        throw new Error('Competition not found')
      }

      await requireTeamPermission(
        competition.organizingTeamId,
        TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
      )
    }

    // If no displayOrder, put at end
    let order = data.displayOrder
    if (order === undefined) {
      const existingSponsors = await db
        .select()
        .from(sponsorsTable)
        .where(
          data.competitionId
            ? eq(sponsorsTable.competitionId, data.competitionId)
            : eq(sponsorsTable.userId, data.userId as string),
        )

      order = existingSponsors.length
    }

    const [created] = await db
      .insert(sponsorsTable)
      .values({
        competitionId: data.competitionId ?? null,
        userId: data.userId ?? null,
        groupId: data.groupId ?? null,
        name: data.name,
        logoUrl: data.logoUrl ?? null,
        website: data.website ?? null,
        displayOrder: order,
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create sponsor')
    }

    return {sponsor: created}
  })

/**
 * Update a sponsor
 */
export const updateSponsorFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => updateSponsorInputSchema.parse(data))
  .handler(async ({data}): Promise<{sponsor: Sponsor | null}> => {
    const db = getDb()

    // Get existing sponsor
    const [existing] = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.id, data.sponsorId))

    if (!existing) {
      return {sponsor: null}
    }

    // Verify authorization
    if (existing.competitionId) {
      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, existing.competitionId))

      if (competition) {
        await requireTeamPermission(
          competition.organizingTeamId,
          TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
        )
      }
    }
    // For user sponsors, authorization is checked at action level

    const [updated] = await db
      .update(sponsorsTable)
      .set({
        groupId: data.groupId === undefined ? existing.groupId : data.groupId,
        name: data.name ?? existing.name,
        logoUrl: data.logoUrl === undefined ? existing.logoUrl : data.logoUrl,
        website: data.website === undefined ? existing.website : data.website,
        displayOrder: data.displayOrder ?? existing.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(sponsorsTable.id, data.sponsorId))
      .returning()

    return {sponsor: updated ?? null}
  })

/**
 * Delete a sponsor
 */
export const deleteSponsorFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => deleteSponsorInputSchema.parse(data))
  .handler(async ({data}): Promise<{success: boolean; error?: string}> => {
    const db = getDb()

    // Get existing sponsor
    const [existing] = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.id, data.sponsorId))

    if (!existing) {
      return {success: true} // Already deleted
    }

    // Verify authorization
    if (existing.competitionId) {
      const [competition] = await db
        .select()
        .from(competitionsTable)
        .where(eq(competitionsTable.id, existing.competitionId))

      if (competition) {
        await requireTeamPermission(
          competition.organizingTeamId,
          TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
        )
      }
    }

    // Clear any workout sponsor references first
    await db
      .update(trackWorkoutsTable)
      .set({sponsorId: null, updatedAt: new Date()})
      .where(eq(trackWorkoutsTable.sponsorId, data.sponsorId))

    await db.delete(sponsorsTable).where(eq(sponsorsTable.id, data.sponsorId))

    return {success: true}
  })

/**
 * Reorder sponsors within a competition (can move between groups)
 */
export const reorderSponsorsFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => reorderSponsorsInputSchema.parse(data))
  .handler(async ({data}): Promise<{success: boolean}> => {
    const db = getDb()

    // Get competition to find organizing team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error('Competition not found')
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Update each sponsor
    for (const {sponsorId, groupId, displayOrder} of data.sponsorOrders) {
      await db
        .update(sponsorsTable)
        .set({
          groupId,
          displayOrder,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sponsorsTable.id, sponsorId),
            eq(sponsorsTable.competitionId, data.competitionId),
          ),
        )
    }

    return {success: true}
  })

// ============================================================================
// Server Functions - Workout Sponsor Assignment
// ============================================================================

/**
 * Assign a sponsor to a track workout ("Presented by")
 */
export const assignWorkoutSponsorFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) =>
    assignWorkoutSponsorInputSchema.parse(data),
  )
  .handler(async ({data}): Promise<{success: boolean; error?: string}> => {
    const db = getDb()

    // Get competition to find organizing team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      return {success: false, error: 'Competition not found'}
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Verify the track workout belongs to this competition
    const [trackWorkout] = await db
      .select({id: trackWorkoutsTable.id})
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(
        and(
          eq(trackWorkoutsTable.id, data.trackWorkoutId),
          eq(programmingTracksTable.competitionId, data.competitionId),
        ),
      )

    if (!trackWorkout) {
      return {
        success: false,
        error: 'Track workout not found for this competition',
      }
    }

    // If assigning a sponsor, verify it belongs to this competition
    if (data.sponsorId) {
      const [sponsor] = await db
        .select()
        .from(sponsorsTable)
        .where(
          and(
            eq(sponsorsTable.id, data.sponsorId),
            eq(sponsorsTable.competitionId, data.competitionId),
          ),
        )

      if (!sponsor) {
        return {
          success: false,
          error: 'Sponsor not found for this competition',
        }
      }
    }

    await db
      .update(trackWorkoutsTable)
      .set({sponsorId: data.sponsorId, updatedAt: new Date()})
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    return {success: true}
  })

/**
 * Get the sponsor assigned to a track workout ("Presented by")
 */
export const getWorkoutSponsorFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    z.object({trackWorkoutId: z.string().min(1)}).parse(data),
  )
  .handler(async ({data}): Promise<{sponsor: Sponsor | null}> => {
    const db = getDb()

    const [trackWorkout] = await db
      .select({sponsorId: trackWorkoutsTable.sponsorId})
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

    if (!trackWorkout?.sponsorId) {
      return {sponsor: null}
    }

    // Get the sponsor
    const [sponsor] = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.id, trackWorkout.sponsorId))

    return {sponsor: sponsor ?? null}
  })

// ============================================================================
// Server Functions - Athlete Sponsors Page
// ============================================================================

/**
 * Get sponsors data for athlete sponsors page
 */
export const getSponsorsPageDataFn = createServerFn({method: 'GET'}).handler(
  async () => {
    const {redirect} = await import('@tanstack/react-router')
    const session = await getSessionFromCookie()
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: {redirect: '/compete/athlete/sponsors'},
      })
    }

    const result = await getUserSponsorsFn({data: {userId: session.userId}})

    return {
      sponsors: result.sponsors,
      userId: session.userId,
    }
  },
)
