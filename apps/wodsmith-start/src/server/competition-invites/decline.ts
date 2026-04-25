/**
 * Decline an invite.
 *
 * Called from the `/compete/$slug/claim/$token/decline` route. Transitions
 * a pending invite to `declined` — nulls `activeMarker` and `claimTokenHash`
 * so the unique-active index unblocks a future re-invite and the link
 * dies immediately.
 *
 * Identity-match is the caller's responsibility (the route loader checks
 * the session email matches the invite email before dispatching). This
 * function assumes it's safe to transition.
 */
// @lat: [[competition-invites#Claim routes]]

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMPETITION_INVITE_STATUS,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"

export class InviteDeclineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InviteDeclineError"
  }
}

export async function declineInvite(params: {
  inviteId: string
}): Promise<void> {
  const db = getDb()
  const now = new Date()

  const result = await db
    .update(competitionInvitesTable)
    .set({
      status: COMPETITION_INVITE_STATUS.DECLINED,
      declinedAt: now,
      claimTokenHash: null,
      claimTokenLast4: null,
      activeMarker: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(competitionInvitesTable.id, params.inviteId),
        eq(competitionInvitesTable.status, COMPETITION_INVITE_STATUS.PENDING),
      ),
    )

  // MySQL's `.update()` returns affectedRows in the result. A zero here
  // means the row either doesn't exist or isn't in `pending` anymore —
  // terminal transitions are idempotent from the route's perspective, so
  // we fail loud only if the row disappeared entirely.
  const affected =
    (result as unknown as { affectedRows?: number }).affectedRows ?? 0

  if (affected === 0) {
    // Double-check — if the row exists but is already terminal, treat as
    // idempotent success. If it doesn't exist at all, surface an error.
    const existing = await db
      .select({ status: competitionInvitesTable.status })
      .from(competitionInvitesTable)
      .where(eq(competitionInvitesTable.id, params.inviteId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
    if (!existing) {
      throw new InviteDeclineError(
        `Invite ${params.inviteId} not found`,
      )
    }
  }
}
