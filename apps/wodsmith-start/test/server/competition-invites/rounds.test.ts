import { describe, expect, it } from "vitest"
import {
  COMPETITION_INVITE_ROUND_STATUS,
  type CompetitionInviteRoundStatus,
} from "@/db/schemas/competition-invites"
import {
  createRoundDraft,
  RoundStateConflictError,
  RoundValidationError,
  updateRoundDraft,
} from "@/server/competition-invites/rounds"

describe("createRoundDraft", () => {
  const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  it("rejects a blank label", async () => {
    await expect(
      createRoundDraft({
        championshipCompetitionId: "comp_c",
        label: "   ",
        subject: "Round 1",
        rsvpDeadlineAt: futureDeadline,
      }),
    ).rejects.toBeInstanceOf(RoundValidationError)
  })

  it("rejects a blank subject", async () => {
    await expect(
      createRoundDraft({
        championshipCompetitionId: "comp_c",
        label: "Round 1",
        subject: "  ",
        rsvpDeadlineAt: futureDeadline,
      }),
    ).rejects.toBeInstanceOf(RoundValidationError)
  })

  it("rejects a deadline in the past", async () => {
    await expect(
      createRoundDraft({
        championshipCompetitionId: "comp_c",
        label: "Round 1",
        subject: "Round 1",
        rsvpDeadlineAt: new Date(Date.now() - 1000),
      }),
    ).rejects.toBeInstanceOf(RoundValidationError)
  })
})

describe("updateRoundDraft", () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  it("rejects an empty label override", async () => {
    await expect(
      updateRoundDraft({ id: "crnd_x", label: "" }),
    ).rejects.toBeInstanceOf(RoundValidationError)
  })

  it("rejects an empty subject override", async () => {
    await expect(
      updateRoundDraft({ id: "crnd_x", subject: " " }),
    ).rejects.toBeInstanceOf(RoundValidationError)
  })

  it("rejects a past deadline override", async () => {
    await expect(
      updateRoundDraft({
        id: "crnd_x",
        rsvpDeadlineAt: new Date(Date.now() - 1000),
      }),
    ).rejects.toBeInstanceOf(RoundValidationError)
  })

  // Keep `future` referenced so a type-narrowing `it.skip` block can opt back
  // in for an integration test against a real DB without lint friction.
  void future
})

describe("RoundStateConflictError", () => {
  it("captures the observed status for the caller", () => {
    const observed: CompetitionInviteRoundStatus =
      COMPETITION_INVITE_ROUND_STATUS.SENT
    const err = new RoundStateConflictError("crnd_x", observed)
    expect(err.observedStatus).toBe(observed)
    expect(err.message).toContain("sent")
  })

  it("handles a missing round (null observed status)", () => {
    const err = new RoundStateConflictError("crnd_x", null)
    expect(err.observedStatus).toBeNull()
    expect(err.message).toContain("missing")
  })
})
