/**
 * Compute the human-readable "we've emailed this athlete N times" count
 * for an invite row. The count drives the "Invited N×" suffix on the
 * candidates roster pill and the bespoke section's status badge.
 *
 * The math depends on the invite's `origin` because the two flows arrive
 * at the first send through different code paths:
 *
 * - **source**: `issueInvitesForRecipients` inserts the row with
 *   `sendAttempt = 0` and the dispatch loop emails it directly. The first
 *   send happens at `sendAttempt = 0`, so total sends = `sendAttempt + 1`.
 * - **bespoke**: `createBespokeDraft(s)` inserts the row with
 *   `sendAttempt = 0` AND no `claimToken` — it's a draft, never emailed.
 *   When the organizer clicks Send, the row goes through `reissueInvite`
 *   which bumps `sendAttempt` to 1 before dispatching. The first send
 *   happens at `sendAttempt = 1`, so total sends = `sendAttempt`.
 *
 * Drafts (no `claimUrl`) return 0 so the StatusPill suppresses the count
 * suffix and the row reads as "Not invited" rather than a misleading 1×.
 *
 * Pure function — safe for client and server.
 */
// @lat: [[competition-invites#Send count display]]

import { COMPETITION_INVITE_ORIGIN } from "@/db/schemas/competition-invites"
import type { CompetitionInviteOrigin } from "@/db/schemas/competition-invites"

export interface InviteSendCountInput {
  origin: CompetitionInviteOrigin
  sendAttempt: number
  claimUrl: string | null
}

export function computeInviteSendCount(invite: InviteSendCountInput): number {
  if (invite.claimUrl === null) return 0
  if (invite.origin === COMPETITION_INVITE_ORIGIN.BESPOKE) {
    return invite.sendAttempt
  }
  return invite.sendAttempt + 1
}
