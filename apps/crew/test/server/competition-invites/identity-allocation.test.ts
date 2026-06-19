import { describe, expect, it } from "vitest"
import { assertInviteWithinAllocation } from "@/server/competition-invites/identity"

// @lat: [[competition-invites#Claim allocation guardrail]]
describe("assertInviteWithinAllocation", () => {
  it("passes for bespoke invites regardless of allocation/count", () => {
    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: null },
        allocation: 0,
        acceptedCount: 0,
      }),
    ).toEqual({ ok: true })

    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: null },
        allocation: 3,
        acceptedCount: 5,
      }),
    ).toEqual({ ok: true })
  })

  it("passes when allocation=0 (no cap configured) regardless of acceptedCount", () => {
    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: "cisrc_1" },
        allocation: 0,
        acceptedCount: 0,
      }),
    ).toEqual({ ok: true })

    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: "cisrc_1" },
        allocation: 0,
        acceptedCount: 7,
      }),
    ).toEqual({ ok: true })
  })

  it("passes when acceptedCount is below allocation", () => {
    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: "cisrc_1" },
        allocation: 3,
        acceptedCount: 2,
      }),
    ).toEqual({ ok: true })
  })

  it("blocks when acceptedCount equals allocation", () => {
    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: "cisrc_1" },
        allocation: 3,
        acceptedCount: 3,
      }),
    ).toEqual({ ok: false, reason: "over_allocated" })
  })

  it("blocks when acceptedCount exceeds allocation", () => {
    expect(
      assertInviteWithinAllocation({
        invite: { sourceId: "cisrc_1" },
        allocation: 3,
        acceptedCount: 5,
      }),
    ).toEqual({ ok: false, reason: "over_allocated" })
  })
})
