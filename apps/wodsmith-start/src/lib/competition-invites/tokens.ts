/**
 * Competition invite claim tokens — generation, hashing, display helpers.
 *
 * A claim token is a 32-byte URL-safe random string. Only the SHA-256 hash
 * lives in `competition_invites.claimTokenHash`; the plaintext exists only
 * in the email delivered to the invited address. We also store the last 4
 * characters of the plaintext so organizer support can confirm "did this
 * athlete click the right link?" without reading a usable credential.
 *
 * Pure functions — no DB, no KV, no I/O beyond Web Crypto. Safe to call
 * from server functions, workflows, queue consumers, and tests.
 */
// @lat: [[competition-invites#Token helpers]]

import { encodeBase64urlNoPadding, encodeHexLowerCase } from "@oslojs/encoding"

export interface InviteClaimTokenArtifacts {
  /** URL-safe plaintext. Only put this in an outgoing email. */
  token: string
  /** SHA-256 of the plaintext, lowercase hex. Safe to store in the DB. */
  hash: string
  /** Last 4 characters of the plaintext. Support-facing, non-credential. */
  last4: string
}

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

/**
 * Compute the SHA-256 hash of a plaintext token. The return is lowercase
 * hex so it fits a `varchar(64)` column and compares case-sensitively
 * against the stored value without normalization.
 */
export async function hashInviteClaimToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  )
  return encodeHexLowerCase(new Uint8Array(digest))
}

/**
 * Last-4 extraction for organizer support. Does not leak enough of the
 * token to reconstruct it.
 */
export function inviteClaimTokenLast4(token: string): string {
  return token.slice(-4)
}

/**
 * One-shot: plaintext + hash + last4. Prefer this at issue time so the
 * three artifacts are always derived from the same plaintext.
 */
export async function generateInviteClaimToken(): Promise<InviteClaimTokenArtifacts> {
  const token = generateInviteClaimTokenPlaintext()
  const hash = await hashInviteClaimToken(token)
  return { token, hash, last4: inviteClaimTokenLast4(token) }
}
