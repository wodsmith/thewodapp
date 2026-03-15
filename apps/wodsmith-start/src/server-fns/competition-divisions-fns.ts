/**
 * Competition Divisions Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-divisions.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, count, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { type Database, getDb } from "@/db"
import {
  COMMERCE_PURCHASE_STATUS,
  commercePurchaseTable,
  competitionDivisionsTable,
} from "@/db/schemas/commerce"
import { createScalingGroupId, createScalingLevelId } from "@/db/schemas/common"
import {
  competitionGroupsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"
import { calculateDivisionCapacity } from "@/utils/division-capacity"

// ============================================================================
// Types
// ============================================================================

/**
 * Parse competition settings from JSON string
 */
export function parseCompetitionSettings(settings: string | null): {
  divisions?: { scalingGroupId?: string }
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
 * Check if user has permission on a team (or is a site admin)
 */
async function hasTeamPermission(
  teamId: string,
  permission: string,
): Promise<boolean> {
  const session = await getSessionFromCookie()
  if (!session?.userId) return false

  // Site admins have all permissions
  if (session.user?.role === ROLES_ENUM.ADMIN) return true

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

export interface PublicCompetitionDivision {
  id: string
  label: string
  description: string | null
  registrationCount: number
  feeCents: number
  teamSize: number
  maxSpots: number | null
  spotsAvailable: number | null
  isFull: boolean
}

export interface CompetitionDivisionWithCounts {
  id: string
  label: string
  position: number
  registrationCount: number
  description: string | null
  feeCents: number | null
  maxSpots: number | null
  teamSize: number
}

export interface ScalingGroupForTemplate {
  id: string
  title: string
  description: string | null
  teamId: string | null
  isSystem: boolean
  levels: Array<{
    id: string
    label: string
    position: number
  }>
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPublicCompetitionDivisionsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
})

const getCompetitionDivisionsWithCountsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
})

const listScalingGroupsInputSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
})

const initializeCompetitionDivisionsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  templateGroupId: z.string().optional(),
})

const addCompetitionDivisionInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  label: z.string().min(1, "Division name is required").max(100),
  teamSize: z.number().int().min(1).max(10).default(1),
})

const updateCompetitionDivisionInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  label: z.string().min(1, "Division name is required").max(100),
})

const deleteCompetitionDivisionInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
})

const reorderCompetitionDivisionsInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  orderedDivisionIds: z.array(z.string()).min(1, "Division IDs are required"),
})

const updateDivisionDescriptionInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  description: z.string().max(2000).nullable(),
})

const getScalingGroupWithLevelsInputSchema = z.object({
  scalingGroupId: z.string().min(1, "Scaling Group ID is required"),
})

const updateCompetitionDefaultCapacityInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  defaultMaxSpotsPerDivision: z.number().int().min(1).nullable(),
})

const updateDivisionCapacityInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  maxSpots: z.number().int().min(1).nullable(),
})

const getDivisionSpotsAvailableInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
  excludePurchaseId: z.string().optional(), // Used by webhook to exclude its own pending purchase
})

// ============================================================================
// Helper Functions
// ============================================================================

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

  // Determine position (0 = hardest). If not provided, append to end.
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

  // Check if group belongs to organizing team and matches naming pattern
  return (
    group.teamId === competition.organizingTeamId &&
    group.title.includes("Divisions")
  )
}

/**
 * Ensure competition has its own scaling group (clone if needed)
 */
async function ensureCompetitionOwnedScalingGroup({
  competitionId,
  teamId,
}: {
  competitionId: string
  teamId: string
}): Promise<{ scalingGroupId: string; wasCloned: boolean }> {
  const db = getDb()
  await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

  const [competition] = await db
    .select()
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))

  if (!competition) {
    throw new Error("Competition not found")
  }

  if (competition.organizingTeamId !== teamId) {
    throw new Error("Competition does not belong to this team")
  }

  const settings = parseCompetitionSettings(competition.settings)
  const currentGroupId = settings?.divisions?.scalingGroupId

  if (!currentGroupId) {
    // No divisions yet - create empty group with defaults (atomic)
    const newGroupId = await db.transaction(async (tx) => {
      const newGroup = await createScalingGroup({
        teamId,
        title: `${competition.name} Divisions`,
        description: `Divisions for ${competition.name}`,
        tx,
      })

      if (!newGroup) {
        throw new Error("Failed to create scaling group")
      }

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

      // Update competition settings
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
      teamId,
      title: `${competition.name} Divisions`,
      description: templateGroup
        ? `Cloned from ${templateGroup.title}`
        : `Divisions for ${competition.name}`,
      tx,
    })

    if (!newGroup) {
      throw new Error("Failed to create scaling group")
    }

    // Clone levels
    for (const level of templateLevels) {
      await createScalingLevel({
        scalingGroupId: newGroup.id,
        label: level.label,
        position: level.position,
        teamSize: level.teamSize,
        tx,
      })
    }

    // Update competition settings
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
// Server Functions
// ============================================================================

/**
 * Get a scaling group with its levels (divisions)
 * Used by pricing page to get division options
 */
export const getScalingGroupWithLevelsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getScalingGroupWithLevelsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
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

/**
 * Get divisions for public competition display
 * Returns divisions with descriptions and registration counts
 * Used by competition details page
 */
export const getPublicCompetitionDivisionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getPublicCompetitionDivisionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Get competition with settings
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    if (!competition) {
      return { divisions: [] }
    }

    const settings = parseCompetitionSettings(competition.settings)
    const scalingGroupId = settings?.divisions?.scalingGroupId

    if (!scalingGroupId) {
      return { divisions: [] }
    }

    // Get divisions with descriptions, registration counts, and capacity
    // Also get pending purchases (reservations) separately to avoid double-counting in joins
    const [divisions, pendingByDivision] = await Promise.all([
      db
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
          teamSize: scalingLevelsTable.teamSize,
          description: competitionDivisionsTable.description,
          feeCents: competitionDivisionsTable.feeCents,
          maxSpots: competitionDivisionsTable.maxSpots,
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
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        )
        .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
        .groupBy(
          scalingLevelsTable.id,
          competitionDivisionsTable.description,
          competitionDivisionsTable.feeCents,
          competitionDivisionsTable.maxSpots,
        )
        .orderBy(scalingLevelsTable.position),
      // Count pending purchases (reservations) per division
      db
        .select({
          divisionId: commercePurchaseTable.divisionId,
          pendingCount: sql<number>`cast(count(*) as unsigned)`,
        })
        .from(commercePurchaseTable)
        .where(
          and(
            eq(commercePurchaseTable.competitionId, data.competitionId),
            eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
          ),
        )
        .groupBy(commercePurchaseTable.divisionId),
    ])

    // Create lookup map for pending counts
    const pendingCountMap = new Map(
      pendingByDivision.map((p) => [p.divisionId, p.pendingCount]),
    )

    // Apply defaults from competition and calculate capacity (including reservations)
    const result: PublicCompetitionDivision[] = divisions.map((d) => {
      const capacity = calculateDivisionCapacity({
        registrationCount: d.registrationCount,
        pendingCount: pendingCountMap.get(d.id) ?? 0,
        divisionMaxSpots: d.maxSpots,
        competitionDefaultMax: competition.defaultMaxSpotsPerDivision,
      })
      return {
        id: d.id,
        label: d.label,
        description: d.description ?? null,
        registrationCount: d.registrationCount,
        feeCents: d.feeCents ?? competition.defaultRegistrationFeeCents ?? 0,
        teamSize: d.teamSize,
        maxSpots: capacity.effectiveMax,
        spotsAvailable: capacity.spotsAvailable,
        isFull: capacity.isFull,
      }
    })

    return { divisions: result }
  })

/**
 * Get divisions for a competition with registration counts (organizer view)
 */
export const getCompetitionDivisionsWithCountsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCompetitionDivisionsWithCountsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    // Check permission
    await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

    // Get competition settings
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

    // Get scaling group title
    const [scalingGroup] = await db
      .select({ title: scalingGroupsTable.title })
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.id, scalingGroupId))

    // Get divisions with registration counts, descriptions, and capacity
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
      })) as CompetitionDivisionWithCounts[],
    }
  })

/**
 * List scaling groups available as division templates
 */
export const listScalingGroupsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listScalingGroupsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    // Check permission
    await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

    // Get team's scaling groups + system groups with their levels
    const groups = await db.query.scalingGroupsTable.findMany({
      where: sql`${scalingGroupsTable.teamId} = ${data.teamId} OR ${scalingGroupsTable.teamId} IS NULL`,
      orderBy: sql`${scalingGroupsTable.isSystem} DESC, ${scalingGroupsTable.title} ASC`,
      with: {
        scalingLevels: {
          orderBy: (table, { asc }) => [asc(table.position)],
        },
      },
    })

    // Exclude series template scaling groups so organizers don't accidentally
    // pick them when setting up individual competition divisions.
    // Series templates are referenced by competition_groups.settings.scalingGroupId.
    const seriesGroups = await db
      .select({ settings: competitionGroupsTable.settings })
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.organizingTeamId, data.teamId))
    const seriesTemplateIds = new Set<string>()
    for (const sg of seriesGroups) {
      if (sg.settings) {
        try {
          const parsed = JSON.parse(sg.settings)
          if (parsed?.scalingGroupId) {
            seriesTemplateIds.add(parsed.scalingGroupId as string)
          }
        } catch {
          // ignore malformed settings
        }
      }
    }

    // Transform to expected format, filtering out series templates
    const transformedGroups = groups
      .filter((g) => !seriesTemplateIds.has(g.id))
      .map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        teamId: g.teamId,
        isSystem: g.isSystem,
        levels: g.scalingLevels.map((l) => ({
          id: l.id,
          label: l.label,
          position: l.position,
        })),
      }))

    return { groups: transformedGroups }
  })

/**
 * Initialize divisions for a competition
 */
export const initializeCompetitionDivisionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    initializeCompetitionDivisionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Verify competition exists and belongs to team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (competition.organizingTeamId !== data.teamId) {
      throw new Error("Competition does not belong to this team")
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
        teamId: data.teamId,
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
        // Clone levels from template
        for (const level of templateLevels) {
          await createScalingLevel({
            scalingGroupId: newGroup.id,
            label: level.label,
            position: level.position,
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

/**
 * Add a division to a competition
 */
export const addCompetitionDivisionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    addCompetitionDivisionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
      competitionId: data.competitionId,
      teamId: data.teamId,
    })

    const level = await createScalingLevel({
      scalingGroupId,
      label: data.label,
      teamSize: data.teamSize,
    })

    return { divisionId: level.id }
  })

/**
 * Update a division label
 */
export const updateCompetitionDivisionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateCompetitionDivisionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
      competitionId: data.competitionId,
      teamId: data.teamId,
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
 * Delete a division (blocked if registrations exist)
 */
export const deleteCompetitionDivisionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    deleteCompetitionDivisionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
      competitionId: data.competitionId,
      teamId: data.teamId,
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

    await db
      .delete(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, data.divisionId))

    return { success: true }
  })

/**
 * Reorder divisions (drag and drop)
 */
export const reorderCompetitionDivisionsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    reorderCompetitionDivisionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
      competitionId: data.competitionId,
      teamId: data.teamId,
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
 * Update a division's description
 */
export const updateDivisionDescriptionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateDivisionDescriptionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
      competitionId: data.competitionId,
      teamId: data.teamId,
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
      // Update existing
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
 * Update the default max spots per division for a competition
 */
export const updateCompetitionDefaultCapacityFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    updateCompetitionDefaultCapacityInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Verify competition exists and belongs to team
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (competition.organizingTeamId !== data.teamId) {
      throw new Error("Competition does not belong to this team")
    }

    await db
      .update(competitionsTable)
      .set({
        defaultMaxSpotsPerDivision: data.defaultMaxSpotsPerDivision,
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, data.competitionId))

    return { success: true }
  })

/**
 * Update max spots for a specific division (override)
 */
export const updateDivisionCapacityFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateDivisionCapacityInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const { scalingGroupId } = await ensureCompetitionOwnedScalingGroup({
      competitionId: data.competitionId,
      teamId: data.teamId,
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
      // Update existing
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
 * Get spots available for a division
 * Used for registration validation
 */
export const getDivisionSpotsAvailableFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getDivisionSpotsAvailableInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Get competition for default capacity
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Get division config for override
    const divisionConfig = await db.query.competitionDivisionsTable.findFirst({
      where: and(
        eq(competitionDivisionsTable.competitionId, data.competitionId),
        eq(competitionDivisionsTable.divisionId, data.divisionId),
      ),
    })

    // Get registration count and pending purchases (reservations)
    const [registrations, pendingPurchases] = await Promise.all([
      // Count confirmed registrations (exclude removed)
      db
        .select({ count: count() })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.divisionId, data.divisionId),
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        ),
      // Count pending purchases (reservations) - excludes specified purchaseId to avoid self-blocking
      db
        .select({ count: count() })
        .from(commercePurchaseTable)
        .where(
          and(
            eq(commercePurchaseTable.competitionId, data.competitionId),
            eq(commercePurchaseTable.divisionId, data.divisionId),
            eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
            // Exclude specific purchase if provided (for webhook re-check)
            data.excludePurchaseId
              ? sql`${commercePurchaseTable.id} != ${data.excludePurchaseId}`
              : undefined,
          ),
        ),
    ])

    const confirmedCount = Number(registrations[0]?.count ?? 0)
    const pendingCount = Number(pendingPurchases[0]?.count ?? 0)
    const capacity = calculateDivisionCapacity({
      registrationCount: confirmedCount,
      pendingCount,
      divisionMaxSpots: divisionConfig?.maxSpots,
      competitionDefaultMax: competition.defaultMaxSpotsPerDivision,
    })

    return {
      maxSpots: capacity.effectiveMax,
      registered: capacity.totalOccupied,
      confirmedCount,
      pendingCount,
      available: capacity.spotsAvailable,
      isFull: capacity.isFull,
    }
  })

/**
 * Switch a competition to use a different scaling group directly (no clone).
 * If the competition has registrations, migrates them to matching divisions in
 * the new group by label. Throws if any registered division has no label match.
 * Used to align a competition's divisions with a series' shared scaling group.
 */
export const switchCompetitionScalingGroupFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string().min(1),
        teamId: z.string().min(1),
        newScalingGroupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")
    await requireTeamPermission(
      data.teamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )
    return switchCompetitionScalingGroupCore({
      db,
      competitionId: data.competitionId,
      teamId: data.teamId,
      newScalingGroupId: data.newScalingGroupId,
    })
  })

/**
 * Core logic for switching a competition to a different scaling group.
 * Assumes the caller has already verified auth and team permission.
 */
async function switchCompetitionScalingGroupCore({
  db,
  competitionId,
  teamId,
  newScalingGroupId,
}: {
  db: ReturnType<typeof getDb>
  competitionId: string
  teamId: string
  newScalingGroupId: string
}): Promise<{ success: true; migratedCount: number }> {
  const [competition] = await db
    .select()
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))

  if (!competition) throw new Error(`Competition ${competitionId} not found`)
  if (competition.organizingTeamId !== teamId)
    throw new Error(`Competition ${competitionId} does not belong to this team`)

  // Verify the new scaling group exists and is accessible (team or system)
  const [newGroup] = await db
    .select()
    .from(scalingGroupsTable)
    .where(eq(scalingGroupsTable.id, newScalingGroupId))

  if (!newGroup) throw new Error("Scaling group not found")
  if (newGroup.teamId !== null && newGroup.teamId !== teamId)
    throw new Error("Scaling group does not belong to this team")

  const settings = parseCompetitionSettings(competition.settings)
  const currentGroupId = settings?.divisions?.scalingGroupId

  if (currentGroupId === newScalingGroupId)
    return { success: true, migratedCount: 0 }

  // Load levels for the new group, validate no duplicate labels
  const newLevels = await listScalingLevels({
    scalingGroupId: newScalingGroupId,
  })
  const newLevelByLabel = new Map<string, (typeof newLevels)[number]>()
  for (const level of newLevels) {
    const key = level.label.toLowerCase().trim()
    if (newLevelByLabel.has(key)) {
      throw new Error(
        `Cannot switch: target scaling group has duplicate division label "${level.label}". Rename one before switching.`,
      )
    }
    newLevelByLabel.set(key, level)
  }

  type Migration = { oldId: string; newId: string }
  const migrations: Migration[] = []
  const unmatchedWithRegs: string[] = []
  const teamSizeMismatches: string[] = []

  if (currentGroupId) {
    const oldLevels = await listScalingLevels({
      scalingGroupId: currentGroupId,
    })
    for (const oldLevel of oldLevels) {
      const regCount = await getRegistrationCountForDivision({
        divisionId: oldLevel.id,
        competitionId,
      })
      if (regCount === 0) continue

      const newLevel = newLevelByLabel.get(oldLevel.label.toLowerCase().trim())
      if (!newLevel) {
        unmatchedWithRegs.push(oldLevel.label)
      } else if (newLevel.teamSize !== oldLevel.teamSize) {
        teamSizeMismatches.push(
          `"${oldLevel.label}" (team size ${oldLevel.teamSize} → ${newLevel.teamSize})`,
        )
      } else {
        migrations.push({ oldId: oldLevel.id, newId: newLevel.id })
      }
    }
  }

  if (unmatchedWithRegs.length > 0) {
    throw new Error(
      `Cannot switch: the following divisions have registered athletes but no matching division (by name) in the new group: ${unmatchedWithRegs.map((l) => `"${l}"`).join(", ")}. Add matching divisions to the target group first.`,
    )
  }

  if (teamSizeMismatches.length > 0) {
    throw new Error(
      `Cannot switch: the following divisions have registered athletes but the matching division in the new group has a different team size: ${teamSizeMismatches.join(", ")}. Individual and team divisions cannot be merged.`,
    )
  }

  const newSettings = stringifyCompetitionSettings({
    ...settings,
    divisions: { scalingGroupId: newScalingGroupId },
  })

  let migratedCount = 0
  await db.transaction(async (tx) => {
    for (const { oldId, newId } of migrations) {
      const regs = await tx
        .select({ id: competitionRegistrationsTable.id })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.divisionId, oldId),
            eq(competitionRegistrationsTable.eventId, competitionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        )
      migratedCount += regs.length

      await tx
        .update(competitionRegistrationsTable)
        .set({ divisionId: newId, updatedAt: new Date() })
        .where(
          and(
            eq(competitionRegistrationsTable.divisionId, oldId),
            eq(competitionRegistrationsTable.eventId, competitionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        )

      const oldConfig = await tx.query.competitionDivisionsTable.findFirst({
        where: and(
          eq(competitionDivisionsTable.competitionId, competitionId),
          eq(competitionDivisionsTable.divisionId, oldId),
        ),
      })
      if (oldConfig) {
        const newConfig = await tx.query.competitionDivisionsTable.findFirst({
          where: and(
            eq(competitionDivisionsTable.competitionId, competitionId),
            eq(competitionDivisionsTable.divisionId, newId),
          ),
        })
        if (!newConfig) {
          await tx.insert(competitionDivisionsTable).values({
            competitionId,
            divisionId: newId,
            feeCents: oldConfig.feeCents,
            description: oldConfig.description,
            maxSpots: oldConfig.maxSpots,
          })
        }
        await tx
          .delete(competitionDivisionsTable)
          .where(eq(competitionDivisionsTable.id, oldConfig.id))
      }
    }

    await tx
      .update(competitionsTable)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(competitionsTable.id, competitionId))
  })

  return { success: true, migratedCount }
}

