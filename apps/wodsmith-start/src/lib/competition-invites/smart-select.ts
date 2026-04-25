/**
 * Smart-select helpers for the round-builder right-rail.
 *
 * Pure functions over (roster rows, active invites, round entries) that
 * compute the set of selection keys / draft ids for each quick-add button.
 * Living in `src/lib` (not `src/server`) keeps them safely client-bundled —
 * the round-builder runs entirely in the browser and only POSTs through
 * `issueInvitesFn` to commit a send.
 *
 * Three quick actions per ADR-0011 Phase 3:
 *   - {@link selectReinviteNonResponders} — every recipient of the most
 *     recent sent round whose status is still pending/expired/revoked.
 *   - {@link selectNextOnLeaderboard} — the next N roster rows below the
 *     source cutoff not already covered by an active invite.
 *   - {@link selectAllDraftBespoke} — every bespoke draft (no token yet).
 */

import {
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_ROUND_STATUS,
  COMPETITION_INVITE_STATUS,
} from "@/db/schemas/competition-invites"

// ============================================================================
// Inputs
// ============================================================================

/**
 * Minimal roster-row shape the helpers need. Mirrors `RosterRow` but kept
 * narrow so the helpers can be exercised without dragging the server
 * roster module into the test environment.
 */
export interface SmartSelectRosterRow {
  athleteEmail: string | null
  championshipDivisionId: string
  belowCutoff: boolean
}

/** Minimal invite-summary shape from `listActiveInvitesFn`. */
export interface SmartSelectInviteSummary {
  id: string
  email: string
  origin: typeof COMPETITION_INVITE_ORIGIN[keyof typeof COMPETITION_INVITE_ORIGIN]
  status: typeof COMPETITION_INVITE_STATUS[keyof typeof COMPETITION_INVITE_STATUS]
  championshipDivisionId: string
  hasClaimToken: boolean
  activeMarker: string | null
}

/** Minimal round-detail shape from `listRoundsFn`. */
export interface SmartSelectRoundEntry {
  round: {
    id: string
    roundNumber: number
    status: string
    sentAt: Date | string | null
  }
}

/**
 * Roster row key + recipient identity carrier — what the round-builder
 * stores in its selection set. Mirrors the `rosterRowKey` shape used by
 * the championship roster table.
 */
export interface RosterSelectionKey {
  key: string
  email: string
  divisionId: string
}

// ============================================================================
// Helpers
// ============================================================================

function lower(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Pick the most recent sent round (by `roundNumber` descending). Skips
 * draft / sending / failed entries — those have no committed recipient
 * list to re-invite from.
 */
export function pickMostRecentSentRound(
  rounds: SmartSelectRoundEntry[],
): SmartSelectRoundEntry | null {
  return (
    rounds
      .filter(
        (r) => r.round.status === COMPETITION_INVITE_ROUND_STATUS.SENT,
      )
      .sort((a, b) => b.round.roundNumber - a.round.roundNumber)[0] ?? null
  )
}

/**
 * For "Re-invite non-responders": from the most recent sent round, return
 * the emails whose current invite is still in a re-issuable status
 * (pending / expired / revoked). The caller maps those emails back into
 * roster row keys + draft ids on its side.
 *
 * `roundInvitesByRound` is a map keyed by round id whose values are the
 * invites that round currently owns — populated by the caller from
 * `listActiveInvitesFn` plus per-round detail fetches as needed.
 */
export function selectReinviteNonResponderEmails(params: {
  rounds: SmartSelectRoundEntry[]
  roundInvitesByRound: Map<
    string,
    Array<Pick<SmartSelectInviteSummary, "email" | "status">>
  >
}): string[] {
  const round = pickMostRecentSentRound(params.rounds)
  if (!round) return []
  const recipients = params.roundInvitesByRound.get(round.round.id) ?? []
  const NON_RESPONDER_STATUSES: Array<SmartSelectInviteSummary["status"]> = [
    COMPETITION_INVITE_STATUS.PENDING,
    COMPETITION_INVITE_STATUS.EXPIRED,
    COMPETITION_INVITE_STATUS.REVOKED,
  ]
  const emails = new Set<string>()
  for (const r of recipients) {
    if (!NON_RESPONDER_STATUSES.includes(r.status)) continue
    emails.add(lower(r.email))
  }
  return Array.from(emails)
}

/**
 * Build a quick lookup over active invites keyed by
 * `${divisionId}::${lowercaseEmail}` so callers can ask "is this row
 * already invited?" in O(1). Mirrors the index pattern already in use on
 * the organizer route.
 */
export function indexActiveInvitesByDivisionEmail(
  invites: SmartSelectInviteSummary[],
): Map<string, SmartSelectInviteSummary> {
  const map = new Map<string, SmartSelectInviteSummary>()
  for (const inv of invites) {
    if (inv.activeMarker !== "active") continue
    map.set(`${inv.championshipDivisionId}::${lower(inv.email)}`, inv)
  }
  return map
}

/**
 * For "Next N on leaderboard": from the roster rows below the cutoff,
 * pick the next N that have an email and are not already covered by an
 * active invite. Preserves roster order (which is `(sortOrder, placement)`
 * out of `getChampionshipRoster`).
 */
export function selectNextOnLeaderboard(params: {
  rows: SmartSelectRosterRow[]
  invitesByDivisionEmail: Map<string, SmartSelectInviteSummary>
  count: number
}): SmartSelectRosterRow[] {
  if (params.count <= 0) return []
  const out: SmartSelectRosterRow[] = []
  for (const row of params.rows) {
    if (out.length >= params.count) break
    if (!row.belowCutoff) continue
    if (!row.athleteEmail) continue
    const key = `${row.championshipDivisionId}::${lower(row.athleteEmail)}`
    if (params.invitesByDivisionEmail.has(key)) continue
    out.push(row)
  }
  return out
}

/**
 * For "All draft bespoke invitees": every active bespoke invite without a
 * token yet (the "active but no token" draft shape). The caller renders
 * these as the bespoke recipient chips.
 */
export function selectAllDraftBespoke(
  invites: SmartSelectInviteSummary[],
): SmartSelectInviteSummary[] {
  return invites.filter(
    (inv) =>
      inv.activeMarker === "active" &&
      inv.origin === COMPETITION_INVITE_ORIGIN.BESPOKE &&
      !inv.hasClaimToken,
  )
}
