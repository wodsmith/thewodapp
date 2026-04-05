/**
 * Cohost Division Server Functions
 * Mirrors competition-divisions-fns.ts with cohost auth.
 * Provides READ + WRITE access to divisions for the cohost dashboard.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, count, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { type Database, getDb } from "@/db"
import {
  competitionDivisionsTable,
} from "@/db/schemas/commerce"
import { createScalingGroupId, createScalingLevelId } from "@/db/schemas/common"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import { seriesDivisionMappingsTable } from "@/db/schemas/series"
import { requireCohostCompetitionOwnership, requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Types
// ============================================================================

export interface CohostDivisionWithCounts {
  id: string
  label: string
  position: number
  registrationCount: number
  description: string | null
  feeCents: number | null
  maxSpots: number | null
  teamSize: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const cohostDivisionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostScalingGroupInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  scalingGroupId: z.string().min(1, "Scaling Group ID is required"),
})

const cohostAddDivisionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  label: z.string().min(1, "Division name is required").max(100),
  teamSize: z.number().int().min(1).max(10).default(1),
})

const cohostUpdateDivisionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  label: z.string().min(1, "Division name is required").max(100),
})

const cohostDeleteDivisionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
})

const cohostReorderDivisionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  orderedDivisionIds: z.array(z.string()).min(1, "Division IDs are required"),
})

const cohostUpdateDescriptionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  description: z.string().max(2000).nullable(),
})

const cohostUpdateCapacityInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  maxSpots: z.number().int().min(1).nullable(),
})

const cohostInitializeDivisionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  templateGroupId: z.string().optional(),
  templateDivisionIds: z.array(z.string()).optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

function parseCompetitionSettings(settings: string | null): {
  divisions?: { scalingGroupId?: string }
  [key: string]: unknown
} | null {
  if (!settings) return null
  try {
    return JSON.parse(settings)
  } catch {
    return null
  }
}

function stringifyCompetitionSettings(
  settings: {
    divisions?: { scalingGroupId?: string }
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

/**
 * Create a scaling group for competition divisions
 */
async function createScalingGroup({
  teamId,
  title,
  description,
  tx,
}: {
  teamId: string
  title: string
  description?: string | null
  tx?: Database
}) {
  const db = tx ?? getDb()

  const id = createScalingGroupId()

  await db.insert(scalingGroupsTable).values({
    id,
    title,
    description: description ?? null,
    teamId,
    isDefault: false,
    isSystem: false,
  })

  const created = await db.query.scalingGroupsTable.findFirst({
    where: eq(scalingGroupsTable.id, id),
  })

  if (!created) {
    throw new Error("Failed to create scaling group")
  }

  return created
}

/**
 * Create a scaling level (division)
 */
async function createScalingLevel({
  scalingGroupId,
  label,
  position,
  teamSize = 1,
  tx,
}: {
  scalingGroupId: string
  label: string
  position?: number
  teamSize?: number
  tx?: Database
}) {
  const db = tx ?? getDb()

  let newPosition = position
  if (newPosition === undefined || newPosition === null) {
    const result = (await db
      .select({ maxPos: sql<number>`max(${scalingLevelsTable.position})` })
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))) as Array<{
      maxPos: number | null
    }>
    const maxPos = result[0]?.maxPos ?? null
    newPosition = (maxPos ?? -1) + 1
  }

  const id = createScalingLevelId()

  await db.insert(scalingLevelsTable).values({
    id,
    scalingGroupId,
    label,
    position: newPosition,
    teamSize,
  })

  const created = await db.query.scalingLevelsTable.findFirst({
    where: eq(scalingLevelsTable.id, id),
  })

  if (!created) {
    throw new Error("Failed to create scaling level")
  }
  return created
}

/**
 * List scaling levels for a scaling group
 */
async function listScalingLevels({
  scalingGroupId,
}: {
  scalingGroupId: string
}) {
  const db = getDb()
  const rows = await db
    .select()
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
    .orderBy(asc(scalingLevelsTable.position))
  return rows
}

/**
 * Check if a scaling group is owned by a competition
 */
async function isCompetitionOwnedScalingGroup({
  competitionId,
  scalingGroupId,
}: {
  competitionId: string
  scalingGroupId: string
}): Promise<boolean> {
  const db = getDb()

  const [competition] = await db
    .select()
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))

  if (!competition) return false

  const settings = parseCompetitionSettings(competition.settings)
  if (settings?.divisions?.scalingGroupId !== scalingGroupId) {
    return false
  }

  const [group] = await db
    .select()
    .from(scalingGroupsTable)
    .where(eq(scalingGroupsTable.id, scalingGroupId))

  if (!group) return false

  return (
    group.teamId === competition.organizingTeamId &&
    group.title.includes("Divisions")
  )
}

/**
 * Ensure competition has its own scaling group (clone if needed).
 * Cohost variant: uses requireCohostPermission instead of requireTeamPermission,
 * and does not check organizingTeamId ownership.
 */
async function ensureCohostOwnedScalingGroup({
  competitionId,
  competitionTeamId,
}: {
  competitionId: string
  competitionTeamId: string
}): Promise<{ scalingGroupId: string; wasCloned: boolean }> {
  const db = getDb()
  await requireCohostPermission(competitionTeamId, "divisions")

  const [competition] = await db
    .select()
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))

  if (!competition) {
    throw new Error("Competition not found")
  }

  const settings = parseCompetitionSettings(competition.settings)
  const currentGroupId = settings?.divisions?.scalingGroupId

  if (!currentGroupId) {
    // No divisions yet - create empty group with defaults (atomic)
    const newGroupId = await db.transaction(async (tx) => {
      const newGroup = await createScalingGroup({
        teamId: competition.organizingTeamId,
        title: `${competition.name} Divisions`,
        description: `Divisions for ${competition.name}`,
        tx,
      })

      if (!newGroup) {
        throw new Error("Failed to create scaling group")
      }

      await createScalingLevel({
        scalingGroupId: newGroup.id,
        label: "Open",
        position: 0,
        tx,
      })
      await createScalingLevel({
        scalingGroupId: newGroup.id,
        label: "Scaled",
        position: 1,
        tx,
      })

      const newSettings = stringifyCompetitionSettings({
        ...settings,
        divisions: { scalingGroupId: newGroup.id },
      })

      await tx
        .update(competitionsTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(competitionsTable.id, competitionId))

      return newGroup.id
    })

    return { scalingGroupId: newGroupId, wasCloned: true }
  }

  // Check if already competition-owned
  const isOwned = await isCompetitionOwnedScalingGroup({
    competitionId,
    scalingGroupId: currentGroupId,
  })

  if (isOwned) {
    return { scalingGroupId: currentGroupId, wasCloned: false }
  }

  // Need to clone: current group is shared/template (atomic)
  const templateLevels = await listScalingLevels({
    scalingGroupId: currentGroupId,
  })

  const [templateGroup] = await db
    .select()
    .from(scalingGroupsTable)
    .where(eq(scalingGroupsTable.id, currentGroupId))

  const newGroupId = await db.transaction(async (tx) => {
    const newGroup = await createScalingGroup({
      teamId: competition.organizingTeamId,
      title: `${competition.name} Divisions`,
      description: templateGroup
        ? `Cloned from ${templateGroup.title}`
        : `Divisions for ${competition.name}`,
      tx,
    })

    if (!newGroup) {
      throw new Error("Failed to create scaling group")
    }

    for (const level of templateLevels) {
      await createScalingLevel({
        scalingGroupId: newGroup.id,
        label: level.label,
        position: level.position,
        teamSize: level.teamSize,
        tx,
      })
    }

    const newSettings = stringifyCompetitionSettings({
      ...settings,
      divisions: { scalingGroupId: newGroup.id },
    })

    await tx
      .update(competitionsTable)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(competitionsTable.id, competitionId))

    return newGroup.id
  })

  return { scalingGroupId: newGroupId, wasCloned: true }
}

/**
 * Get registration count for a specific division
 */
async function getRegistrationCountForDivision({
  divisionId,
  competitionId,
}: {
  divisionId: string
  competitionId: string
}): Promise<number> {
  const db = getDb()

  const result = await db
    .select({ count: count() })
    .from(competitionRegistrationsTable)
    .where(
      and(
        eq(competitionRegistrationsTable.divisionId, divisionId),
        eq(competitionRegistrationsTable.eventId, competitionId),
        ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
      ),
    )

  return result[0]?.count ?? 0
}

// ============================================================================
// Read Server Functions
// ============================================================================

/**
 * Get divisions with registration counts (cohost view)
 */
export const cohostGetDivisionsWithCountsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostDivisionsInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    const settings = parseCompetitionSettings(competition.settings)
    const scalingGroupId = settings?.divisions?.scalingGroupId ?? null

    if (!scalingGroupId) {
      return { scalingGroupId: null, scalingGroupTitle: null, divisions: [] }
    }

    const [scalingGroup] = await db
      .select({ title: scalingGroupsTable.title })
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.id, scalingGroupId))

    const divisions = await db
      .select({
        id: scalingLevelsTable.id,
        label: scalingLevelsTable.label,
        position: scalingLevelsTable.position,
        description: competitionDivisionsTable.description,
        feeCents: competitionDivisionsTable.feeCents,
        maxSpots: competitionDivisionsTable.maxSpots,
        teamSize: scalingLevelsTable.teamSize,
        registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as unsigned)`,
      })
      .from(scalingLevelsTable)
      .leftJoin(
        competitionDivisionsTable,
        and(
          eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
          eq(competitionDivisionsTable.competitionId, data.competitionId),
        ),
      )
      .leftJoin(
        competitionRegistrationsTable,
        and(
          eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
      .groupBy(
        scalingLevelsTable.id,
        scalingLevelsTable.teamSize,
        competitionDivisionsTable.description,
        competitionDivisionsTable.feeCents,
        competitionDivisionsTable.maxSpots,
      )
      .orderBy(scalingLevelsTable.position)

    return {
      scalingGroupId,
      scalingGroupTitle: scalingGroup?.title ?? null,
      defaultMaxSpotsPerDivision: competition.defaultMaxSpotsPerDivision,
      divisions: divisions.map((d) => ({
        ...d,
        description: d.description ?? null,
        feeCents: d.feeCents ?? competition.defaultRegistrationFeeCents ?? null,
        maxSpots: d.maxSpots ?? null,
      })) as CohostDivisionWithCounts[],
    }
  })

/**
 * Get a scaling group with its levels (cohost view)
 */
export const cohostGetScalingGroupWithLevelsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => cohostScalingGroupInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    const db = getDb()

    const scalingGroup = await db.query.scalingGroupsTable.findFirst({
      where: eq(scalingGroupsTable.id, data.scalingGroupId),
      with: {
        scalingLevels: {
          orderBy: (table, { asc }) => [asc(table.position)],
        },
      },
    })

    return scalingGroup
  })

// ============================================================================
// Mutation Server Functions
// ============================================================================

/**
 * Add a division to a competition (cohost)
 */
export const cohostAddCompetitionDivisionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => cohostAddDivisionInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const { scalingGroupId } = await ensureCohostOwnedScalingGroup({
      competitionId: data.competitionId,
      competitionTeamId: data.competitionTeamId,
    })

    const level = await createScalingLevel({
      scalingGroupId,
      label: data.label,
      teamSize: data.teamSize,
    })

    return { divisionId: level.id }
  })

/**
 * Update a division label (cohost)
 */
export const cohostUpdateCompetitionDivisionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostUpdateDivisionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const { scalingGroupId } = await ensureCohostOwnedScalingGroup({
      competitionId: data.competitionId,
      competitionTeamId: data.competitionTeamId,
    })

    // Verify division belongs to this group
    const [division] = await db
      .select()
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, data.divisionId))

    if (!division || division.scalingGroupId !== scalingGroupId) {
      throw new Error("Division not found in this competition")
    }

    await db
      .update(scalingLevelsTable)
      .set({ label: data.label, updatedAt: new Date() })
      .where(eq(scalingLevelsTable.id, data.divisionId))

    return { success: true }
  })

/**
 * Delete a division (cohost) — blocked if registrations exist
 */
export const cohostDeleteCompetitionDivisionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostDeleteDivisionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const { scalingGroupId } = await ensureCohostOwnedScalingGroup({
      competitionId: data.competitionId,
      competitionTeamId: data.competitionTeamId,
    })

    // Verify division belongs to this group
    const [division] = await db
      .select()
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, data.divisionId))

    if (!division || division.scalingGroupId !== scalingGroupId) {
      throw new Error("Division not found in this competition")
    }

    // Check registration count
    const regCount = await getRegistrationCountForDivision({
      divisionId: data.divisionId,
      competitionId: data.competitionId,
    })

    if (regCount > 0) {
      throw new Error(
        `Cannot delete: ${regCount} athlete${regCount > 1 ? "s" : ""} registered in this division`,
      )
    }

    // Check minimum divisions (must have at least 1)
    const allDivisions = await listScalingLevels({ scalingGroupId })
    if (allDivisions.length <= 1) {
      throw new Error(
        "Cannot delete: competition must have at least one division",
      )
    }

    // Clean up mappings + delete level atomically
    await db.transaction(async (tx) => {
      await tx
        .delete(seriesDivisionMappingsTable)
        .where(
          eq(
            seriesDivisionMappingsTable.competitionDivisionId,
            data.divisionId,
          ),
        )

      await tx
        .delete(scalingLevelsTable)
        .where(eq(scalingLevelsTable.id, data.divisionId))
    })

    return { success: true }
  })

/**
 * Reorder divisions via drag and drop (cohost)
 */
export const cohostReorderCompetitionDivisionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostReorderDivisionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const { scalingGroupId } = await ensureCohostOwnedScalingGroup({
      competitionId: data.competitionId,
      competitionTeamId: data.competitionTeamId,
    })

    // Update all positions atomically
    await db.transaction(async (tx) => {
      for (let i = 0; i < data.orderedDivisionIds.length; i++) {
        const id = data.orderedDivisionIds[i]
        if (!id) continue

        await tx
          .update(scalingLevelsTable)
          .set({ position: i, updatedAt: new Date() })
          .where(
            and(
              eq(scalingLevelsTable.id, id),
              eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
            ),
          )
      }
    })

    return { success: true }
  })

/**
 * Update a division's description (cohost)
 */
export const cohostUpdateDivisionDescriptionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostUpdateDescriptionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const { scalingGroupId } = await ensureCohostOwnedScalingGroup({
      competitionId: data.competitionId,
      competitionTeamId: data.competitionTeamId,
    })

    // Verify division belongs to this group
    const [division] = await db
      .select()
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, data.divisionId))

    if (!division || division.scalingGroupId !== scalingGroupId) {
      throw new Error("Division not found in this competition")
    }

    // Check if division config exists
    const existing = await db.query.competitionDivisionsTable.findFirst({
      where: and(
        eq(competitionDivisionsTable.competitionId, data.competitionId),
        eq(competitionDivisionsTable.divisionId, data.divisionId),
      ),
    })

    if (existing) {
      await db
        .update(competitionDivisionsTable)
        .set({ description: data.description, updatedAt: new Date() })
        .where(eq(competitionDivisionsTable.id, existing.id))
    } else {
      // Get competition default fee for new division config
      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, data.competitionId),
      })
      const defaultFee = competition?.defaultRegistrationFeeCents ?? 0

      await db.insert(competitionDivisionsTable).values({
        competitionId: data.competitionId,
        divisionId: data.divisionId,
        feeCents: defaultFee,
        description: data.description,
      })
    }

    return { success: true }
  })

/**
 * Update max spots for a specific division (cohost)
 */
export const cohostUpdateDivisionCapacityFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostUpdateCapacityInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    const { scalingGroupId } = await ensureCohostOwnedScalingGroup({
      competitionId: data.competitionId,
      competitionTeamId: data.competitionTeamId,
    })

    // Verify division belongs to this group
    const [division] = await db
      .select()
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, data.divisionId))

    if (!division || division.scalingGroupId !== scalingGroupId) {
      throw new Error("Division not found in this competition")
    }

    // Check if division config exists
    const existing = await db.query.competitionDivisionsTable.findFirst({
      where: and(
        eq(competitionDivisionsTable.competitionId, data.competitionId),
        eq(competitionDivisionsTable.divisionId, data.divisionId),
      ),
    })

    if (existing) {
      await db
        .update(competitionDivisionsTable)
        .set({ maxSpots: data.maxSpots, updatedAt: new Date() })
        .where(eq(competitionDivisionsTable.id, existing.id))
    } else {
      // Get competition default fee for new division config
      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, data.competitionId),
      })
      const defaultFee = competition?.defaultRegistrationFeeCents ?? 0

      await db.insert(competitionDivisionsTable).values({
        competitionId: data.competitionId,
        divisionId: data.divisionId,
        feeCents: defaultFee,
        maxSpots: data.maxSpots,
      })
    }

    return { success: true }
  })

/**
 * Initialize divisions for a competition (cohost)
 */
export const cohostInitializeCompetitionDivisionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostInitializeDivisionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "divisions")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    // Verify competition exists
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Check if competition already has divisions configured
    const settings = parseCompetitionSettings(competition.settings)
    if (settings?.divisions?.scalingGroupId) {
      throw new Error("Competition already has divisions configured")
    }

    // Read template data before transaction (if cloning)
    let templateLevels: Awaited<ReturnType<typeof listScalingLevels>> = []
    let templateGroupTitle: string | undefined

    if (data.templateGroupId) {
      templateLevels = await listScalingLevels({
        scalingGroupId: data.templateGroupId,
      })

      const [templateGroup] = await db
        .select()
        .from(scalingGroupsTable)
        .where(eq(scalingGroupsTable.id, data.templateGroupId))

      templateGroupTitle = templateGroup?.title
    }

    // Create group + levels + update settings atomically
    const newScalingGroupId = await db.transaction(async (tx) => {
      const newGroup = await createScalingGroup({
        teamId: competition.organizingTeamId,
        title: `${competition.name} Divisions`,
        description:
          data.templateGroupId && templateGroupTitle
            ? `Cloned from ${templateGroupTitle}`
            : `Divisions for ${competition.name}`,
        tx,
      })

      if (!newGroup) {
        throw new Error("Failed to create scaling group")
      }

      if (data.templateGroupId) {
        // Clone levels from template, optionally filtering to selected subset
        const levelsToClone = data.templateDivisionIds
          ? templateLevels.filter((l) =>
              data.templateDivisionIds?.includes(l.id),
            )
          : templateLevels
        for (let i = 0; i < levelsToClone.length; i++) {
          const level = levelsToClone[i]
          await createScalingLevel({
            scalingGroupId: newGroup.id,
            label: level.label,
            position: i,
            teamSize: level.teamSize,
            tx,
          })
        }
      } else {
        // Create default divisions
        await createScalingLevel({
          scalingGroupId: newGroup.id,
          label: "Open",
          position: 0,
          tx,
        })
        await createScalingLevel({
          scalingGroupId: newGroup.id,
          label: "Scaled",
          position: 1,
          tx,
        })
      }

      // Update competition settings with new scaling group
      const newSettings = stringifyCompetitionSettings({
        ...settings,
        divisions: { scalingGroupId: newGroup.id },
      })

      await tx
        .update(competitionsTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(competitionsTable.id, data.competitionId))

      return newGroup.id
    })

    return { scalingGroupId: newScalingGroupId }
  })
