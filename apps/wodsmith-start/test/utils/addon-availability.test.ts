import { describe, expect, it } from "vitest"
import {
  ADDON_QUANTITY_HARD_CAP,
  canFulfillQuantity,
  getMaxSelectableQuantity,
  getVariantRemaining,
  isAddonPurchasable,
  isVariantSoldOut,
} from "@/utils/addon-availability"

const DENVER = "America/Denver"

describe("isAddonPurchasable", () => {
  it("requires ACTIVE status", () => {
    for (const status of ["HIDDEN", "ARCHIVED"]) {
      expect(
        isAddonPurchasable({ status, availableUntil: null }, DENVER),
      ).toBe(false)
    }
    expect(
      isAddonPurchasable({ status: "ACTIVE", availableUntil: null }, DENVER),
    ).toBe(true)
  })

  it("treats a null deadline as always available", () => {
    expect(
      isAddonPurchasable(
        { status: "ACTIVE", availableUntil: null },
        DENVER,
        new Date("2099-01-01T00:00:00Z"),
      ),
    ).toBe(true)
  })

  it("honors end-of-day semantics in the competition timezone", () => {
    const product = { status: "ACTIVE", availableUntil: "2026-06-01" }
    // 11:30 PM June 1 in Denver (05:30 UTC June 2) — still available
    expect(
      isAddonPurchasable(product, DENVER, new Date("2026-06-02T05:30:00Z")),
    ).toBe(true)
    // 00:30 AM June 2 in Denver (06:30 UTC June 2) — deadline passed
    expect(
      isAddonPurchasable(product, DENVER, new Date("2026-06-02T06:30:00Z")),
    ).toBe(false)
  })

  it("fails closed on malformed deadline strings", () => {
    expect(
      isAddonPurchasable(
        { status: "ACTIVE", availableUntil: "not-a-date" },
        DENVER,
      ),
    ).toBe(false)
  })
})

describe("variant stock helpers", () => {
  it("computes remaining units and sold-out state", () => {
    expect(getVariantRemaining({ stockQty: 10, soldQty: 4 })).toBe(6)
    expect(getVariantRemaining({ stockQty: 4, soldQty: 4 })).toBe(0)
    // Oversold (manual stock reduction) clamps to zero
    expect(getVariantRemaining({ stockQty: 3, soldQty: 5 })).toBe(0)
    expect(getVariantRemaining({ stockQty: null, soldQty: 100 })).toBeNull()

    expect(isVariantSoldOut({ stockQty: 4, soldQty: 4 })).toBe(true)
    expect(isVariantSoldOut({ stockQty: 5, soldQty: 4 })).toBe(false)
    expect(isVariantSoldOut({ stockQty: null, soldQty: 999 })).toBe(false)
  })

  it("soft-checks fulfillable quantities", () => {
    expect(canFulfillQuantity({ stockQty: 5, soldQty: 3 }, 2)).toBe(true)
    expect(canFulfillQuantity({ stockQty: 5, soldQty: 3 }, 3)).toBe(false)
    // Untracked stock always fulfills
    expect(canFulfillQuantity({ stockQty: null, soldQty: 0 }, 99)).toBe(true)
    // No-variant products always fulfill
    expect(canFulfillQuantity(null, 3)).toBe(true)
    expect(canFulfillQuantity(null, 0)).toBe(false)
  })
})

describe("getMaxSelectableQuantity", () => {
  it("bounds by the hard cap when nothing else applies", () => {
    expect(getMaxSelectableQuantity({ maxPerAthlete: null }, null)).toBe(
      ADDON_QUANTITY_HARD_CAP,
    )
  })

  it("uses the tightest of cap, per-athlete max, and remaining stock", () => {
    expect(
      getMaxSelectableQuantity(
        { maxPerAthlete: 3 },
        { stockQty: 10, soldQty: 0 },
      ),
    ).toBe(3)
    expect(
      getMaxSelectableQuantity(
        { maxPerAthlete: 10 },
        { stockQty: 4, soldQty: 2 },
      ),
    ).toBe(2)
    expect(
      getMaxSelectableQuantity(
        { maxPerAthlete: null },
        { stockQty: 2, soldQty: 5 },
      ),
    ).toBe(0)
  })
})
