import { describe, expect, it } from "vitest"
import { computeInviteSendCount } from "@/lib/competition-invites/send-count"
import { COMPETITION_INVITE_ORIGIN } from "@/db/schemas/competition-invites"

describe("computeInviteSendCount", () => {
  describe("drafts (no claimUrl)", () => {
    it("returns 0 for a bespoke draft so the StatusPill suppresses the suffix", () => {
      // Drafts have never been dispatched. Returning 0 lets the "Invited"
      // pill render without a misleading "1×".
      expect(
        computeInviteSendCount({
          origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
          sendAttempt: 0,
          claimUrl: null,
        }),
      ).toBe(0)
    })
  })

  describe("source-origin invites", () => {
    it("counts the initial dispatch when sendAttempt is 0", () => {
      // Source invites are inserted with sendAttempt=0 and dispatched
      // directly — the first email goes out at sendAttempt=0.
      expect(
        computeInviteSendCount({
          origin: COMPETITION_INVITE_ORIGIN.SOURCE,
          sendAttempt: 0,
          claimUrl: "https://example.com/compete/c/claim/tok",
        }),
      ).toBe(1)
    })

    it("returns sendAttempt+1 once the row has been re-issued", () => {
      // Each reissueInvite/redeliverInvite bumps sendAttempt by 1.
      expect(
        computeInviteSendCount({
          origin: COMPETITION_INVITE_ORIGIN.SOURCE,
          sendAttempt: 2,
          claimUrl: "https://example.com/compete/c/claim/tok",
        }),
      ).toBe(3)
    })
  })

  describe("bespoke invites that have been sent", () => {
    it("returns sendAttempt (not +1) for a single-send bespoke invite", () => {
      // Bespoke invites are inserted as drafts (sendAttempt=0, no token).
      // Activation runs through reissueInvite which bumps sendAttempt to 1
      // and dispatches the FIRST email — so sendAttempt=1 means one send,
      // not two. This is the regression: the old code rendered "Invited 2×"
      // for single-send bespoke rows.
      expect(
        computeInviteSendCount({
          origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
          sendAttempt: 1,
          claimUrl: "https://example.com/compete/c/claim/tok",
        }),
      ).toBe(1)
    })

    it("returns sendAttempt for a re-sent bespoke invite", () => {
      // After the activation send (sendAttempt=1), a single resend bumps
      // to sendAttempt=2, which means the athlete has been emailed twice.
      expect(
        computeInviteSendCount({
          origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
          sendAttempt: 2,
          claimUrl: "https://example.com/compete/c/claim/tok",
        }),
      ).toBe(2)
    })
  })
})
