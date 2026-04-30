/**
 * Per-(source, championship-division) allocation resolution.
 *
 * ADR-0012 Phase 1: pure functional helper plus a DB read used by the
 * organizer-invites loader. The resolver applies the
 * default-plus-override pattern (source default → per-division override),
 * preserving the existing series math when no override is set.
 *
 * The resolver is intentionally pure — the caller passes in the source row,
 * the championship's divisions, and the allocation rows already loaded
 * from the DB. This keeps it easy to unit-test against ADR-0011's
 * roster fixtures without standing up a database.
 */
// @lat: [[competition-invites#Sources schema]]

import "server-only"

import { eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
  type CompetitionInviteSourceDivisionAllocation,
  competitionInviteSourceDivisionAllocationsTable,
  competitionInviteSourcesTable,
} from "@/db/schemas/competition-invites"

// ============================================================================
// Types
// ============================================================================

export interface ChampionshipDivision {
  id: string
  label: string
}

export interface ResolvedSourceAllocations {
  /** Total contributed by this source across the championship's divisions. */
  total: number
  /** Per-championship-division breakdown — keyed by championshipDivisionId. */
  byDivision: Record<string, number>
}

// ============================================================================
// Resolution
// ============================================================================

/**
 * Default allocation for a championship division when no override row
 * exists for `(source.id, division.id)`.
 *
 * - `kind = "competition"`: the source's `globalSpots` (Top N qualifies),
 *   applied per division. Null collapses to 0.
 * - `kind = "series"`: `directSpotsPerComp * seriesCompCount + globalSpots`,
 *   applied per division. This preserves ADR-0011's series math while
 *   distributing it equally per division by default — when the organizer
 *   wants different per-division counts they create override rows.
 *
 * `globalSpotsOverride` (series-only) replaces the source-level `globalSpots`
 * in the series formula when present, letting organizers set per-division
 * global-leaderboard contributions (e.g. 3 RX globals, 2 Scaled globals)
 * without affecting the per-comp direct tier.
 */
function sourceDefaultPerDivision(
  source: CompetitionInviteSource,
  seriesCompCount: number | undefined,
  globalSpotsOverride: number | null,
): number {
  const globalSpots = globalSpotsOverride ?? source.globalSpots ?? 0
  if (source.kind === COMPETITION_INVITE_SOURCE_KIND.SERIES) {
    const direct = source.directSpotsPerComp ?? 0
    const compCount = seriesCompCount ?? 0
    return direct * compCount + globalSpots
  }
  return globalSpots
}

/**
 * Resolve per-championship-division allocations for one source, applying
 * the default-plus-override pattern. Returns the per-division map plus the
 * total contributed by this source across the championship.
 *
 * Per-row precedence (per ADR-0012 + per-division globalSpots extension):
 * 1. `spots` non-null → absolute total override; resolver returns it as-is.
 * 2. `globalSpots` non-null (series only) → resolver returns
 *    `directSpotsPerComp * seriesCompCount + globalSpots-from-row`.
 * 3. Otherwise → source default applied per division.
 *
 * `allocations` should already be filtered to rows for `source.id` (the
 * helper does not re-filter — passing rows for other sources is a caller
 * bug, not a resolver bug). Empty `championshipDivisions` returns
 * `{ total: 0, byDivision: {} }`.
 */
export function resolveSourceAllocations(args: {
  source: CompetitionInviteSource
  championshipDivisions: ReadonlyArray<ChampionshipDivision>
  allocations: ReadonlyArray<CompetitionInviteSourceDivisionAllocation>
  /** For series sources: how many comps in the series (so directSpotsPerComp
   *  scales). Ignored for single-comp sources. */
  seriesCompCount?: number
}): ResolvedSourceAllocations {
  const rowByDivisionId = new Map<
    string,
    Pick<CompetitionInviteSourceDivisionAllocation, "spots" | "globalSpots">
  >()
  for (const allocation of args.allocations) {
    if (allocation.sourceId !== args.source.id) continue
    rowByDivisionId.set(allocation.championshipDivisionId, {
      spots: allocation.spots,
      globalSpots: allocation.globalSpots,
    })
  }

  const byDivision: Record<string, number> = {}
  let total = 0
  for (const division of args.championshipDivisions) {
    const row = rowByDivisionId.get(division.id)
    let spots: number
    if (row?.spots != null) {
      spots = row.spots
    } else {
      spots = sourceDefaultPerDivision(
        args.source,
        args.seriesCompCount,
        row?.globalSpots ?? null,
      )
    }
    byDivision[division.id] = spots
    total += spots
  }

  return { total, byDivision }
}

// ============================================================================
// DB reads
// ============================================================================

/**
 * Load all per-(source, championship-division) allocation rows for a
 * championship's sources. Returns one flat list — callers typically index
 * by `sourceId` themselves.
 *
 * Implemented as a join from `competition_invite_sources` rather than a
 * fan-out: one query, one result, the `championshipDivisionId` index on
 * the allocation table makes the per-division grouping cheap downstream.
 */
export async function listAllocationsForChampionship(args: {
  championshipCompetitionId: string
}): Promise<CompetitionInviteSourceDivisionAllocation[]> {
  const db = getDb()

  const sourceIdRows = await db
    .select({ id: competitionInviteSourcesTable.id })
    .from(competitionInviteSourcesTable)
    .where(
      eq(
        competitionInviteSourcesTable.championshipCompetitionId,
        args.championshipCompetitionId,
      ),
    )

  if (sourceIdRows.length === 0) return []

  const sourceIds = sourceIdRows.map((r) => r.id)

  return db
    .select()
    .from(competitionInviteSourceDivisionAllocationsTable)
    .where(
      inArray(
        competitionInviteSourceDivisionAllocationsTable.sourceId,
        sourceIds,
      ),
    )
}
