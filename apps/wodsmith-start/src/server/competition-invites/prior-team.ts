/**
 * Resolve the team an invitee was on in the qualifying source competition,
 * so the championship registration form can pre-fill teammate slots.
 *
 * Triggered when an athlete clicks `/compete/$slug/claim/$token` and lands
 * on `/compete/$slug/register?invite=...&divisionId=...` for a team
 * division. The invite carries `sourceCompetitionId` (the prior comp where
 * they qualified — the specific comp inside a series for kind=series
 * sources). We look up the invitee's `competition_registration` in that
 * prior comp and, if it was a team registration (`athleteTeamId` set),
 * return the other members of that athlete team. The captain (= invitee)
 * is filtered out.
 *
 * Multi-division source athletes: an athlete may have multiple registrations
 * in one source comp (e.g. captain of a partner team AND individual in a
 * solo division). When `destinationTeamSize` is supplied, we prefer a source
 * registration whose source-division `teamSize` matches the destination
 * championship division's `teamSize`. Tie-break on oldest `registeredAt`.
 * Falls back to "any team registration" if no exact match.
 *
 * Bespoke invites (no `sourceCompetitionId`) and individual prior
 * registrations (`athleteTeamId IS NULL`) return `null` — caller falls
 * back to empty teammate slots.
 */
// @lat: [[competition-invites#Prior team prefill]]

import { and, asc, eq, ne } from "drizzle-orm"
import { getDb } from "@/db"
import type { CompetitionInvite } from "@/db/schemas/competition-invites"
import {
  REGISTRATION_STATUS,
  competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { teamMembershipTable } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { normalizeInviteEmail } from "./issue"

export interface PriorTeammate {
  email: string
  firstName: string
  lastName: string
  affiliateName: string
}

export interface PriorTeam {
  /** The team name from the prior registration (e.g. "Team Crush"). */
  teamName: string
  /** Other members of the prior athlete team. Captain (invitee) excluded. */
  teammates: PriorTeammate[]
}

export async function getPriorTeamForInvite(args: {
  invite: Pick<CompetitionInvite, "sourceCompetitionId" | "userId" | "email">
  /**
   * The destination championship division's `teamSize`. When supplied and
   * > 1, the helper prefers a source registration whose source-division
   * `teamSize` matches this value — disambiguating multi-division source
   * athletes (e.g. partner-captain + solo registrant in the same source).
   * When unset, the helper falls back to its legacy "first team reg wins"
   * behavior.
   */
  destinationTeamSize?: number
}): Promise<PriorTeam | null> {
  const { invite, destinationTeamSize } = args
  if (!invite.sourceCompetitionId) return null

  const db = getDb()

  // 1. Resolve invitee userId. Prefer the invite's denormalized userId; fall
  //    back to a user lookup by email so prefill still works for invites
  //    issued before the invitee had an account (now claimed post sign-up).
  let inviteeUserId = invite.userId ?? null
  if (!inviteeUserId) {
    const [u] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, normalizeInviteEmail(invite.email)))
      .limit(1)
    inviteeUserId = u?.id ?? null
  }
  if (!inviteeUserId) return null

  // 2. Find the invitee's registration(s) in the prior comp. We accept either:
  //    - userId match (they were captain), OR
  //    - membership in the prior athleteTeam (they were a teammate).
  //    A single user may have multiple captain rows when registered in
  //    several divisions in the source. Pull all of them and rank by
  //    source-division teamSize == destinationTeamSize, then registeredAt.
  const captainRegs = await db
    .select({
      athleteTeamId: competitionRegistrationsTable.athleteTeamId,
      teamName: competitionRegistrationsTable.teamName,
      registeredAt: competitionRegistrationsTable.registeredAt,
      sourceTeamSize: scalingLevelsTable.teamSize,
    })
    .from(competitionRegistrationsTable)
    .leftJoin(
      scalingLevelsTable,
      eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
    )
    .where(
      and(
        eq(competitionRegistrationsTable.eventId, invite.sourceCompetitionId),
        eq(competitionRegistrationsTable.userId, inviteeUserId),
        ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
      ),
    )
    .orderBy(asc(competitionRegistrationsTable.registeredAt))

  const teamCaptainRegs = captainRegs.filter((r) => r.athleteTeamId)
  const preferredCaptain =
    typeof destinationTeamSize === "number" && destinationTeamSize > 1
      ? teamCaptainRegs.find((r) => r.sourceTeamSize === destinationTeamSize) ??
        teamCaptainRegs[0]
      : teamCaptainRegs[0]

  let athleteTeamId = preferredCaptain?.athleteTeamId ?? null
  let teamName = preferredCaptain?.teamName ?? null

  if (!athleteTeamId) {
    // Membership lane: invitee was a teammate (not captain) on a prior
    // athlete team. Find any active membership in a team that has a
    // registration in the source comp.
    const memberships = await db
      .select({ teamId: teamMembershipTable.teamId })
      .from(teamMembershipTable)
      .where(
        and(
          eq(teamMembershipTable.userId, inviteeUserId),
          eq(teamMembershipTable.isActive, true),
        ),
      )
    const teamIds = memberships.map((m) => m.teamId)
    if (teamIds.length === 0) return null

    // We need the registration row whose athleteTeamId is in teamIds.
    // Drizzle doesn't accept inArray with empty arrays gracefully so we
    // already early-returned above.
    const candidateRegs = await db
      .select({
        athleteTeamId: competitionRegistrationsTable.athleteTeamId,
        teamName: competitionRegistrationsTable.teamName,
        registeredAt: competitionRegistrationsTable.registeredAt,
        sourceTeamSize: scalingLevelsTable.teamSize,
      })
      .from(competitionRegistrationsTable)
      .leftJoin(
        scalingLevelsTable,
        eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
      )
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, invite.sourceCompetitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .orderBy(asc(competitionRegistrationsTable.registeredAt))

    const memberCandidates = candidateRegs.filter(
      (r) => r.athleteTeamId && teamIds.includes(r.athleteTeamId),
    )
    const match =
      typeof destinationTeamSize === "number" && destinationTeamSize > 1
        ? memberCandidates.find(
            (r) => r.sourceTeamSize === destinationTeamSize,
          ) ?? memberCandidates[0]
        : memberCandidates[0]

    if (!match?.athleteTeamId) return null
    athleteTeamId = match.athleteTeamId
    teamName = match.teamName
  }

  // 3. Pull the team's other active members (excluding the invitee).
  const rows = await db
    .select({
      email: userTable.email,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      affiliateName: userTable.affiliateName,
    })
    .from(teamMembershipTable)
    .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, athleteTeamId),
        eq(teamMembershipTable.isActive, true),
        ne(teamMembershipTable.userId, inviteeUserId),
      ),
    )

  const teammates: PriorTeammate[] = rows.map((r) => ({
    email: r.email ?? "",
    firstName: r.firstName ?? "",
    lastName: r.lastName ?? "",
    affiliateName: r.affiliateName ?? "",
  }))

  return {
    teamName: teamName ?? "",
    teammates,
  }
}
