import { describe, expect, it } from "vitest"
import { COMPETITION_INVITE_SOURCE_KIND } from "@/db/schemas/competition-invites"
import {
  assertSourceReferenceValid,
  InviteSourceValidationError,
} from "@/server/competition-invites/sources"

describe("assertSourceReferenceValid", () => {
  it("accepts a single-competition source", () => {
    expect(() =>
      assertSourceReferenceValid({
        kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
        sourceCompetitionId: "comp_123",
        sourceGroupId: null,
      }),
    ).not.toThrow()
  })

  it("accepts a series source", () => {
    expect(() =>
      assertSourceReferenceValid({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_abc",
      }),
    ).not.toThrow()
  })

  it("rejects when both references are set", () => {
    expect(() =>
      assertSourceReferenceValid({
        kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
        sourceCompetitionId: "comp_123",
        sourceGroupId: "cgrp_abc",
      }),
    ).toThrow(InviteSourceValidationError)
  })

  it("rejects when neither reference is set", () => {
    expect(() =>
      assertSourceReferenceValid({
        kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
        sourceCompetitionId: null,
        sourceGroupId: null,
      }),
    ).toThrow(InviteSourceValidationError)
  })

  it("rejects kind=competition without sourceCompetitionId", () => {
    expect(() =>
      assertSourceReferenceValid({
        kind: COMPETITION_INVITE_SOURCE_KIND.COMPETITION,
        sourceCompetitionId: null,
        sourceGroupId: "cgrp_abc",
      }),
    ).toThrow(/sourceCompetitionId/)
  })

  it("rejects kind=series without sourceGroupId", () => {
    expect(() =>
      assertSourceReferenceValid({
        kind: COMPETITION_INVITE_SOURCE_KIND.SERIES,
        sourceCompetitionId: "comp_123",
        sourceGroupId: null,
      }),
    ).toThrow(/sourceGroupId/)
  })
})
