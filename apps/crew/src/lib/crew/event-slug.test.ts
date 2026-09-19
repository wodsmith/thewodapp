import { describe, expect, it } from "vitest"
import { getCrewEventIdentityUpdate } from "./event-slug"

describe("Crew event URL names", () => {
  // @lat: [[crew#Event Setup Dashboard]]
  it("keeps the public slug synchronized when the event name changes", () => {
    expect(
      getCrewEventIdentityUpdate(
        "Fall Throwdown",
        "Mountain West Fitness Championship",
      ),
    ).toEqual({
      name: "Fall Throwdown",
      slug: "fall-throwdown",
    })
  })

  it("preserves a customized slug when the event name is unchanged", () => {
    expect(
      getCrewEventIdentityUpdate("Fall Throwdown", "Fall Throwdown"),
    ).toEqual({ name: "Fall Throwdown" })
  })

  it("rejects event names that cannot produce a public slug", () => {
    expect(() => getCrewEventIdentityUpdate("🍂", "Old name")).toThrow(
      "Event name must include letters or numbers",
    )
  })
})
