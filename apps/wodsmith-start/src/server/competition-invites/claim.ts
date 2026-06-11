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

import { and, eq, gt, sql } from "drizzle-orm"
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
import { PENDING_PURCHASE_MAX_AGE_MINUTES } from "@/server-fns/competition-divisions-fns"
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
 * The lookup is intentionally activeMarker-agnostic so that *declined*
 * rows still resolve (per the decline flow they keep their
 * `claimToken`): an athlete revisiting a previously-declined link
 * should land on the friendly "Invite declined" page rather than a
 * generic "invalid link" error. `assertInviteClaimable` is the
 * authoritative gate — it inspects `status` and rejects every terminal
 * row before any claim work happens. `accepted_paid`, `expired`, and
 * `revoked` transitions still null `claimToken`, so a stale link with
 * one of those statuses never matches the `eq(claimToken, ...)`
 * predicate in the first place.
 */
export async function resolveInviteByToken(
  tokenPlaintext: string,
): Promise<CompetitionInvite | null> {
  if (!tokenPlaintext) return null
  const db = getDb()
  const rows = await db
    .select()
    .from(competitionInvitesTable)
    .where(eq(competitionInvitesTable.claimToken, tokenPlaintext))
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
 * Count occupied slots in a `(sourceId, championshipDivisionId)` bucket.
 * Mirrors the regular division-capacity pattern: a slot is occupied when
 * an invite has been claimed (`accepted_paid`) OR an athlete is mid-Stripe-
 * checkout for an invite-driven registration.
 *
 * "Mid-checkout" = a `commerce_purchases` row in `pending` with
 * `metadata.inviteId` pointing at an invite in this bucket and
 * `created_at > now - PENDING_PURCHASE_MAX_AGE_MINUTES`. The TTL matches
 * the Stripe checkout session expiry — abandoned sessions free their hold
 * implicitly without a sweep job. Pass `excludePurchaseId` to skip the
 * webhook's own purchase row during the authoritative race-close. Pass
 * `excludeInviteId` so the *invitee's own* mid-flight checkout doesn't
 * count against them when they revisit the claim page; the hold is theirs,
 * not someone else's contention.
 *
 * Existing accepted-paid count + soft-hold count = the number to compare
 * against the bucket's allocation. Two *different* athletes claiming the
 * last spot concurrently both see the hold in the count, so the second one
 * bounces at claim load instead of paying-then-refunding. The same athlete
 * re-clicking their own claim link does not.
 */
// @lat: [[competition-invites#Claim resolution]]
export async function getOccupiedCountForBucket(args: {
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

  const [accepted, pending] = await Promise.all([
    db
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
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(commercePurchaseTable)
      .innerJoin(
        competitionInvitesTable,
        sql`${competitionInvitesTable.id} = JSON_UNQUOTE(JSON_EXTRACT(${commercePurchaseTable.metadata}, '$.inviteId'))`,
      )
      .where(
        and(
          eq(
            commercePurchaseTable.competitionId,
            args.championshipCompetitionId,
          ),
          eq(
            commercePurchaseTable.divisionId,
            args.championshipDivisionId,
          ),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
          gt(commercePurchaseTable.createdAt, cutoff),
          eq(competitionInvitesTable.sourceId, args.sourceId),
          args.excludePurchaseId
            ? sql`${commercePurchaseTable.id} != ${args.excludePurchaseId}`
            : sql`1 = 1`,
          args.excludeInviteId
            ? sql`${competitionInvitesTable.id} != ${args.excludeInviteId}`
            : sql`1 = 1`,
        ),
      ),
  ])

  return Number(accepted[0]?.count ?? 0) + Number(pending[0]?.count ?? 0)
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

  // Fallback: load the source row and run the default math the loader
  // uses. The default is just `source.globalSpots` per division — no
  // multiplication, no series math.
  const source = await getSourceById(args.invite.sourceId)
  if (!source) return null

  const resolved = resolveSourceAllocations({
    source,
    championshipDivisions: [
      { id: args.invite.championshipDivisionId, label: "" },
    ],
    allocations: allocations.filter((a) => a.sourceId === args.invite.sourceId),
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
