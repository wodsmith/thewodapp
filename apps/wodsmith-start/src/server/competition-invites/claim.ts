/**
 * Competition-invite claim resolution (Phase 2 sub-arc B).
 *
 * Read-side logic for the invite claim flow. Given a URL-bound plaintext
 * token, this module:
 * - looks up the `competition_invites` row by plaintext `claimToken`
 *   ({@link resolveInviteByToken}) — mirrors the `team_invitations.token`
 *   pattern,
 * - asserts the row is still claimable — active status, token still
 *   present, expiry in the future, competition accepting invites
 *   ({@link assertInviteClaimable}),
 * - and compares the invite's locked email against a session's email,
 *   returning a discriminated result the route loader branches on
 *   ({@link identityMatch}).
 *
 * Nothing here *transitions* invite status — the `pending → accepted_paid`
 * hop happens inside the Stripe webhook workflow (Phase 2 sub-arc C). This
 * module is side-effect-free beyond DB reads, so it's safe to call from
 * route loaders, server functions, and tests.
 *
 * Pure helpers (`identityMatch`, `assertInviteClaimable`, types) live in
 * [[./identity.ts]] so route files can import them without dragging in
 * `getDb` (and the `cloudflare:workers` binding) — Vite chokes on the latter
 * when bundling the client.
 */
// @lat: [[competition-invites#Claim resolution]]

import { and, eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { competitionsTable } from "@/db/schemas/competitions"
import {
  listAllocationsForChampionship,
  resolveSourceAllocations,
} from "./allocations"
import { assertInviteClaimable, InviteNotClaimableError } from "./identity"
import { getSourceById } from "./sources"

// Re-export the pure helpers/types so existing imports of this module keep
// working. Route files should import from `./identity` directly.
export {
  assertInviteClaimable,
  type IdentityMatchOptions,
  type IdentityMatchResult,
  type IdentityMatchSession,
  type InviteClaimableError,
  InviteNotClaimableError,
  identityMatch,
} from "./identity"

// ============================================================================
// Resolve by token
// ============================================================================

/**
 * Look up the invite row by plaintext `claimToken`. Mirrors the
 * `team_invitations.token` pattern (`eq(token, ...)` direct lookup).
 * Returns `null` when no row exists — callers render the generic
 * "invite link is invalid or expired" page without leaking whether the
 * token ever existed.
 *
 * The `activeMarker = "active"` filter deliberately excludes
 * declined/expired/revoked rows: those have had their `claimToken`
 * nulled, but we belt-and-suspenders the query so a stale token that
 * somehow survived never resolves. Paid rows also have their token
 * nulled, so the happy path "you already claimed" short-circuit is
 * handled by {@link assertInviteClaimable} on the live re-read, not here.
 */
export async function resolveInviteByToken(
  tokenPlaintext: string,
): Promise<CompetitionInvite | null> {
  if (!tokenPlaintext) return null
  const db = getDb()
  const rows = await db
    .select()
    .from(competitionInvitesTable)
    .where(
      and(
        eq(competitionInvitesTable.claimToken, tokenPlaintext),
        eq(
          competitionInvitesTable.activeMarker,
          COMPETITION_INVITE_ACTIVE_MARKER,
        ),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

// ============================================================================
// Composite lookup (convenience)
// ============================================================================

export interface ResolveInviteForClaimResult {
  invite: CompetitionInvite
}

/**
 * Combined resolve + claimability check. Callers that just want the
 * "is this a usable invite right now?" answer use this so they don't
 * forget one of the two steps. Throws {@link InviteNotClaimableError} on
 * any failure so the route loader can switch on `.reason`.
 */
export async function resolveInviteForClaim(
  tokenPlaintext: string,
  now: Date = new Date(),
): Promise<ResolveInviteForClaimResult> {
  const invite = await resolveInviteByToken(tokenPlaintext)
  if (!invite) {
    throw new InviteNotClaimableError("not_found")
  }
  assertInviteClaimable(invite, now)
  return { invite }
}

// ============================================================================
// Allocation guardrail (ADR-0012 Phase 5)
// ============================================================================

/**
 * Count `competition_invites` rows in `accepted_paid` for a single
 * `(sourceId, championshipDivisionId)` bucket. Used by the claim-time
 * allocation guardrail and the Stripe-workflow re-check.
 *
 * `Number()` wraps the count because the PlanetScale driver can return a
 * string for COUNT(*) — matches the pattern used elsewhere in this module.
 */
// @lat: [[competition-invites#Claim resolution]]
export async function getAcceptedPaidCountForBucket(args: {
  sourceId: string
  championshipDivisionId: string
}): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(competitionInvitesTable)
    .where(
      and(
        eq(competitionInvitesTable.sourceId, args.sourceId),
        eq(
          competitionInvitesTable.championshipDivisionId,
          args.championshipDivisionId,
        ),
        eq(
          competitionInvitesTable.status,
          COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
        ),
      ),
    )
  return Number(rows[0]?.count ?? 0)
}

/**
 * Resolve the per-(source, championship-division) allocation for one
 * invite. Returns `null` for bespoke invites (`sourceId IS NULL`) — the
 * allocation model doesn't apply to them.
 *
 * Uses {@link listAllocationsForChampionship} to find an explicit override;
 * falls back to the source default (computed via
 * {@link resolveSourceAllocations}) when no override row is present. Loads
 * the source row + series comp-count only when needed (the slow claim
 * path).
 */
// @lat: [[competition-invites#Claim resolution]]
export async function resolveAllocationForInvite(args: {
  invite: Pick<
    CompetitionInvite,
    "sourceId" | "championshipDivisionId" | "championshipCompetitionId"
  >
}): Promise<number | null> {
  if (!args.invite.sourceId) return null

  const allocations = await listAllocationsForChampionship({
    championshipCompetitionId: args.invite.championshipCompetitionId,
  })

  // Fast path: explicit absolute-spots override for this (source, division).
  // A row may exist with `spots = null` and `globalSpots` set (per-division
  // global-leaderboard override) — in that case we must fall through to
  // the resolver path so the direct + global formula is applied.
  const override = allocations.find(
    (a) =>
      a.sourceId === args.invite.sourceId &&
      a.championshipDivisionId === args.invite.championshipDivisionId,
  )
  if (override?.spots != null) return override.spots

  // Fallback: load the source row + (if series) its comp count, then run
  // the same default math the loader uses.
  const source = await getSourceById(args.invite.sourceId)
  if (!source) return null

  let seriesCompCount: number | undefined
  if (source.sourceGroupId) {
    const db = getDb()
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(competitionsTable)
      .where(eq(competitionsTable.groupId, source.sourceGroupId))
    seriesCompCount = Number(rows[0]?.count ?? 0)
  }

  const resolved = resolveSourceAllocations({
    source,
    championshipDivisions: [
      { id: args.invite.championshipDivisionId, label: "" },
    ],
    allocations: allocations.filter((a) => a.sourceId === args.invite.sourceId),
    seriesCompCount,
  })

  return resolved.byDivision[args.invite.championshipDivisionId] ?? 0
}

// ============================================================================
// Find active invite for email (used by registered-redirect cross-check)
// ============================================================================

/**
 * Read-only helper: does an active invite exist for this
 * (championship, division, email) tuple? Used by the claim page to
 * short-circuit a second click of an *accepted_paid* link to "you're
 * already registered" without reissuing a token.
 *
 * Returns the first matching active row or `null`. Email normalization is
 * the caller's responsibility — pass already-normalized input.
 */
export async function findActiveInviteForEmail(params: {
  championshipCompetitionId: string
  championshipDivisionId: string
  email: string
}): Promise<CompetitionInvite | null> {
  const db = getDb()
  const rows = await db
    .select()
    .from(competitionInvitesTable)
    .where(
      and(
        eq(
          competitionInvitesTable.championshipCompetitionId,
          params.championshipCompetitionId,
        ),
        eq(
          competitionInvitesTable.championshipDivisionId,
          params.championshipDivisionId,
        ),
        eq(competitionInvitesTable.email, params.email),
        eq(
          competitionInvitesTable.activeMarker,
          COMPETITION_INVITE_ACTIVE_MARKER,
        ),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}
