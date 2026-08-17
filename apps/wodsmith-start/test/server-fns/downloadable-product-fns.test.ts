import { describe, expect, it } from "vitest"
import { hasDownloadEntitlement } from "@/server-fns/downloadable-product-fns"

describe("hasDownloadEntitlement", () => {
  // @lat: [[commerce#Downloadable Competition Products#Download authorization]]
  it("unlocks included files for registered athletes", () => {
    const entitlement = {
      registeredCompetitionIds: new Set(["comp-1"]),
      purchasedProductIds: new Set<string>(),
    }

    expect(
      hasDownloadEntitlement(
        {
          id: "product-1",
          competitionId: "comp-1",
          access: "INCLUDED_WITH_REGISTRATION",
        },
        entitlement,
      ),
    ).toBe(true)
    expect(
      hasDownloadEntitlement(
        {
          id: "product-2",
          competitionId: "comp-2",
          access: "INCLUDED_WITH_REGISTRATION",
        },
        entitlement,
      ),
    ).toBe(false)
  })

  it("unlocks optional files only for completed product purchasers", () => {
    const entitlement = {
      registeredCompetitionIds: new Set(["comp-1"]),
      purchasedProductIds: new Set(["product-1"]),
    }

    expect(
      hasDownloadEntitlement(
        {
          id: "product-1",
          competitionId: "comp-1",
          access: "OPTIONAL_PURCHASE",
        },
        entitlement,
      ),
    ).toBe(true)
    expect(
      hasDownloadEntitlement(
        {
          id: "product-2",
          competitionId: "comp-1",
          access: "OPTIONAL_PURCHASE",
        },
        entitlement,
      ),
    ).toBe(false)
  })
})
