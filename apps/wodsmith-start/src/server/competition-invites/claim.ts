/**
 * Competition-invite claim resolution (Phase 2 sub-arc B).
 *
 * Read-side logic for the invite claim flow. Given a URL-bound plaintext
 * token, this module:
 * - hashes the plaintext and looks up the `competition_invites` row
 *   ({@link resolveInviteByToken}),
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

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  type CompetitionInvite,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { hashInviteClaimToken } from "@/lib/competition-invites/tokens"
import {
  assertInviteClaimable,
  InviteNotClaimableError,
} from "./identity"

// Re-export the pure helpers/types so existing imports of this module keep
// working. Route files should import from `./identity` directly.
export {
  assertInviteClaimable,
  identityMatch,
  InviteNotClaimableError,
  type IdentityMatchOptions,
  type IdentityMatchResult,
  type IdentityMatchSession,
  type InviteClaimableError,
} from "./identity"

// ============================================================================
// Resolve by token
// ============================================================================

/**
 * Hash the plaintext token and look up the invite row. Returns `null` when
 * no row exists — callers render the generic "invite link is invalid or
 * expired" page without leaking whether the token ever existed.
 *
 * The `activeMarker = "active"` filter deliberately excludes
 * declined/expired/revoked rows: those have had their `claimTokenHash`
 * nulled, but we belt-and-suspenders the query so a stale token that
 * somehow survived never resolves. Paid rows also have their hash nulled,
 * so the happy path "you already claimed" short-circuit is handled by
 * {@link assertInviteClaimable} on the live re-read, not here.
 */
export async function resolveInviteByToken(
  tokenPlaintext: string,
): Promise<CompetitionInvite | null> {
  if (!tokenPlaintext) return null
  const hash = await hashInviteClaimToken(tokenPlaintext)
  const db = getDb()
  const rows = await db
    .select()
    .from(competitionInvitesTable)
    .where(
      and(
        eq(competitionInvitesTable.claimTokenHash, hash),
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
