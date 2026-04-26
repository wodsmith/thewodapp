/**
 * Competition invite claim tokens — generation helpers.
 *
 * A claim token is a 32-byte URL-safe random string stored plaintext in
 * `competition_invites.claimToken`, mirroring the `team_invitations.token`
 * pattern. Lookups go through `eq(claimToken, ...)` directly (no hash).
 * The token is an unguessable identifier, not a bearer password — the
 * email-locked claim (`identityMatch`) remains the actual auth gate, and
 * the token is nulled on every terminal transition so a stale link can't
 * replay.
 *
 * Pure function — no DB, no KV, no I/O beyond Web Crypto. Safe to call
 * from server functions, workflows, queue consumers, and tests.
 */
// @lat: [[competition-invites#Token helpers]]

import { encodeBase64urlNoPadding } from "@oslojs/encoding"

const TOKEN_BYTE_LENGTH = 32

/**
 * Generate a cryptographically random 32-byte URL-safe token. Uses Web
 * Crypto `getRandomValues` + unpadded base64url so the result is always a
 * safe URL path segment and every character carries entropy.
 */
export function generateInviteClaimTokenPlaintext(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH)
  crypto.getRandomValues(bytes)
  return encodeBase64urlNoPadding(bytes)
}
