/**
 * Invite Source Candidates Query
 *
 * `getCandidatesForSourceComp` returns the set of athletes from a single
 * source competition that are eligible to surface on the championship
 * organizer's Candidates page for a given source-side division, ranked
 * to mirror the source competition's leaderboard exactly.
 *
 * The placement (`overallRank`) on each candidate row is the same value
 * the qualifier's leaderboard would render for that athlete: total points
 * + tiebreakers from `getCompetitionLeaderboard`. Organizers use this as
 * the source of truth when picking whom to invite, so any divergence
 * between the invite roster and the public qualifier leaderboard is a
 * bug — they must agree on rank and on athlete inclusion.
 *
 * `bypassPublicationFilter: true` is intentional: the candidates page is
 * organizer-only and must surface the working ranking even before the
 * organizer publishes per-division results to athletes (online comps
 * default to "everything hidden until published"). The same scoring
 * algorithm and tiebreakers apply either way, so the ordering still
 * matches what athletes will see once results go public.
 */
// @lat: [[competition-invites#Candidates query]]

import "server-only"

import { inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { userTable } from "@/db/schemas/users"
import {
  getCompetitionLeaderboard,
  type TeamMemberInfo,
} from "@/server/competition-leaderboard"

// ============================================================================
// Types
// ============================================================================

export interface CandidateEntry {
  /** Registration row that produced this candidate. */
  registrationId: string
  /** Captain user id for the registration. */
  userId: string
  /** Display name — "First Last", or email when names are missing. */
  athleteName: string
  /** Athlete email; null only when the user row has no email on file. */
  athleteEmail: string | null
  /** Source-side division id (scaling level) on the source comp. */
  divisionId: string
  /** Source-side division label (e.g. "Co-Ed - RX"). */
  divisionLabel: string
  /**
   * 1-based placement on the source competition's leaderboard. Same
   * value `getCompetitionLeaderboard` would render for this athlete.
   * Athletes with no scores tie at the bottom (per competition ranking
   * rules); their rank is still deterministic.
   */
  overallRank: number
  /** Total points used to compute `overallRank`. */
  totalPoints: number
  /** True for team divisions (`teamSize > 1`). Mirrors the leaderboard's
   *  `isTeamDivision` so the candidates table can render a team row
   *  identically to the qualifier's leaderboard. */
  isTeamDivision: boolean
  /** Registration's team name when `isTeamDivision`; null for individual
   *  divisions or unnamed teams. */
  teamName: string | null
  /** Active members on the captain's `athleteTeam`, sorted captain-first.
   *  Empty for individual divisions. */
  teamMembers: TeamMemberInfo[]
}

export interface GetCandidatesForSourceCompInput {
  competitionId: string
  divisionId: string
}

export interface GetCandidatesForSourceCompResult {
  entries: CandidateEntry[]
}

// ============================================================================
// Query
// ============================================================================

/**
 * Return ranked candidates for `(competitionId, divisionId)` by mirroring
 * the source competition's leaderboard. Entries are ordered by
 * `overallRank` ascending so `entries[0]` is the qualifier's #1.
 */
export async function getCandidatesForSourceComp(
  input: GetCandidatesForSourceCompInput,
): Promise<GetCandidatesForSourceCompResult> {
  // Mirror the leaderboard the qualifier's organizers and athletes see.
  // `bypassPublicationFilter: true` keeps draft/unpublished events in
  // the ranking so the organizer-only candidates page doesn't go blank
  // just because results haven't been published to athletes yet — the
  // ordering is still the same scoring algorithm + tiebreakers the
  // public leaderboard uses, so once the qualifier publishes the two
  // surfaces agree row for row.
  const { entries: leaderboardEntries } = await getCompetitionLeaderboard({
    competitionId: input.competitionId,
    divisionId: input.divisionId,
    bypassPublicationFilter: true,
  })

  if (leaderboardEntries.length === 0) {
    return { entries: [] }
  }

  // Hydrate athlete email from `userTable`. The leaderboard projection
  // doesn't carry email today; we fetch it in one batched query keyed
  // by the userIds the leaderboard returned.
  const userIds = Array.from(new Set(leaderboardEntries.map((e) => e.userId)))
  const db = getDb()
  const users = await db
    .select({
      id: userTable.id,
      email: userTable.email,
    })
    .from(userTable)
    .where(inArray(userTable.id, userIds))

  const emailByUserId = new Map(users.map((u) => [u.id, u.email]))

  const entries: CandidateEntry[] = leaderboardEntries.map((e) => ({
    registrationId: e.registrationId,
    userId: e.userId,
    athleteName: e.athleteName,
    athleteEmail: emailByUserId.get(e.userId) ?? null,
    divisionId: e.divisionId,
    divisionLabel: e.divisionLabel,
    overallRank: e.overallRank,
    totalPoints: e.totalPoints,
    isTeamDivision: e.isTeamDivision,
    teamName: e.teamName,
    teamMembers: e.teamMembers,
  }))

  // Defensive sort: `getCompetitionLeaderboard` already returns
  // division-grouped + rank-sorted entries, but we re-sort here so the
  // candidates contract is "ascending overallRank" regardless of
  // upstream ordering changes.
  entries.sort((a, b) => a.overallRank - b.overallRank)

  return { entries }
}
