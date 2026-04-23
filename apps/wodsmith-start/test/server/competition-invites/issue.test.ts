import { describe, expect, it, vi } from "vitest"
import { COMPETITION_INVITE_ORIGIN } from "@/db/schemas/competition-invites"
import {
  assertRecipientOriginValid,
  FreeCompetitionNotEligibleError,
  InviteIssueValidationError,
  issueInvitesForRecipients,
  normalizeInviteEmail,
} from "@/server/competition-invites/issue"

vi.mock("@/server/commerce/fee-calculator", () => ({
  getRegistrationFee: vi.fn(async () => 0),
}))

describe("normalizeInviteEmail", () => {
  it("lowercases", () => {
    expect(normalizeInviteEmail("Alice@Example.com")).toBe("alice@example.com")
  })

  it("trims whitespace", () => {
    expect(normalizeInviteEmail("  bob@example.com  ")).toBe("bob@example.com")
  })

  it("handles combined case + whitespace", () => {
    expect(normalizeInviteEmail("  CAROL@Example.com\t")).toBe(
      "carol@example.com",
    )
  })
})

describe("assertRecipientOriginValid", () => {
  it("accepts a complete source recipient", () => {
    expect(() =>
      assertRecipientOriginValid({
        email: "a@x.com",
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        sourceId: "cisrc_1",
        sourceCompetitionId: "comp_1",
        sourcePlacement: 1,
      }),
    ).not.toThrow()
  })

  it("accepts a bespoke recipient with no source attribution", () => {
    expect(() =>
      assertRecipientOriginValid({
        email: "b@x.com",
        origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
        bespokeReason: "Sponsored",
      }),
    ).not.toThrow()
  })

  it("rejects a source recipient missing sourceId", () => {
    expect(() =>
      assertRecipientOriginValid({
        email: "a@x.com",
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        sourceCompetitionId: "comp_1",
      }),
    ).toThrow(InviteIssueValidationError)
  })

  it("rejects a source recipient missing sourceCompetitionId", () => {
    expect(() =>
      assertRecipientOriginValid({
        email: "a@x.com",
        origin: COMPETITION_INVITE_ORIGIN.SOURCE,
        sourceId: "cisrc_1",
      }),
    ).toThrow(InviteIssueValidationError)
  })

  it("rejects a bespoke recipient carrying source attribution", () => {
    expect(() =>
      assertRecipientOriginValid({
        email: "b@x.com",
        origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
        sourceId: "cisrc_1",
      }),
    ).toThrow(InviteIssueValidationError)
  })
})

describe("issueInvitesForRecipients", () => {
  it("short-circuits for an empty recipient list without touching fee logic", async () => {
    const result = await issueInvitesForRecipients({
      championshipCompetitionId: "comp_c",
      championshipDivisionId: "div_rxm",
      rsvpDeadlineAt: new Date("2026-05-01T00:00:00Z"),
      recipients: [],
    })
    expect(result).toEqual({ inserted: [], alreadyActive: [] })
  })

  it("rejects when the target division has a $0 registration fee", async () => {
    await expect(
      issueInvitesForRecipients({
        championshipCompetitionId: "comp_c",
        championshipDivisionId: "div_rxm",
        rsvpDeadlineAt: new Date("2026-05-01T00:00:00Z"),
        recipients: [
          {
            email: "free@example.com",
            origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(FreeCompetitionNotEligibleError)
  })

  it("rejects malformed email addresses before opening a transaction", async () => {
    const { getRegistrationFee } = await import(
      "@/server/commerce/fee-calculator"
    )
    vi.mocked(getRegistrationFee).mockResolvedValueOnce(2500)

    await expect(
      issueInvitesForRecipients({
        championshipCompetitionId: "comp_c",
        championshipDivisionId: "div_rxm",
        rsvpDeadlineAt: new Date("2026-05-01T00:00:00Z"),
        recipients: [
          {
            email: "not-an-email",
            origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InviteIssueValidationError)
  })
})
