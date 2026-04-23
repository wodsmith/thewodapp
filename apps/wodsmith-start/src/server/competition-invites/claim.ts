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
 */
// @lat: [[competition-invites#Claim resolution]]

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
  type CompetitionInviteStatus,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { hashInviteClaimToken } from "@/lib/competition-invites/tokens"
import { normalizeInviteEmail } from "./issue"

// ============================================================================
// Types
// ============================================================================

export type InviteClaimableError =
  | "not_found"
  | "expired"
  | "declined"
  | "revoked"
  | "already_paid"

export type IdentityMatchResult =
  | { ok: true }
  | { ok: false; reason: "wrong_account" | "needs_sign_in" | "needs_sign_up" }

export interface IdentityMatchSession {
  /** `null` / `undefined` when the visitor is signed out. */
  email?: string | null
}

export interface IdentityMatchOptions {
  /**
   * Whether WODsmith has a user account matching `invite.email`. The route
   * loader supplies this by querying `userTable` — it isn't tracked on the
   * invite row because a user may sign up *later*.
   */
  accountExistsForInviteEmail: boolean
}

export class InviteNotClaimableError extends Error {
  readonly reason: InviteClaimableError
  constructor(reason: InviteClaimableError, message?: string) {
    super(message ?? `Invite is not claimable: ${reason}`)
    this.name = "InviteNotClaimableError"
    this.reason = reason
  }
}

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
    .where(eq(competitionInvitesTable.claimTokenHash, hash))
    .limit(1)
  return rows[0] ?? null
}

// ============================================================================
// Claimability
// ============================================================================

/**
 * Throws {@link InviteNotClaimableError} unless the invite is:
 * - status = `pending`,
 * - has a live `claimTokenHash` and `expiresAt` in the future.
 *
 * `accepted_paid`, `declined`, `expired`, and `revoked` each map to a
 * distinct `reason` so the route can render a tailored message (and so
 * support queries can tell them apart from a generic "invalid").
 */
export function assertInviteClaimable(
  invite: CompetitionInvite,
  now: Date = new Date(),
): void {
  switch (invite.status as CompetitionInviteStatus) {
    case COMPETITION_INVITE_STATUS.PENDING:
      break
    case COMPETITION_INVITE_STATUS.ACCEPTED_PAID:
      throw new InviteNotClaimableError("already_paid")
    case COMPETITION_INVITE_STATUS.DECLINED:
      throw new InviteNotClaimableError("declined")
    case COMPETITION_INVITE_STATUS.EXPIRED:
      throw new InviteNotClaimableError("expired")
    case COMPETITION_INVITE_STATUS.REVOKED:
      throw new InviteNotClaimableError("revoked")
    default:
      throw new InviteNotClaimableError("not_found")
  }

  // Token must be live. The lookup already required a non-null hash, but
  // guard against a race (e.g. webhook nulled the hash between resolve and
  // assert) so we never claim a just-terminated invite.
  if (!invite.claimTokenHash) {
    throw new InviteNotClaimableError("not_found")
  }

  if (invite.expiresAt && now >= invite.expiresAt) {
    throw new InviteNotClaimableError("expired")
  }

  if (invite.activeMarker !== COMPETITION_INVITE_ACTIVE_MARKER) {
    throw new InviteNotClaimableError("not_found")
  }
}

// ============================================================================
// Identity match
// ============================================================================

/**
 * Decide what happens next based on the visitor's session and whether a
 * WODsmith account exists for the invite's locked email.
 *
 * - signed in, session email matches invite email → `{ ok: true }`
 * - signed in, session email differs               → `wrong_account`
 * - signed out, account exists                     → `needs_sign_in`
 * - signed out, no account                         → `needs_sign_up`
 *
 * Case-insensitive on both sides via {@link normalizeInviteEmail}, so
 * "Mike@Example.com" and "mike@example.com" resolve identically.
 */
export function identityMatch(
  session: IdentityMatchSession | null | undefined,
  invite: CompetitionInvite,
  opts: IdentityMatchOptions,
): IdentityMatchResult {
  const sessionEmail = session?.email
  const inviteEmail = normalizeInviteEmail(invite.email)

  if (sessionEmail) {
    if (normalizeInviteEmail(sessionEmail) === inviteEmail) {
      return { ok: true }
    }
    return { ok: false, reason: "wrong_account" }
  }

  if (opts.accountExistsForInviteEmail) {
    return { ok: false, reason: "needs_sign_in" }
  }
  return { ok: false, reason: "needs_sign_up" }
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
