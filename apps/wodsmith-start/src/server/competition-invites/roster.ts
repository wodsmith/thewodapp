/**
 * Championship Roster Computation
 *
 * `getChampionshipRoster` returns the union of every (sourceComp ×
 * sourceDivision) leaderboard for the championship's configured sources,
 * with each row tagged by the originating competition + division and the
 * athlete's email hydrated. The roster page renders this as a single
 * table with Competition + Division columns; client-side filters narrow
 * the view without round-tripping.
 *
 * Fan-out: a championship with K sources, each resolving to N
 * competitions × M divisions per competition, costs roughly K·N·M
 * leaderboard reads, fired in parallel. MVP organizers have 1–3 sources
 * with similarly small N/M, so the worst case is bounded under typical
 * usage. Leaderboards are cached on the public-facing render path.
 *
 * ADR-0012 Phase 6: per-(source, championshipDivision) cutoffs are
 * applied after leaderboards are fetched. The resolved allocation map
 * (`resolveSourceAllocations`) supplies the truncation N for each
 * `(sourceId, championshipDivisionId)`. Source-side `globalSpots` is
 * the per-division default when no override row exists. See ADR-0012
 * "Allocation Resolution".
 */
// @lat: [[competition-invites#Roster computation]]

import { inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
  type CompetitionInviteSourceKind,
} from "@/db/schemas/competition-invites"
import { competitionsTable } from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { parseCompetitionSettings } from "@/server-fns/competition-divisions-fns"
import type { ResolvedSourceAllocations } from "./allocations"
import { getCandidatesForSourceComp } from "./candidates"
import { type DivisionMapping, listSourcesForChampionship } from "./sources"

// ============================================================================
// Types
// ============================================================================

export interface RosterRow {
  /** 1-based rank within the source competition's division leaderboard. */
  sourcePlacement: number | null
  /** Source id that produced this row. */
  sourceId: string
  /** Source kind snapshot for UI tagging. */
  sourceKind: CompetitionInviteSourceKind
  /** Comp the athlete placed at. */
  sourceCompetitionId: string
  /** Display name of the source competition. */
  sourceCompetitionName: string
  /** Division id on the source competition. */
  sourceDivisionId: string
  /** Display label of the source division (e.g. "RX Men"). */
  sourceDivisionLabel: string
  /** Stable athlete identity. `userId` may be null if the leaderboard
   *  surfaced no user id (rare); `athleteName` is always present. */
  userId: string | null
  athleteName: string
  /** Email address for the athlete, resolved from `userTable` by `userId`.
   *  Null when the leaderboard surfaced no user id (rare) or the user
   *  has no email on file. */
  athleteEmail: string | null
  /** Invite-state columns — always null at this layer; the route attaches
   *  invite status via `listActiveInvitesFn` keyed by email. */
  inviteId: null
  inviteStatus: null
  roundId: null
  roundNumber: null
}

export interface GetChampionshipRosterInput {
  championshipId: string
}

// ============================================================================
// Internal helpers
// ============================================================================

interface SourceCompetitionRef {
  sourceId: string
  sourceKind: CompetitionInviteSourceKind
  competitionId: string
  competitionName: string
}

interface DivisionRef {
  competitionId: string
  competitionName: string
  divisionId: string
  divisionLabel: string
  sourceId: string
  sourceKind: CompetitionInviteSourceKind
}

interface ChampionshipDivisionInfo {
  id: string
  label: string
}

/**
 * Parse a source's `divisionMappings` JSON column into a typed array.
 *
 * The column is `text` storing
 * `[{ sourceDivisionId, championshipDivisionId, spots? }]`. Returns an
 * empty array on null / malformed JSON — the caller falls back to label
 * matching, which is the common case for organizers who haven't filled
 * in mappings yet.
 */
function parseDivisionMappings(
  raw: string | null | undefined,
): DivisionMapping[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is DivisionMapping =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as { sourceDivisionId?: unknown }).sourceDivisionId ===
          "string" &&
        typeof (m as { championshipDivisionId?: unknown })
          .championshipDivisionId === "string",
    )
  } catch {
    return []
  }
}

/**
 * Map a source-side division id to its championship-division counterpart.
 *
 * Resolution order:
 *   1. Explicit row in the source's `divisionMappings` JSON.
 *   2. Label match against the championship's divisions
 *      (case-insensitive, trimmed) — covers the common case where the
 *      source comp uses the same division labels as the championship.
 *
 * Returns `null` when no mapping can be inferred. Callers use that as
 * the signal to skip the cutoff (i.e. include all leaderboard rows) so
 * mis-mapped divisions don't silently drop qualifying athletes.
 */
function mapSourceDivisionToChampionship(args: {
  sourceDivisionId: string
  sourceDivisionLabel: string
  divisionMappings: DivisionMapping[]
  championshipDivisions: ReadonlyArray<ChampionshipDivisionInfo>
}): string | null {
  const explicit = args.divisionMappings.find(
    (m) => m.sourceDivisionId === args.sourceDivisionId,
  )
  if (explicit) return explicit.championshipDivisionId

  const normalized = args.sourceDivisionLabel.trim().toLowerCase()
  const matched = args.championshipDivisions.find(
    (d) => d.label.trim().toLowerCase() === normalized,
  )
  return matched ? matched.id : null
}

/**
 * Resolve the (competitionId, name) tuples each source contributes:
 * single-comp source → 1 row; series source → every comp in the group.
 *
 * Returns a deduped list keyed by `competitionId` so a comp referenced
 * by both a direct source AND a series source only fetches once. The
 * first-encountered source wins for tagging.
 *
 * TODO(series_global): `series_global` currently fans out the same way
 * as `series` — one (comp × division) candidate fetch per child comp,
 * no series-level aggregation. The intent is "top N from the series
 * global leaderboard per championship division", which needs a
 * dedicated path that calls `getSeriesLeaderboard` and truncates by
 * the resolved per-(source, championship division) allocation. The
 * schema split lands first; the aggregate path is deferred.
 */
async function resolveSourceCompetitions(
  championshipId: string,
): Promise<{
  sources: CompetitionInviteSource[]
  refs: SourceCompetitionRef[]
  seriesCompCountBySourceId: Map<string, number>
}> {
  const sources = await listSourcesForChampionship(championshipId)
  if (sources.length === 0) {
    return { sources: [], refs: [], seriesCompCountBySourceId: new Map() }
  }

  const db = getDb()

  // Collect all comp ids we need to look up.
  const directIds = sources
    .filter(
      (s): s is typeof s & { sourceCompetitionId: string } =>
        s.kind === "competition" && !!s.sourceCompetitionId,
    )
    .map((s) => s.sourceCompetitionId)
  const groupIds = sources
    .filter(
      (s): s is typeof s & { sourceGroupId: string } =>
        (s.kind === "series" || s.kind === "series_global") &&
        !!s.sourceGroupId,
    )
    .map((s) => s.sourceGroupId)

  // One query per category; each can be empty.
  const [directComps, seriesComps] = await Promise.all([
    directIds.length > 0
      ? db
          .select({
            id: competitionsTable.id,
            name: competitionsTable.name,
            groupId: competitionsTable.groupId,
          })
          .from(competitionsTable)
          .where(inArray(competitionsTable.id, directIds))
      : Promise.resolve(
          [] as Array<{ id: string; name: string; groupId: string | null }>,
        ),
    groupIds.length > 0
      ? db
          .select({
            id: competitionsTable.id,
            name: competitionsTable.name,
            groupId: competitionsTable.groupId,
          })
          .from(competitionsTable)
          .where(inArray(competitionsTable.groupId, groupIds))
      : Promise.resolve(
          [] as Array<{ id: string; name: string; groupId: string | null }>,
        ),
  ])

  const refs: SourceCompetitionRef[] = []
  const seen = new Set<string>()
  const seriesCompCountBySourceId = new Map<string, number>()

  for (const source of sources) {
    if (source.kind === "competition" && source.sourceCompetitionId) {
      if (seen.has(source.sourceCompetitionId)) continue
      const row = directComps.find((c) => c.id === source.sourceCompetitionId)
      if (!row) continue
      seen.add(source.sourceCompetitionId)
      refs.push({
        sourceId: source.id,
        sourceKind: source.kind,
        competitionId: row.id,
        competitionName: row.name,
      })
    } else if (
      (source.kind === "series" || source.kind === "series_global") &&
      source.sourceGroupId
    ) {
      const matchingComps = seriesComps.filter(
        (c) => c.groupId === source.sourceGroupId,
      )
      seriesCompCountBySourceId.set(source.id, matchingComps.length)
      for (const c of matchingComps) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        refs.push({
          sourceId: source.id,
          sourceKind: source.kind,
          competitionId: c.id,
          competitionName: c.name,
        })
      }
    }
  }
  return { sources, refs, seriesCompCountBySourceId }
}

/**
 * Resolve every (competition, division) pair to fetch a leaderboard
 * for. Reads `competitionsTable.settings` to find each comp's scaling
 * group, then resolves levels in one batched query.
 */
async function resolveDivisionRefs(
  comps: SourceCompetitionRef[],
): Promise<DivisionRef[]> {
  if (comps.length === 0) return []

  const db = getDb()
  const compSettings = await db
    .select({ id: competitionsTable.id, settings: competitionsTable.settings })
    .from(competitionsTable)
    .where(
      inArray(
        competitionsTable.id,
        comps.map((c) => c.competitionId),
      ),
    )

  const scalingGroupByComp = new Map<string, string>()
  for (const row of compSettings) {
    const settings = parseCompetitionSettings(row.settings)
    const sgid = settings?.divisions?.scalingGroupId
    if (sgid) scalingGroupByComp.set(row.id, sgid)
  }

  const allGroupIds = Array.from(new Set(scalingGroupByComp.values()))
  if (allGroupIds.length === 0) return []

  const levels = await db
    .select({
      id: scalingLevelsTable.id,
      label: scalingLevelsTable.label,
      scalingGroupId: scalingLevelsTable.scalingGroupId,
      position: scalingLevelsTable.position,
    })
    .from(scalingLevelsTable)
    .where(inArray(scalingLevelsTable.scalingGroupId, allGroupIds))

  const levelsByGroup = new Map<
    string,
    Array<{ id: string; label: string; position: number }>
  >()
  for (const lvl of levels) {
    const arr = levelsByGroup.get(lvl.scalingGroupId) ?? []
    arr.push({ id: lvl.id, label: lvl.label, position: lvl.position })
    levelsByGroup.set(lvl.scalingGroupId, arr)
  }
  for (const arr of levelsByGroup.values()) {
    arr.sort((a, b) => a.position - b.position)
  }

  const out: DivisionRef[] = []
  for (const comp of comps) {
    const sgid = scalingGroupByComp.get(comp.competitionId)
    if (!sgid) continue
    const compLevels = levelsByGroup.get(sgid) ?? []
    for (const lvl of compLevels) {
      out.push({
        competitionId: comp.competitionId,
        competitionName: comp.competitionName,
        divisionId: lvl.id,
        divisionLabel: lvl.label,
        sourceId: comp.sourceId,
        sourceKind: comp.sourceKind,
      })
    }
  }
  return out
}

/**
 * Compute the cutoff (max number of qualifying placements) for a
 * leaderboard fetched for `(source, sourceCompetitionId, sourceDivisionId)`.
 *
 * Single-comp source: the cutoff is the resolved per-(source,
 * championshipDivision) value. Override present → uses override; absent
 * → uses the source's `globalSpots` default (applied per division).
 *
 * Series source: keeps the full leaderboard (no cutoff). The per-
 * (source, division) allocation still gates invite issuing and claim
 * acceptance via `divisionAllocationTotals`; the leaderboard fan-out
 * just doesn't pre-truncate so organizers can pick whom to invite from
 * the full candidate pool.
 *
 * Returns `null` when no cutoff applies (i.e. include every row).
 */
function computeCutoffForLeaderboard(args: {
  source: CompetitionInviteSource
  sourceDivisionId: string
  sourceDivisionLabel: string
  championshipDivisions: ReadonlyArray<ChampionshipDivisionInfo>
  resolved: ResolvedSourceAllocations
  divisionMappings: DivisionMapping[]
}): number | null {
  if (args.source.kind === COMPETITION_INVITE_SOURCE_KIND.SERIES) {
    return null
  }

  // Single-comp source: cutoff is the resolved spots for the mapped
  // championship division. If we can't infer the championship division,
  // fall back to no truncation so we don't accidentally drop qualifying
  // athletes — the downstream UI still surfaces the correct denominator.
  const championshipDivisionId = mapSourceDivisionToChampionship({
    sourceDivisionId: args.sourceDivisionId,
    sourceDivisionLabel: args.sourceDivisionLabel,
    divisionMappings: args.divisionMappings,
    championshipDivisions: args.championshipDivisions,
  })
  if (championshipDivisionId === null) return null
  const spots = args.resolved.byDivision[championshipDivisionId]
  if (spots === undefined) return null
  return spots
}

// ============================================================================
// Main entry
// ============================================================================

export async function getChampionshipRoster(
  input: GetChampionshipRosterInput,
): Promise<{ rows: RosterRow[] }> {
  const { refs: comps } = await resolveSourceCompetitions(input.championshipId)
  if (comps.length === 0) return { rows: [] }

  const divisionRefs = await resolveDivisionRefs(comps)
  if (divisionRefs.length === 0) return { rows: [] }

  // Fan out per (sourceComp × division) candidate fetches in parallel.
  // `getCandidatesForSourceComp` is purpose-built for this surface: it
  // returns active registrations directly, with no heat / event-status /
  // publication gating. The roster used to call `getCompetitionLeaderboard`
  // here, which silently dropped divisions whose athletes hadn't been
  // heat-assigned — see docs/bugs/0001-invite-candidates-missing-divisions.md.
  //
  // Cutoff is allocation budget metadata, not a candidate filter. The
  // organizer needs every eligible athlete on the page so they can pick
  // whom to invite — `entries.slice(0, cutoff)` previously dropped
  // eligible candidates whenever the source had more registrants than
  // the championship-division allocation. The denominator math lives in
  // `divisionAllocationTotals` outside this fan-out.
  const candidates = await Promise.all(
    divisionRefs.map((ref) =>
      getCandidatesForSourceComp({
        competitionId: ref.competitionId,
        divisionId: ref.divisionId,
      }).then((c) => ({ ref, entries: c.entries })),
    ),
  )

  const rows: RosterRow[] = []
  for (const { ref, entries } of candidates) {
    entries.forEach((e, idx) => {
      rows.push({
        sourcePlacement: idx + 1,
        sourceId: ref.sourceId,
        sourceKind: ref.sourceKind,
        sourceCompetitionId: ref.competitionId,
        sourceCompetitionName: ref.competitionName,
        sourceDivisionId: ref.divisionId,
        sourceDivisionLabel: ref.divisionLabel,
        userId: e.userId,
        athleteName: e.athleteName,
        athleteEmail: e.athleteEmail,
        inviteId: null,
        inviteStatus: null,
        roundId: null,
        roundNumber: null,
      })
    })
  }

  return { rows }
}

// ============================================================================
// Test-only exports
// ============================================================================

/**
 * Internals exposed for unit tests in
 * `test/server/competition-invites/roster-allocations.test.ts`. Not
 * part of the production API surface.
 */
export const __test__ = {
  parseDivisionMappings,
  mapSourceDivisionToChampionship,
  computeCutoffForLeaderboard,
}
