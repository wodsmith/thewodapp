import { describe, expect, it } from "vitest"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
} from "@/db/schemas/competition-invites"
import {
  assertInviteClaimable,
  identityMatch,
  InviteNotClaimableError,
} from "@/server/competition-invites/claim"

function inviteFixture(
  overrides: Partial<CompetitionInvite> = {},
): CompetitionInvite {
  return {
    id: "cinv_test",
    championshipCompetitionId: "comp_c",
    roundId: "crnd_test",
    origin: COMPETITION_INVITE_ORIGIN.SOURCE,
    sourceId: "cisrc_1",
    sourceCompetitionId: "comp_s",
    sourcePlacement: 1,
    sourcePlacementLabel: "1st",
    bespokeReason: null,
    championshipDivisionId: "div_rxm",
    email: "mike@example.com",
    userId: "usr_m",
    inviteeFirstName: "Mike",
    inviteeLastName: null,
    claimToken: "tok_abcdefghij",
    expiresAt: new Date("2026-05-01T00:00:00Z"),
    sendAttempt: 1,
    status: COMPETITION_INVITE_STATUS.PENDING,
    paidAt: null,
    declinedAt: null,
    revokedAt: null,
    revokedByUserId: null,
    claimedRegistrationId: null,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.SENT,
    emailLastError: null,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    updateCounter: 0,
    ...overrides,
  }
}

// @lat: [[competition-invites#Claim resolution]]
describe("assertInviteClaimable", () => {
  const before = new Date("2026-04-15T00:00:00Z")
  const afterExpiry = new Date("2026-05-02T00:00:00Z")

  it("accepts a live pending invite", () => {
    expect(() => assertInviteClaimable(inviteFixture(), before)).not.toThrow()
  })

  it("rejects an accepted_paid invite with reason 'already_paid'", () => {
    try {
      assertInviteClaimable(
        inviteFixture({
          status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
          claimToken: null,
        }),
        before,
      )
      throw new Error("did not throw")
    } catch (err) {
      expect(err).toBeInstanceOf(InviteNotClaimableError)
      expect((err as InviteNotClaimableError).reason).toBe("already_paid")
    }
  })

  it("rejects a declined invite with reason 'declined'", () => {
    expect(() =>
      assertInviteClaimable(
        inviteFixture({
          status: COMPETITION_INVITE_STATUS.DECLINED,
          activeMarker: null,
          claimToken: null,
        }),
        before,
      ),
    ).toThrow(
      expect.objectContaining({
        name: "InviteNotClaimableError",
        reason: "declined",
      }),
    )
  })

  it("rejects a revoked invite with reason 'revoked'", () => {
    expect(() =>
      assertInviteClaimable(
        inviteFixture({
          status: COMPETITION_INVITE_STATUS.REVOKED,
          activeMarker: null,
          claimToken: null,
        }),
        before,
      ),
    ).toThrow(
      expect.objectContaining({ reason: "revoked" }),
    )
  })

  it("rejects an expired-status invite with reason 'expired'", () => {
    expect(() =>
      assertInviteClaimable(
        inviteFixture({
          status: COMPETITION_INVITE_STATUS.EXPIRED,
          activeMarker: null,
          claimToken: null,
        }),
        before,
      ),
    ).toThrow(
      expect.objectContaining({ reason: "expired" }),
    )
  })

  it("rejects when expiresAt has passed even if status is still pending", () => {
    expect(() =>
      assertInviteClaimable(inviteFixture(), afterExpiry),
    ).toThrow(
      expect.objectContaining({ reason: "expired" }),
    )
  })

  it("rejects when the token was nulled (double-claim defense)", () => {
    expect(() =>
      assertInviteClaimable(
        inviteFixture({ claimToken: null }),
        before,
      ),
    ).toThrow(
      expect.objectContaining({ reason: "not_found" }),
    )
  })

  it("rejects when activeMarker is not 'active' (race protection)", () => {
    expect(() =>
      assertInviteClaimable(
        inviteFixture({ activeMarker: null }),
        before,
      ),
    ).toThrow(expect.objectContaining({ reason: "not_found" }))
  })
})

// @lat: [[competition-invites#Claim resolution]]
describe("identityMatch", () => {
  const invite = inviteFixture({ email: "mike@example.com" })

  it("ok=true when signed in as the invited email (case-insensitive)", () => {
    expect(
      identityMatch(
        { email: "Mike@Example.com" },
        invite,
        { accountExistsForInviteEmail: true },
      ),
    ).toEqual({ ok: true })
  })

  it("rejects a different signed-in email as 'wrong_account'", () => {
    expect(
      identityMatch(
        { email: "someoneelse@example.com" },
        invite,
        { accountExistsForInviteEmail: true },
      ),
    ).toEqual({ ok: false, reason: "wrong_account" })
  })

  it("signed out + existing account → needs_sign_in", () => {
    expect(
      identityMatch(null, invite, { accountExistsForInviteEmail: true }),
    ).toEqual({ ok: false, reason: "needs_sign_in" })
  })

  it("signed out + no account → needs_sign_up", () => {
    expect(
      identityMatch(null, invite, { accountExistsForInviteEmail: false }),
    ).toEqual({ ok: false, reason: "needs_sign_up" })
  })

  it("trims and lowercases the session email before comparing", () => {
    expect(
      identityMatch(
        { email: "  MIKE@EXAMPLE.COM  " },
        invite,
        { accountExistsForInviteEmail: true },
      ),
    ).toEqual({ ok: true })
  })

  it("treats an empty session email as signed-out", () => {
    expect(
      identityMatch(
        { email: "" },
        invite,
        { accountExistsForInviteEmail: false },
      ),
    ).toEqual({ ok: false, reason: "needs_sign_up" })
  })
})
