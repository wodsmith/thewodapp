/**
 * Championship Roster Computation
 *
 * `getChampionshipRoster` returns the unified roster view for a
 * championship + division: ordered rows derived from each qualification
 * source's leaderboard, cut at the source's spot allocation, with
 * invite-state columns set to null for now (Phase 2 attaches real
 * state).
 *
 * The function is intentionally split into (a) pure aggregation helpers
 * that are unit-tested directly, and (b) thin adapters over
 * `getCompetitionLeaderboard` / `getSeriesLeaderboard` that fetch rows.
 * This keeps the gnarly ordering + cutoff logic testable without
 * mocking the leaderboard stack.
 */
// @lat: [[competition-invites#Roster computation]]

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import type {
  CompetitionInviteSource,
  CompetitionInviteSourceKind,
} from "@/db/schemas/competition-invites"
import { seriesDivisionMappingsTable } from "@/db/schemas/series"
import { userTable } from "@/db/schemas/users"
import { getCompetitionLeaderboard } from "@/server/competition-leaderboard"
import { getSeriesLeaderboard } from "@/server/series-leaderboard"
import type { DivisionMapping } from "./sources"
import { listSourcesForChampionship } from "./sources"

// ============================================================================
// Types
// ============================================================================

export interface RosterRow {
  /** 1-based rank within the row's source. */
  sourcePlacement: number | null
  /** Human label for the source placement, e.g. "1st — SLC Throwdown". */
  sourcePlacementLabel: string | null
  /** Source id that qualified this athlete. */
  sourceId: string
  /** Source kind snapshot for UI tagging. */
  sourceKind: CompetitionInviteSourceKind
  /** Comp the athlete qualified at (single-comp or specific series comp). */
  sourceCompetitionId: string | null
  /** Stable athlete identity. `userId` may be null for series rows if the
   *  leaderboard lacks one (rare); `athleteName` is always present. */
  userId: string | null
  athleteName: string
  /** Email address for the athlete, resolved from `userTable` by `userId`.
   *  Null when the source leaderboard surfaced no user id (rare) or the
   *  user has no email on file. Populated post-aggregate in
   *  `getChampionshipRoster`. Phase 2 uses this to issue invites. */
  athleteEmail: string | null
  /** Mapped championship division for this row. */
  championshipDivisionId: string
  /** Invite-state columns — always null in Phase 1. */
  inviteId: null
  inviteStatus: null
  roundId: null
  roundNumber: null
  /** True when the row is below the source's cutoff (a "next N" waitlist
   *  candidate, not a qualified row). */
  belowCutoff: boolean
}

export interface GetChampionshipRosterInput {
  championshipId: string
  divisionId: string
  /** Optional filter hooks; Phase 1 only consumes `statuses` as a stub. */
  filters?: {
    statuses?: string[]
  }
}

// ============================================================================
// Pure helpers (unit-tested)
// ============================================================================

/** Parse the stored divisionMappings JSON. Returns [] if malformed/empty. */
export function parseDivisionMappings(
  raw: string | null | undefined,
): DivisionMapping[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is DivisionMapping =>
        !!v &&
        typeof v === "object" &&
        typeof (v as DivisionMapping).sourceDivisionId === "string" &&
        typeof (v as DivisionMapping).championshipDivisionId === "string",
    )
  } catch {
    return []
  }
}

/**
 * Resolve the source-side division id (on the source competition or
 * series template) that maps to the given championship division. Returns
 * null when no mapping exists — caller decides whether to fall back to
 * the unmapped leaderboard (we currently skip the source).
 */
export function resolveSourceDivisionId(
  mappings: DivisionMapping[],
  championshipDivisionId: string,
): string | null {
  const hit = mappings.find(
    (m) => m.championshipDivisionId === championshipDivisionId,
  )
  return hit ? hit.sourceDivisionId : null
}

/** Spots a source contributes to a given championship division. Falls
 *  back to the source's global allocation when the mapping omits it. */
export function resolveSpotsForDivision(params: {
  source: CompetitionInviteSource
  mappings: DivisionMapping[]
  championshipDivisionId: string
}): number {
  const hit = params.mappings.find(
    (m) => m.championshipDivisionId === params.championshipDivisionId,
  )
  if (hit?.spots) return hit.spots
  if (params.source.kind === "series") {
    // Series pre-cutoff: direct-per-comp is applied per-comp by the caller,
    // so this helper reports only the globalSpots count for the
    // global-candidate tier.
    return params.source.globalSpots ?? 0
  }
  return params.source.globalSpots ?? 0
}

/**
 * Aggregate qualifying rows across multiple sources, honoring each
 * source's spot allocation and skipping athletes already qualified by a
 * higher-priority source (series "direct-qualified skip-already").
 *
 * "Already qualified" means fully qualified somewhere higher — being on a
 * prior source's waitlist does NOT suppress the same athlete from
 * qualifying in a later source. Waitlist rows are deduped separately so
 * an athlete appears at most once across waitlists, and any waitlist row
 * is dropped if the same athlete qualifies anywhere else.
 */
export function aggregateQualifyingRows(
  rowsBySource: Array<{
    source: CompetitionInviteSource
    rows: Array<Omit<RosterRow, "belowCutoff">>
    cutoff: number
  }>,
): RosterRow[] {
  const qualifiedKeys = new Set<string>()
  const waitlistKeys = new Set<string>()
  const out: RosterRow[] = []
  const sorted = [...rowsBySource].sort(
    (a, b) => a.source.sortOrder - b.source.sortOrder,
  )
  for (const { rows, cutoff } of sorted) {
    let qualifiedCount = 0
    for (const row of rows) {
      const key = row.userId ?? `name:${row.athleteName}`
      if (qualifiedKeys.has(key)) continue // skip-already-qualified
      const belowCutoff = qualifiedCount >= cutoff
      if (belowCutoff) {
        if (waitlistKeys.has(key)) continue
        waitlistKeys.add(key)
        out.push({ ...row, belowCutoff: true })
      } else {
        qualifiedKeys.add(key)
        // Drop any earlier waitlist row for this athlete — a later
        // qualifier supersedes a higher-priority waitlist placement.
        const idx = out.findIndex(
          (r) =>
            r.belowCutoff &&
            (r.userId ?? `name:${r.athleteName}`) === key,
        )
        if (idx !== -1) out.splice(idx, 1)
        waitlistKeys.delete(key)
        out.push({ ...row, belowCutoff: false })
      }
      qualifiedCount += 1
    }
  }
  return out
}

// ============================================================================
// Row loaders
// ============================================================================

async function loadSingleCompetitionRows(
  source: CompetitionInviteSource,
  championshipDivisionId: string,
): Promise<Array<Omit<RosterRow, "belowCutoff">>> {
  if (!source.sourceCompetitionId) return []
  const mappings = parseDivisionMappings(source.divisionMappings)
  const sourceDivisionId = resolveSourceDivisionId(
    mappings,
    championshipDivisionId,
  )
  if (!sourceDivisionId) return []

  const lb = await getCompetitionLeaderboard({
    competitionId: source.sourceCompetitionId,
    divisionId: sourceDivisionId,
  })

  return lb.entries.map((e, idx) => ({
    sourcePlacement: idx + 1,
    sourcePlacementLabel: `${ordinal(idx + 1)} — source comp`,
    sourceId: source.id,
    sourceKind: source.kind,
    sourceCompetitionId: source.sourceCompetitionId ?? null,
    userId: e.userId,
    athleteName: e.athleteName,
    athleteEmail: null,
    championshipDivisionId,
    inviteId: null,
    inviteStatus: null,
    roundId: null,
    roundNumber: null,
  }))
}

/**
 * Per-comp direct qualifiers for a series source: top `directSpotsPerComp`
 * finishers of each comp (in its mapped division) qualify directly. Uses
 * `seriesDivisionMappingsTable` to resolve each comp's division that maps
 * to the series template division, then calls
 * `getCompetitionLeaderboard` for that comp.
 */
async function loadSeriesDirectRows(
  source: CompetitionInviteSource,
  championshipDivisionId: string,
): Promise<Array<Omit<RosterRow, "belowCutoff">>> {
  if (
    !source.sourceGroupId ||
    !source.directSpotsPerComp ||
    source.directSpotsPerComp <= 0
  ) {
    return []
  }
  const directSpotsPerComp = source.directSpotsPerComp
  const mappings = parseDivisionMappings(source.divisionMappings)
  const seriesDivisionId = resolveSourceDivisionId(
    mappings,
    championshipDivisionId,
  )
  if (!seriesDivisionId) return []

  const db = getDb()
  const perComp = await db
    .select({
      competitionId: seriesDivisionMappingsTable.competitionId,
      competitionDivisionId: seriesDivisionMappingsTable.competitionDivisionId,
    })
    .from(seriesDivisionMappingsTable)
    .where(
      and(
        eq(seriesDivisionMappingsTable.groupId, source.sourceGroupId),
        eq(seriesDivisionMappingsTable.seriesDivisionId, seriesDivisionId),
      ),
    )
  if (perComp.length === 0) return []

  const leaderboards = await Promise.all(
    perComp.map(({ competitionId, competitionDivisionId }) =>
      getCompetitionLeaderboard({
        competitionId,
        divisionId: competitionDivisionId,
      }).then((lb) => ({ competitionId, entries: lb.entries })),
    ),
  )

  const out: Array<Omit<RosterRow, "belowCutoff">> = []
  for (const { competitionId, entries } of leaderboards) {
    entries.slice(0, directSpotsPerComp).forEach((e, idx) => {
      out.push({
        sourcePlacement: idx + 1,
        sourcePlacementLabel: `${ordinal(idx + 1)} — series comp direct`,
        sourceId: source.id,
        sourceKind: source.kind,
        sourceCompetitionId: competitionId,
        userId: e.userId,
        athleteName: e.athleteName,
        athleteEmail: null,
        championshipDivisionId,
        inviteId: null,
        inviteStatus: null,
        roundId: null,
        roundNumber: null,
      })
    })
  }
  return out
}

async function loadSeriesGlobalRows(
  source: CompetitionInviteSource,
  championshipDivisionId: string,
): Promise<Array<Omit<RosterRow, "belowCutoff">>> {
  if (!source.sourceGroupId) return []
  const mappings = parseDivisionMappings(source.divisionMappings)
  const sourceDivisionId = resolveSourceDivisionId(
    mappings,
    championshipDivisionId,
  )
  if (!sourceDivisionId) return []

  const lb = await getSeriesLeaderboard({
    groupId: source.sourceGroupId,
    divisionId: sourceDivisionId,
  })

  return lb.entries.map((e, idx) => ({
    sourcePlacement: null,
    sourcePlacementLabel: `Series GLB · ${ordinal(idx + 1)}`,
    sourceId: source.id,
    sourceKind: source.kind,
    sourceCompetitionId: e.competitionId,
    userId: e.userId,
    athleteName: e.athleteName,
    athleteEmail: null,
    championshipDivisionId,
    inviteId: null,
    inviteStatus: null,
    roundId: null,
    roundNumber: null,
  }))
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// ============================================================================
// Main entry
// ============================================================================

export async function getChampionshipRoster(
  input: GetChampionshipRosterInput,
): Promise<{ rows: RosterRow[] }> {
  const sources = await listSourcesForChampionship(input.championshipId)
  const perSource: Array<{
    source: CompetitionInviteSource
    rows: Array<Omit<RosterRow, "belowCutoff">>
    cutoff: number
  }> = []
  for (const source of sources) {
    const mappings = parseDivisionMappings(source.divisionMappings)
    let rows: Array<Omit<RosterRow, "belowCutoff">>
    let cutoff: number
    if (source.kind === "series") {
      // Series sources qualify athletes two ways: top-N direct from each
      // comp + top-N from the series-global leaderboard. Direct qualifiers
      // are listed first; globals are appended with direct-athletes
      // filtered out. The source's cutoff expands to cover both tiers.
      const [direct, global] = await Promise.all([
        loadSeriesDirectRows(source, input.divisionId),
        loadSeriesGlobalRows(source, input.divisionId),
      ])
      const directKeys = new Set(
        direct.map((r) => r.userId ?? `name:${r.athleteName}`),
      )
      const globalFiltered = global.filter(
        (r) => !directKeys.has(r.userId ?? `name:${r.athleteName}`),
      )
      rows = [...direct, ...globalFiltered]
      const globalCutoff = resolveSpotsForDivision({
        source,
        mappings,
        championshipDivisionId: input.divisionId,
      })
      cutoff = direct.length + globalCutoff
    } else {
      rows = await loadSingleCompetitionRows(source, input.divisionId)
      cutoff = resolveSpotsForDivision({
        source,
        mappings,
        championshipDivisionId: input.divisionId,
      })
    }
    perSource.push({ source, rows, cutoff })
  }
  const rows = aggregateQualifyingRows(perSource)

  // Hydrate athlete emails in a single bulk lookup. Rows with no userId
  // keep `athleteEmail = null`; the organizer UI disables the row for
  // sending and shows a hint.
  const userIds = Array.from(
    new Set(rows.map((r) => r.userId).filter((v): v is string => !!v)),
  )
  if (userIds.length > 0) {
    const db = getDb()
    const users = await db
      .select({ id: userTable.id, email: userTable.email })
      .from(userTable)
      .where(inArray(userTable.id, userIds))
    const byId = new Map(users.map((u) => [u.id, u.email]))
    for (const row of rows) {
      if (row.userId) {
        row.athleteEmail = byId.get(row.userId) ?? null
      }
    }
  }

  return { rows }
}
