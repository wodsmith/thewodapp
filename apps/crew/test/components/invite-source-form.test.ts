import { describe, expect, it } from "vitest"
import { inviteSourceFormSchema } from "@/components/organizer/invites/invite-source-form"

describe("inviteSourceFormSchema", () => {
  it("accepts a single-competition source with globalSpots", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "competition",
      sourceCompetitionId: "comp_123",
      globalSpots: 10,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a single-competition source without globalSpots", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "competition",
      sourceCompetitionId: "comp_123",
    })
    expect(result.success).toBe(false)
  })

  it("accepts a series source with sourceGroupId (globalSpots not required)", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "series",
      sourceGroupId: "cgrp_abc",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a series_global source with sourceGroupId + globalSpots", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "series_global",
      sourceGroupId: "cgrp_abc",
      globalSpots: 5,
    })
    expect(result.success).toBe(true)
  })

  it("rejects a series_global source without globalSpots", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "series_global",
      sourceGroupId: "cgrp_abc",
    })
    expect(result.success).toBe(false)
  })

  it("rejects when both sourceCompetitionId and sourceGroupId are set", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "competition",
      sourceCompetitionId: "comp_123",
      sourceGroupId: "cgrp_abc",
      globalSpots: 10,
    })
    expect(result.success).toBe(false)
  })

  it("rejects when neither reference is set", () => {
    const result = inviteSourceFormSchema.safeParse({
      kind: "competition",
      globalSpots: 10,
    })
    expect(result.success).toBe(false)
  })
})
