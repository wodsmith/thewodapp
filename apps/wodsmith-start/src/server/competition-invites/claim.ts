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

import { and, eq, gt, inArray, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMMERCE_PURCHASE_STATUS,
  commercePurchaseTable,
} from "@/db/schemas/commerce"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { competitionsTable } from "@/db/schemas/competitions"
import { PENDING_PURCHASE_MAX_AGE_MINUTES } from "@/server-fns/competition-divisions-fns"
import {
  listAllocationsForChampionship,
  resolveSourceAllocations,
} from "./allocations"
import {
  assertInviteClaimable,
  extractInviteIdsFromPurchaseMetadata,
  InviteNotClaimableError,
} from "./identity"
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
// @lat: [[competition-invites#Claim allocation guardrail]]
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
 * Count Stripe-in-flight pending purchases that are *holding* a slot in a
 * `(sourceId, championshipDivisionId)` allocation bucket. Mirrors the way
 * `getDivisionSpotsAvailableFn` counts pending purchases against division
 * capacity: a checkout session that has not yet completed (or expired) is a
 * temporary reservation, and over-issued buckets must respect those
 * reservations or two invitees can race to pay for the same last spot.
 *
 * Bucket members are *active* `competition_invites` rows (status `pending`
 * or `accepted_paid`) sharing `(sourceId, championshipDivisionId)` —
 * `accepted_paid` rows are excluded from the **pending-purchase** count
 * (their slot is consumed via {@link getAcceptedPaidCountForBucket}); we
 * only count rows still in `pending` whose linked `commerce_purchase`
 * row is `PENDING` and was created within {@link PENDING_PURCHASE_MAX_AGE_MINUTES}.
 *
 * The link from purchase → invite lives in `commerce_purchases.metadata`
 * JSON (`metadata.inviteId`) — the same field
 * `initiateRegistrationPaymentFn` writes when stamping the purchase. We
 * fetch the candidate purchases (cheap: filtered by competition + division
 * + status + recent createdAt, all indexed columns) and join in JS rather
 * than rely on JSON-text matching, which has uneven cross-driver support
 * on PlanetScale + Hyperdrive.
 *
 * `excludePurchaseId` is the workflow's own purchase: at webhook-time the
 * caller's PENDING row is about to flip to COMPLETED, so it must not
 * count against itself or the re-check refunds the very payment that
 * just succeeded.
 *
 * `excludeInviteId` is the *current invite*'s own in-flight purchase: the
 * payment-init guard counts how many *other* invitees in the bucket are
 * holding a slot. Without this exclusion, a second click of "Pay" by the
 * same invitee (after their own session expired/cancelled but before the
 * 35-min window closed) would count itself out of the bucket.
 */
// @lat: [[competition-invites#Claim allocation guardrail]]
export async function getInFlightAllocationCountForBucket(args: {
  sourceId: string
  championshipCompetitionId: string
  championshipDivisionId: string
  excludePurchaseId?: string
  excludeInviteId?: string
}): Promise<number> {
  const db = getDb()

  const cutoff = new Date(
    Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000,
  )

  const purchases = await db
    .select({
      id: commercePurchaseTable.id,
      metadata: commercePurchaseTable.metadata,
    })
    .from(commercePurchaseTable)
    .where(
      and(
        eq(commercePurchaseTable.competitionId, args.championshipCompetitionId),
        eq(commercePurchaseTable.divisionId, args.championshipDivisionId),
        eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
        gt(commercePurchaseTable.createdAt, cutoff),
        args.excludePurchaseId
          ? ne(commercePurchaseTable.id, args.excludePurchaseId)
          : undefined,
      ),
    )

  if (purchases.length === 0) return 0

  const candidateInviteIds = extractInviteIdsFromPurchaseMetadata({
    purchases,
    excludeInviteId: args.excludeInviteId,
  })

  if (candidateInviteIds.length === 0) return 0

  const matchingInvites = await db
    .select({ id: competitionInvitesTable.id })
    .from(competitionInvitesTable)
    .where(
      and(
        inArray(competitionInvitesTable.id, candidateInviteIds),
        eq(competitionInvitesTable.sourceId, args.sourceId),
        eq(
          competitionInvitesTable.championshipDivisionId,
          args.championshipDivisionId,
        ),
        eq(competitionInvitesTable.status, COMPETITION_INVITE_STATUS.PENDING),
      ),
    )

  return matchingInvites.length
}

/**
 * The full bucket usage that gates a new claim — accepted-paid claims plus
 * Stripe-in-flight holds. Wrappers that just need the headline count call
 * this so the two pieces stay in lock-step; callers that need to log the
 * components separately can still call the underlying helpers.
 *
 * The two underlying queries are independent — kicking them off in
 * parallel keeps the payment-init path responsive on the hot click path.
 */
// @lat: [[competition-invites#Claim allocation guardrail]]
export async function getBucketUsageWithHolds(args: {
  sourceId: string
  championshipCompetitionId: string
  championshipDivisionId: string
  excludePurchaseId?: string
  excludeInviteId?: string
}): Promise<{ acceptedCount: number; pendingCount: number; total: number }> {
  const [acceptedCount, pendingCount] = await Promise.all([
    getAcceptedPaidCountForBucket({
      sourceId: args.sourceId,
      championshipDivisionId: args.championshipDivisionId,
    }),
    getInFlightAllocationCountForBucket({
      sourceId: args.sourceId,
      championshipCompetitionId: args.championshipCompetitionId,
      championshipDivisionId: args.championshipDivisionId,
      excludePurchaseId: args.excludePurchaseId,
      excludeInviteId: args.excludeInviteId,
    }),
  ])
  return {
    acceptedCount,
    pendingCount,
    total: acceptedCount + pendingCount,
  }
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

  // Fast path: explicit override row for this (source, division).
  const override = allocations.find(
    (a) =>
      a.sourceId === args.invite.sourceId &&
      a.championshipDivisionId === args.invite.championshipDivisionId,
  )
  if (override) return override.spots

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
