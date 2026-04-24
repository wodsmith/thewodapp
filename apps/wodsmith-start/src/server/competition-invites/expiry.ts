/**
 * Competition invite expiry sweep.
 *
 * Paginates `status = "pending" AND expiresAt < now` and transitions
 * matching rows to `expired`. Nulls `claimTokenHash` + `activeMarker` so
 * the link dies immediately and a future re-invite for the same
 * (championship, email, division) is unblocked by the unique-active index.
 *
 * Intended to run on an hourly Cloudflare Cron Trigger. The function is
 * idempotent — the `status = "pending"` predicate on the update means a
 * re-run won't double-transition a row, and a crash mid-batch just leaves
 * some rows for the next sweep.
 */
// @lat: [[competition-invites#Invite expiry sweep]]

import { and, eq, inArray, lt } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_STATUS,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"

/** Max rows flipped per sweep call so a large backlog doesn't hold the
 *  cron worker indefinitely. Higher values process more per tick but risk
 *  Workers CPU timeouts on big transitions. */
export const INVITE_EXPIRY_BATCH_SIZE = 200

export interface InviteExpirySweepResult {
  /** Number of rows transitioned to `expired` in this sweep. */
  transitioned: number
}

/**
 * Run a single sweep of expired pending invites. Returns how many rows
 * were flipped — the caller (cron handler) can log or metric on this.
 */
export async function sweepExpiredInvites(
  now: Date = new Date(),
): Promise<InviteExpirySweepResult> {
  const db = getDb()

  const candidates = await db
    .select({ id: competitionInvitesTable.id })
    .from(competitionInvitesTable)
    .where(
      and(
        eq(
          competitionInvitesTable.status,
          COMPETITION_INVITE_STATUS.PENDING,
        ),
        lt(competitionInvitesTable.expiresAt, now),
      ),
    )
    .limit(INVITE_EXPIRY_BATCH_SIZE)

  if (candidates.length === 0) {
    return { transitioned: 0 }
  }

  const ids = candidates.map((c) => c.id)
  const updateResult = await db
    .update(competitionInvitesTable)
    .set({
      status: COMPETITION_INVITE_STATUS.EXPIRED,
      claimTokenHash: null,
      claimTokenLast4: null,
      activeMarker: null,
      updatedAt: now,
    })
    .where(
      and(
        inArray(competitionInvitesTable.id, ids),
        // Re-check both predicates so concurrent mutations between the
        // SELECT and the UPDATE don't get stomped — a status flip means
        // an athlete just claimed/declined, and an `expiresAt` bump
        // means an organizer extended via `reissueInvite`. Either case,
        // the row should not be marked expired.
        eq(
          competitionInvitesTable.status,
          COMPETITION_INVITE_STATUS.PENDING,
        ),
        lt(competitionInvitesTable.expiresAt, now),
      ),
    )

  // Drizzle's mysql2 driver returns `[ResultSetHeader, FieldPacket[]]`,
  // while the planetscale-serverless driver returns an object with
  // `rowsAffected`. Read both shapes so the count reflects what actually
  // transitioned — `ids.length` overstates the count whenever the
  // re-check predicate filtered some candidates.
  const transitioned =
    (updateResult as unknown as { rowsAffected?: number }).rowsAffected ??
    (updateResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ??
    0

  return { transitioned }
}
