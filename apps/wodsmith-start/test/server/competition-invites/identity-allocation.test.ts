import { describe, expect, it } from "vitest"
import {
  assertInviteWithinAllocation,
  extractInviteIdsFromPurchaseMetadata,
} from "@/server/competition-invites/identity"

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

// @lat: [[competition-invites#Claim allocation guardrail]]
describe("extractInviteIdsFromPurchaseMetadata", () => {
  it("returns inviteIds from valid metadata blobs", () => {
    expect(
      extractInviteIdsFromPurchaseMetadata({
        purchases: [
          { metadata: JSON.stringify({ inviteId: "cinv_a" }) },
          { metadata: JSON.stringify({ inviteId: "cinv_b" }) },
        ],
      }),
    ).toEqual(["cinv_a", "cinv_b"])
  })

  it("preserves duplicate inviteIds (caller's invite query dedupes)", () => {
    // Two PENDING purchases for the same invitee (e.g. they retried within
    // the 35-min hold window) — preserving the duplicate here is fine
    // because the downstream `inArray()` query collapses to one match per
    // invite row.
    expect(
      extractInviteIdsFromPurchaseMetadata({
        purchases: [
          { metadata: JSON.stringify({ inviteId: "cinv_a" }) },
          { metadata: JSON.stringify({ inviteId: "cinv_a" }) },
        ],
      }),
    ).toEqual(["cinv_a", "cinv_a"])
  })

  it("skips purchases with no metadata, malformed JSON, or no inviteId", () => {
    expect(
      extractInviteIdsFromPurchaseMetadata({
        purchases: [
          { metadata: null },
          { metadata: "not-json {{" },
          { metadata: JSON.stringify({}) },
          { metadata: JSON.stringify({ inviteId: null }) },
          { metadata: JSON.stringify({ teamName: "Alpha" }) },
          { metadata: JSON.stringify({ inviteId: "cinv_keep" }) },
        ],
      }),
    ).toEqual(["cinv_keep"])
  })

  it("excludes the supplied excludeInviteId", () => {
    expect(
      extractInviteIdsFromPurchaseMetadata({
        purchases: [
          { metadata: JSON.stringify({ inviteId: "cinv_self" }) },
          { metadata: JSON.stringify({ inviteId: "cinv_other" }) },
        ],
        excludeInviteId: "cinv_self",
      }),
    ).toEqual(["cinv_other"])
  })

  it("returns empty when every row is filtered out", () => {
    expect(
      extractInviteIdsFromPurchaseMetadata({
        purchases: [
          { metadata: null },
          { metadata: JSON.stringify({ inviteId: "cinv_self" }) },
        ],
        excludeInviteId: "cinv_self",
      }),
    ).toEqual([])
  })
})
