/**
 * Pure (no-DB) helpers for the invite claim flow.
 *
 * Split out of [[./claim.ts]] so route files can import {@link identityMatch}
 * + {@link assertInviteClaimable} + the type/error exports without dragging
 * in `getDb` (and the `cloudflare:workers` binding) — that import poisons
 * Vite's client bundle. The DB-using helpers stay in `claim.ts`.
 */
// @lat: [[competition-invites#Claim resolution]]

import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
  type CompetitionInviteStatus,
} from "@/db/schemas/competition-invites"

// ============================================================================
// Types
// ============================================================================

export type InviteClaimableError =
  | "not_found"
  | "expired"
  | "declined"
  | "revoked"
  | "already_paid"
  | "over_allocated"

/**
 * Result of the per-(source, championship-division) claim-time allocation
 * guardrail. Pure check — see {@link assertInviteWithinAllocation} for the
 * decision rules. The DB inputs (allocation row + accepted-paid count) are
 * resolved by the caller in [[./claim.ts]].
 */
export type InviteAllocationCheck =
  | { ok: true }
  | { ok: false; reason: "over_allocated" }

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
// Helpers
// ============================================================================

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ============================================================================
// Claimability
// ============================================================================

/**
 * Throws {@link InviteNotClaimableError} unless the invite is:
 * - status = `pending`,
 * - has a live `claimToken` and `expiresAt` in the future.
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

  // Token must be live. The lookup already required a non-null token,
  // but guard against a race (e.g. webhook nulled the token between
  // resolve and assert) so we never claim a just-terminated invite.
  if (!invite.claimToken) {
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
 * Case-insensitive on both sides via local lowercase normalization.
 */
export function identityMatch(
  session: IdentityMatchSession | null | undefined,
  invite: CompetitionInvite,
  opts: IdentityMatchOptions,
): IdentityMatchResult {
  const sessionEmail = session?.email
  const inviteEmail = normalizeEmail(invite.email)

  if (sessionEmail) {
    if (normalizeEmail(sessionEmail) === inviteEmail) {
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
// Allocation guardrail (ADR-0012 Phase 5)
// ============================================================================

/**
 * Pure check: given the invite plus the resolved allocation for its
 * `(sourceId, championshipDivisionId)` and the current accepted-paid count
 * for that bucket, is there room for one more claim?
 *
 * Bespoke invites (`sourceId === null`) bypass — return `{ ok: true }`.
 *
 * `allocation` is the resolved spot count (already accounts for default
 * vs. override). `acceptedCount` is the current count of
 * `competition_invites` rows with `status === 'accepted_paid'` matching
 * `(sourceId, championshipDivisionId)`.
 *
 * `allocation === 0` is treated as "no cap configured" rather than
 * "cap is zero" — the organizer hasn't allocated this division to this
 * source, but they issued an invite anyway. Over-issue at issue time is
 * allowed per ADR-0012; matching that intent at claim time means we let
 * the athlete through. This mirrors how the Sent tab falls back to a
 * raw "X accepted" string when no denominator is set.
 *
 * Returns `{ ok: false, reason: "over_allocated" }` when:
 * - `invite.sourceId !== null` AND
 * - `allocation > 0` AND
 * - `acceptedCount >= allocation`.
 *
 * Otherwise returns `{ ok: true }`.
 */
export function assertInviteWithinAllocation(args: {
  invite: { sourceId: string | null }
  allocation: number
  acceptedCount: number
}): InviteAllocationCheck {
  if (args.invite.sourceId === null) return { ok: true }
  if (args.allocation <= 0) return { ok: true }
  if (args.acceptedCount >= args.allocation) {
    return { ok: false, reason: "over_allocated" }
  }
  return { ok: true }
}
