/**
 * Competition Invite Server Functions
 *
 * Phase 1 exposes CRUD over `competition_invite_sources`, plus the roster
 * computation (added in a later commit). Every mutation requires
 * `MANAGE_COMPETITIONS` on the championship's organizing team. When a
 * source references another competition or series, we also require
 * `MANAGE_COMPETITIONS` on that source's organizing team.
 *
 * Per ADR Open Question 6 (same-org only for MVP), the source's
 * organizing team must currently match the championship's organizing
 * team. This is a soft policy implemented here; the schema keeps the
 * generality so we can relax the rule in a future phase by dropping this
 * check.
 */
// @lat: [[competition-invites#Source server fns]]

import { createServerFn } from "@tanstack/react-start"
import { eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { COMPETITION_INVITE_SOURCE_KIND } from "@/db/schemas/competition-invites"
import {
  competitionGroupsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
  logEntityCreated,
  logEntityDeleted,
  logEntityUpdated,
  withRequestContext,
} from "@/lib/logging"
import { getChampionshipRoster } from "@/server/competition-invites/roster"
import {
  createSource,
  deleteSource,
  getSourceById,
  listSourcesForChampionship,
  updateSource,
} from "@/server/competition-invites/sources"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "./requireTeamMembership"

// ============================================================================
// Input Schemas
// ============================================================================

const divisionMappingSchema = z.object({
  sourceDivisionId: z.string().min(1),
  championshipDivisionId: z.string().min(1),
  spots: z.number().int().positive().nullable().optional(),
})

const kindSchema = z.enum([
  COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
  COMPETITION_INVITE_SOURCE_KIND.SERIES,
])

const listInviteSourcesInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
})

const createInviteSourceInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  kind: kindSchema,
  sourceCompetitionId: z.string().min(1).nullable().optional(),
  sourceGroupId: z.string().min(1).nullable().optional(),
  directSpotsPerComp: z.number().int().positive().nullable().optional(),
  globalSpots: z.number().int().positive().nullable().optional(),
  divisionMappings: z.array(divisionMappingSchema).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const updateInviteSourceInputSchema = z.object({
  id: z.string().min(1),
  championshipCompetitionId: z.string().min(1),
  kind: kindSchema.optional(),
  sourceCompetitionId: z.string().min(1).nullable().optional(),
  sourceGroupId: z.string().min(1).nullable().optional(),
  directSpotsPerComp: z.number().int().positive().nullable().optional(),
  globalSpots: z.number().int().positive().nullable().optional(),
  divisionMappings: z.array(divisionMappingSchema).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const deleteInviteSourceInputSchema = z.object({
  id: z.string().min(1),
  championshipCompetitionId: z.string().min(1),
})

const getChampionshipRosterInputSchema = z.object({
  championshipCompetitionId: z.string().min(1),
  divisionId: z.string().min(1),
  filters: z
    .object({
      statuses: z.array(z.string()).optional(),
    })
    .optional(),
})

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Resolve the organizing team for a competition. Throws if the
 * competition does not exist.
 *
 * Not exported: keeping this internal lets the tanstack-start compiler's
 * dead-code-elimination prune this function (and its `getDb` import
 * chain) from the client bundle. Exporting would pin the `cloudflare:workers`
 * import through `@/db` and break the dev server's client environment.
 */
async function getCompetitionOrganizingTeamId(
  competitionId: string,
): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select({ organizingTeamId: competitionsTable.organizingTeamId })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)
  if (!row) throw new Error("Competition not found")
  return row.organizingTeamId
}

async function getSeriesOrganizingTeamId(groupId: string): Promise<string> {
  const db = getDb()
  const [row] = await db
    .select({ organizingTeamId: competitionGroupsTable.organizingTeamId })
    .from(competitionGroupsTable)
    .where(eq(competitionGroupsTable.id, groupId))
    .limit(1)
  if (!row) throw new Error("Series not found")
  return row.organizingTeamId
}

/**
 * Require `MANAGE_COMPETITIONS` on both the championship and any referenced
 * source (competition or series). Per ADR Open Question 6, the two
 * organizing teams must currently match (same-org only for MVP).
 *
 * The source reference is resolved via `kind` (not "whichever id is set")
 * so a request like `kind: "series"` with both a benign
 * `sourceCompetitionId` and an attacker-controlled `sourceGroupId`
 * cannot bypass the series-side permission check.
 */
async function requireSourcePermissions(params: {
  championshipCompetitionId: string
  kind: "competition" | "series"
  sourceCompetitionId?: string | null
  sourceGroupId?: string | null
}): Promise<{ championshipTeamId: string }> {
  const championshipTeamId = await getCompetitionOrganizingTeamId(
    params.championshipCompetitionId,
  )
  await requireTeamPermission(
    championshipTeamId,
    TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
  )

  let sourceTeamId: string | null = null
  if (params.kind === COMPETITION_INVITE_SOURCE_KIND.COMPETITION) {
    if (!params.sourceCompetitionId) {
      throw new Error(
        'kind "competition" requires sourceCompetitionId',
      )
    }
    sourceTeamId = await getCompetitionOrganizingTeamId(
      params.sourceCompetitionId,
    )
  } else if (params.kind === COMPETITION_INVITE_SOURCE_KIND.SERIES) {
    if (!params.sourceGroupId) {
      throw new Error('kind "series" requires sourceGroupId')
    }
    sourceTeamId = await getSeriesOrganizingTeamId(params.sourceGroupId)
  }

  if (sourceTeamId) {
    await requireTeamPermission(
      sourceTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )
    // ADR OQ6: same-org only for MVP.
    if (sourceTeamId !== championshipTeamId) {
      throw new Error(
        "Cross-organization sources are not supported yet — the source must belong to the same organization as the championship.",
      )
    }
  }

  return { championshipTeamId }
}

// ============================================================================
// Server Functions
// ============================================================================

export const listInviteSourcesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listInviteSourcesInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "listInviteSourcesFn",
        attributes: { championshipCompetitionId: data.championshipCompetitionId },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )
        const sources = await listSourcesForChampionship(
          data.championshipCompetitionId,
        )

        const competitionIds = Array.from(
          new Set(
            sources
              .map((s) => s.sourceCompetitionId)
              .filter((v): v is string => !!v),
          ),
        )
        const groupIds = Array.from(
          new Set(
            sources
              .map((s) => s.sourceGroupId)
              .filter((v): v is string => !!v),
          ),
        )

        const db = getDb()
        const [compNameRows, groupRows, seriesCompCountRows] = await Promise.all([
          competitionIds.length > 0
            ? db
                .select({
                  id: competitionsTable.id,
                  name: competitionsTable.name,
                })
                .from(competitionsTable)
                .where(inArray(competitionsTable.id, competitionIds))
            : Promise.resolve<Array<{ id: string; name: string }>>([]),
          groupIds.length > 0
            ? db
                .select({
                  id: competitionGroupsTable.id,
                  name: competitionGroupsTable.name,
                })
                .from(competitionGroupsTable)
                .where(inArray(competitionGroupsTable.id, groupIds))
            : Promise.resolve<Array<{ id: string; name: string }>>([]),
          groupIds.length > 0
            ? db
                .select({
                  groupId: competitionsTable.groupId,
                  count: sql<number>`count(*)`,
                })
                .from(competitionsTable)
                .where(inArray(competitionsTable.groupId, groupIds))
                .groupBy(competitionsTable.groupId)
            : Promise.resolve<Array<{ groupId: string | null; count: number }>>(
                [],
              ),
        ])

        const competitionNamesById: Record<string, string> = Object.fromEntries(
          compNameRows.map((r) => [r.id, r.name]),
        )
        const seriesNamesById: Record<string, string> = Object.fromEntries(
          groupRows.map((r) => [r.id, r.name]),
        )
        const seriesCompCountsById: Record<string, number> =
          Object.fromEntries(
            seriesCompCountRows
              .filter((r): r is { groupId: string; count: number } => !!r.groupId)
              .map((r) => [r.groupId, Number(r.count)]),
          )

        return {
          sources,
          competitionNamesById,
          seriesNamesById,
          seriesCompCountsById,
        }
      },
    )
  })

export const createInviteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createInviteSourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "createInviteSourceFn",
        attributes: { championshipCompetitionId: data.championshipCompetitionId },
      },
      async () => {
        await requireSourcePermissions({
          championshipCompetitionId: data.championshipCompetitionId,
          kind: data.kind,
          sourceCompetitionId: data.sourceCompetitionId,
          sourceGroupId: data.sourceGroupId,
        })

        const source = await createSource({
          championshipCompetitionId: data.championshipCompetitionId,
          kind: data.kind,
          sourceCompetitionId: data.sourceCompetitionId,
          sourceGroupId: data.sourceGroupId,
          directSpotsPerComp: data.directSpotsPerComp,
          globalSpots: data.globalSpots,
          divisionMappings: data.divisionMappings,
          sortOrder: data.sortOrder,
          notes: data.notes,
        })

        logEntityCreated({
          entity: "competition_invite_source",
          id: source.id,
          parentEntity: "competition",
          parentId: data.championshipCompetitionId,
          attributes: {
            kind: source.kind,
            sourceCompetitionId: source.sourceCompetitionId,
            sourceGroupId: source.sourceGroupId,
          },
        })

        return { source }
      },
    )
  })

export const updateInviteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInviteSourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "updateInviteSourceFn",
        attributes: { sourceId: data.id },
      },
      async () => {
        // Resolve the existing row to validate cross-permission against the
        // *new* reference target if the caller is changing it.
        const existing = await getSourceById(data.id)
        if (!existing) throw new Error("Source not found")
        if (
          existing.championshipCompetitionId !== data.championshipCompetitionId
        ) {
          throw new Error("Source does not belong to this championship")
        }

        const nextKind = data.kind ?? existing.kind
        const nextComp =
          data.sourceCompetitionId !== undefined
            ? data.sourceCompetitionId
            : existing.sourceCompetitionId
        const nextGroup =
          data.sourceGroupId !== undefined
            ? data.sourceGroupId
            : existing.sourceGroupId

        await requireSourcePermissions({
          championshipCompetitionId: data.championshipCompetitionId,
          kind: nextKind,
          sourceCompetitionId: nextComp,
          sourceGroupId: nextGroup,
        })

        const source = await updateSource({
          id: data.id,
          kind: data.kind,
          sourceCompetitionId: data.sourceCompetitionId,
          sourceGroupId: data.sourceGroupId,
          directSpotsPerComp: data.directSpotsPerComp,
          globalSpots: data.globalSpots,
          divisionMappings: data.divisionMappings,
          sortOrder: data.sortOrder,
          notes: data.notes,
        })

        logEntityUpdated({
          entity: "competition_invite_source",
          id: source.id,
          attributes: {
            kind: source.kind,
            sourceCompetitionId: source.sourceCompetitionId,
            sourceGroupId: source.sourceGroupId,
          },
        })

        return { source }
      },
    )
  })

export const deleteInviteSourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteInviteSourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "deleteInviteSourceFn",
        attributes: { sourceId: data.id },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )
        await deleteSource({
          id: data.id,
          championshipCompetitionId: data.championshipCompetitionId,
        })

        logEntityDeleted({
          entity: "competition_invite_source",
          id: data.id,
          attributes: {
            championshipCompetitionId: data.championshipCompetitionId,
          },
        })

        return { ok: true as const }
      },
    )
  })

export const getChampionshipRosterFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getChampionshipRosterInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return withRequestContext(
      {
        userId: session.userId,
        serverFn: "getChampionshipRosterFn",
        attributes: {
          championshipCompetitionId: data.championshipCompetitionId,
          divisionId: data.divisionId,
        },
      },
      async () => {
        const championshipTeamId = await getCompetitionOrganizingTeamId(
          data.championshipCompetitionId,
        )
        await requireTeamPermission(
          championshipTeamId,
          TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
        )
        const { rows } = await getChampionshipRoster({
          championshipId: data.championshipCompetitionId,
          divisionId: data.divisionId,
          filters: data.filters,
        })
        return { rows }
      },
    )
  })
