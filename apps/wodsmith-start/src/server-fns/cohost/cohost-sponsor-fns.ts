/**
 * Cohost Sponsor Server Functions
 * Mirrors sponsor-fns.ts with cohost auth.
 * Allows cohosts to manage competition sponsors and sponsor groups.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { createSponsorGroupId, createSponsorId } from "@/db/schemas/common"
import {
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import type { Sponsor, SponsorGroup } from "@/db/schemas/sponsors"
import { sponsorGroupsTable, sponsorsTable } from "@/db/schemas/sponsors"
import {
  requireCohostCompetitionOwnership,
  requireCohostPermission,
} from "@/utils/cohost-auth"

// ============================================================================
// Types
// ============================================================================

type SponsorGroupWithSponsors = SponsorGroup & {
  sponsors: Sponsor[]
}

type CompetitionSponsorsResult = {
  groups: SponsorGroupWithSponsors[]
  ungroupedSponsors: Sponsor[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const cohostBaseInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostCreateSponsorGroupInputSchema = cohostBaseInputSchema.extend({
  name: z.string().min(1, "Name is required"),
  displayOrder: z.number().int().optional(),
})

const cohostUpdateSponsorGroupInputSchema = cohostBaseInputSchema.extend({
  groupId: z.string().min(1, "Group ID is required"),
  name: z.string().min(1).optional(),
  displayOrder: z.number().int().optional(),
})

const cohostDeleteSponsorGroupInputSchema = cohostBaseInputSchema.extend({
  groupId: z.string().min(1, "Group ID is required"),
})

const cohostReorderSponsorGroupsInputSchema = cohostBaseInputSchema.extend({
  groupIds: z.array(z.string().min(1)),
})

const cohostCreateSponsorInputSchema = cohostBaseInputSchema.extend({
  groupId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  logoUrl: z.string().optional(),
  website: z.string().optional(),
  displayOrder: z.number().int().optional(),
})

const cohostUpdateSponsorInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  sponsorId: z.string().min(1, "Sponsor ID is required"),
  groupId: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
})

const cohostDeleteSponsorInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  sponsorId: z.string().min(1, "Sponsor ID is required"),
})

const cohostReorderSponsorsInputSchema = cohostBaseInputSchema.extend({
  sponsorOrders: z.array(
    z.object({
      sponsorId: z.string().min(1),
      groupId: z.string().nullable(),
      displayOrder: z.number().int(),
    }),
  ),
})

// ============================================================================
// Server Functions - Queries
// ============================================================================

/**
 * Get all sponsors for a competition (cohost view)
 */
export const cohostGetCompetitionSponsorsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostBaseInputSchema.parse(data))
  .handler(async ({ data }): Promise<CompetitionSponsorsResult> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const groups = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorGroupsTable.displayOrder))

    const sponsors = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorsTable.displayOrder))

    const groupsWithSponsors: SponsorGroupWithSponsors[] = groups.map(
      (group) => ({
        ...group,
        sponsors: sponsors.filter((s) => s.groupId === group.id),
      }),
    )

    const ungroupedSponsors = sponsors.filter((s) => s.groupId === null)

    return { groups: groupsWithSponsors, ungroupedSponsors }
  })

/**
 * Get sponsor groups for a competition (cohost view)
 */
export const cohostGetSponsorGroupsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostBaseInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ groups: SponsorGroup[] }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const groups = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorGroupsTable.displayOrder))

    return { groups }
  })

// ============================================================================
// Server Functions - Sponsor Group CRUD
// ============================================================================

/**
 * Create a sponsor group (cohost)
 */
export const cohostCreateSponsorGroupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostCreateSponsorGroupInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ group: SponsorGroup }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    let order = data.displayOrder
    if (order === undefined) {
      const existingGroups = await db
        .select()
        .from(sponsorGroupsTable)
        .where(eq(sponsorGroupsTable.competitionId, data.competitionId))

      order = existingGroups.length
    }

    const groupId = createSponsorGroupId()
    await db.insert(sponsorGroupsTable).values({
      id: groupId,
      competitionId: data.competitionId,
      name: data.name,
      displayOrder: order,
    })

    const [created] = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.id, groupId))

    if (!created) {
      throw new Error("Failed to create sponsor group")
    }

    return { group: created }
  })

/**
 * Update a sponsor group (cohost)
 */
export const cohostUpdateSponsorGroupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateSponsorGroupInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ group: SponsorGroup | null }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

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
      return { group: null }
    }

    await db
      .update(sponsorGroupsTable)
      .set({
        name: data.name ?? existing.name,
        displayOrder: data.displayOrder ?? existing.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(sponsorGroupsTable.id, data.groupId))

    const [updated] = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.id, data.groupId))

    return { group: updated ?? null }
  })

/**
 * Delete a sponsor group (cohost)
 */
export const cohostDeleteSponsorGroupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostDeleteSponsorGroupInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

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
      return { success: true }
    }

    await db
      .delete(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.id, data.groupId))

    return { success: true }
  })

/**
 * Reorder sponsor groups (cohost)
 */
export const cohostReorderSponsorGroupsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostReorderSponsorGroupsInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    await db.transaction(async (tx) => {
      await Promise.all(
        data.groupIds.map((groupId, i) => {
          if (!groupId) return Promise.resolve()
          return tx
            .update(sponsorGroupsTable)
            .set({ displayOrder: i, updatedAt: new Date() })
            .where(
              and(
                eq(sponsorGroupsTable.id, groupId),
                eq(sponsorGroupsTable.competitionId, data.competitionId),
              ),
            )
        }),
      )
    })

    return { success: true }
  })

// ============================================================================
// Server Functions - Sponsor CRUD
// ============================================================================

/**
 * Create a sponsor (cohost)
 */
export const cohostCreateSponsorFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostCreateSponsorInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ sponsor: Sponsor }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    let order = data.displayOrder
    if (order === undefined) {
      const existingSponsors = await db
        .select()
        .from(sponsorsTable)
        .where(eq(sponsorsTable.competitionId, data.competitionId))

      order = existingSponsors.length
    }

    const sponsorId = createSponsorId()
    await db.insert(sponsorsTable).values({
      id: sponsorId,
      competitionId: data.competitionId,
      userId: null,
      groupId: data.groupId ?? null,
      name: data.name,
      logoUrl: data.logoUrl ?? null,
      website: data.website ?? null,
      displayOrder: order,
    })

    const [created] = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.id, sponsorId))

    if (!created) {
      throw new Error("Failed to create sponsor")
    }

    return { sponsor: created }
  })

/**
 * Update a sponsor (cohost)
 */
export const cohostUpdateSponsorFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateSponsorInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ sponsor: Sponsor | null }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const [existing] = await db
      .select()
      .from(sponsorsTable)
      .where(
        and(
          eq(sponsorsTable.id, data.sponsorId),
          eq(sponsorsTable.competitionId, data.competitionId),
        ),
      )

    if (!existing) {
      return { sponsor: null }
    }

    await db
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

    const [updated] = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.id, data.sponsorId))

    return { sponsor: updated ?? null }
  })

/**
 * Delete a sponsor (cohost)
 */
export const cohostDeleteSponsorFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostDeleteSponsorInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const [existing] = await db
      .select()
      .from(sponsorsTable)
      .where(
        and(
          eq(sponsorsTable.id, data.sponsorId),
          eq(sponsorsTable.competitionId, data.competitionId),
        ),
      )

    if (!existing) {
      return { success: true }
    }

    // Clear any workout sponsor references
    await db
      .update(trackWorkoutsTable)
      .set({ sponsorId: null, updatedAt: new Date() })
      .where(eq(trackWorkoutsTable.sponsorId, data.sponsorId))

    await db.delete(sponsorsTable).where(eq(sponsorsTable.id, data.sponsorId))

    return { success: true }
  })

/**
 * Reorder sponsors (cohost)
 */
export const cohostReorderSponsorsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostReorderSponsorsInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireCohostPermission(data.competitionTeamId, "sponsors")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    await db.transaction(async (tx) => {
      await Promise.all(
        data.sponsorOrders.map(({ sponsorId, groupId, displayOrder }) =>
          tx
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
            ),
        ),
      )
    })

    return { success: true }
  })
