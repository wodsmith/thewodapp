import { describe, expect, it } from "vitest"

import { decodeCompetitionId } from "@repo/wodsmith-application/identity"

describe("identity package export", () => {
  // @lat: [[identity#Canonical identifiers#Publishes the identity package subpath]]
  it("resolves the documented public identity subpath", () => {
    expect(decodeCompetitionId("comp_01EXPORTED")).toEqual({
      ok: true,
      value: "comp_01EXPORTED",
    })
  })
})
