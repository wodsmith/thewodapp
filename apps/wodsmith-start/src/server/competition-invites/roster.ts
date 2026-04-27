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
 */
// @lat: [[competition-invites#Roster computation]]

import { inArray } from "drizzle-orm"
import { getDb } from "@/db"
import type { CompetitionInviteSourceKind } from "@/db/schemas/competition-invites"
import { competitionsTable } from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { userTable } from "@/db/schemas/users"
import { getCompetitionLeaderboard } from "@/server/competition-leaderboard"
import { parseCompetitionSettings } from "@/server-fns/competition-divisions-fns"
import { listSourcesForChampionship } from "./sources"

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

/**
 * Resolve the (competitionId, name) tuples each source contributes:
 * single-comp source → 1 row; series source → every comp in the group.
 *
 * Returns a deduped list keyed by `competitionId` so a comp referenced
 * by both a direct source AND a series source only fetches once. The
 * first-encountered source wins for tagging.
 */
async function resolveSourceCompetitions(
  championshipId: string,
): Promise<SourceCompetitionRef[]> {
  const sources = await listSourcesForChampionship(championshipId)
  if (sources.length === 0) return []

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
        s.kind === "series" && !!s.sourceGroupId,
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

  const out: SourceCompetitionRef[] = []
  const seen = new Set<string>()

  for (const source of sources) {
    if (source.kind === "competition" && source.sourceCompetitionId) {
      if (seen.has(source.sourceCompetitionId)) continue
      const row = directComps.find((c) => c.id === source.sourceCompetitionId)
      if (!row) continue
      seen.add(source.sourceCompetitionId)
      out.push({
        sourceId: source.id,
        sourceKind: source.kind,
        competitionId: row.id,
        competitionName: row.name,
      })
    } else if (source.kind === "series" && source.sourceGroupId) {
      for (const c of seriesComps) {
        if (c.groupId !== source.sourceGroupId) continue
        if (seen.has(c.id)) continue
        seen.add(c.id)
        out.push({
          sourceId: source.id,
          sourceKind: source.kind,
          competitionId: c.id,
          competitionName: c.name,
        })
      }
    }
  }
  return out
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

// ============================================================================
// Main entry
// ============================================================================

export async function getChampionshipRoster(
  input: GetChampionshipRosterInput,
): Promise<{ rows: RosterRow[] }> {
  const comps = await resolveSourceCompetitions(input.championshipId)
  if (comps.length === 0) return { rows: [] }

  const divisionRefs = await resolveDivisionRefs(comps)
  if (divisionRefs.length === 0) return { rows: [] }

  // Fan out leaderboard fetches in parallel. Each call hits a cache on
  // the public render path; bounded by championship source count × per-
  // comp division count.
  const leaderboards = await Promise.all(
    divisionRefs.map((ref) =>
      getCompetitionLeaderboard({
        competitionId: ref.competitionId,
        divisionId: ref.divisionId,
      }).then((lb) => ({ ref, entries: lb.entries })),
    ),
  )

  const rows: RosterRow[] = []
  for (const { ref, entries } of leaderboards) {
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
        athleteEmail: null,
        inviteId: null,
        inviteStatus: null,
        roundId: null,
        roundNumber: null,
      })
    })
  }

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
