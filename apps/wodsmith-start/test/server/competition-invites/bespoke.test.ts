import { describe, expect, it, vi } from "vitest"
import {
  BESPOKE_BULK_MAX_ROWS,
  createBespokeInvite,
  createBespokeInvitesBulk,
  parseBespokePaste,
  parseBespokePasteLine,
} from "@/server/competition-invites/bespoke"
import { FreeCompetitionNotEligibleError } from "@/server/competition-invites/issue"

vi.mock("@/server/commerce/fee-calculator", () => ({
  getRegistrationFee: vi.fn(async () => 0),
}))

describe("parseBespokePasteLine", () => {
  it("parses a comma-separated row", () => {
    const row = parseBespokePasteLine(
      "jane@example.com,Jane,Doe,rx-men,Sponsored",
      1,
    )
    expect(row).toEqual({
      rowNumber: 1,
      email: "jane@example.com",
      inviteeFirstName: "Jane",
      inviteeLastName: "Doe",
      bespokeReason: "Sponsored",
    })
  })

  it("parses a tab-separated row (Google Sheets paste)", () => {
    const row = parseBespokePasteLine(
      "jane@example.com\tJane\tDoe\t\tWildcard",
      2,
    )
    expect(row).toEqual({
      rowNumber: 2,
      email: "jane@example.com",
      inviteeFirstName: "Jane",
      inviteeLastName: "Doe",
      bespokeReason: "Wildcard",
    })
  })

  it("parses an email-only line", () => {
    const row = parseBespokePasteLine("bob@example.com", 3)
    expect(row).toEqual({
      rowNumber: 3,
      email: "bob@example.com",
      inviteeFirstName: null,
      inviteeLastName: null,
      bespokeReason: null,
    })
  })

  it("skips blank lines", () => {
    expect(parseBespokePasteLine("   ", 4)).toBeNull()
    expect(parseBespokePasteLine("", 5)).toBeNull()
  })

  it("skips a literal header row", () => {
    expect(parseBespokePasteLine("email,firstName,lastName", 1)).toBeNull()
    expect(parseBespokePasteLine("EMAIL", 1)).toBeNull()
  })

  it("prefers tab when both tab and comma are present", () => {
    const row = parseBespokePasteLine(
      "a@x.com\tAlice,Smith\tSmith\t\t",
      1,
    )
    // With tab as delimiter the first comma stays inside the firstName field.
    expect(row?.inviteeFirstName).toBe("Alice,Smith")
  })
})

describe("parseBespokePaste", () => {
  it("normalizes emails (lowercase + trim)", () => {
    const { rows } = parseBespokePaste("  Alice@Example.com  \nbob@example.com")
    expect(rows.map((r) => r.email)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ])
  })

  it("reports invalid emails in the invalid bucket", () => {
    const { rows, invalid } = parseBespokePaste(
      "jane@example.com\nnot-an-email\nbob@example.com",
    )
    expect(rows).toHaveLength(2)
    expect(invalid).toHaveLength(1)
    expect(invalid[0]?.reason).toMatch(/Invalid email/)
    expect(invalid[0]?.rowNumber).toBe(2)
  })

  it("handles CRLF line endings", () => {
    const { rows } = parseBespokePaste("a@x.com\r\nb@x.com\r\n")
    expect(rows).toHaveLength(2)
  })

  it(`caps the paste at ${BESPOKE_BULK_MAX_ROWS} rows`, () => {
    const lines: string[] = []
    for (let i = 0; i < BESPOKE_BULK_MAX_ROWS + 50; i++) {
      lines.push(`row${i}@example.com`)
    }
    const { rows } = parseBespokePaste(lines.join("\n"))
    expect(rows.length).toBeLessThanOrEqual(BESPOKE_BULK_MAX_ROWS)
  })
})

describe("createBespokeInvite", () => {
  it("rejects an invalid email format", async () => {
    await expect(
      createBespokeInvite({
        championshipCompetitionId: "comp_c",
        championshipDivisionId: "div_rxm",
        email: "not-an-email",
      }),
    ).rejects.toThrow(/Invalid email/)
  })

  it("rejects free-division competitions", async () => {
    await expect(
      createBespokeInvite({
        championshipCompetitionId: "comp_c",
        championshipDivisionId: "div_rxm",
        email: "jane@example.com",
      }),
    ).rejects.toBeInstanceOf(FreeCompetitionNotEligibleError)
  })
})

describe("createBespokeInvitesBulk", () => {
  it("rejects free-division competitions before parsing", async () => {
    await expect(
      createBespokeInvitesBulk({
        championshipCompetitionId: "comp_c",
        championshipDivisionId: "div_rxm",
        pasteText: "jane@example.com\nbob@example.com",
      }),
    ).rejects.toBeInstanceOf(FreeCompetitionNotEligibleError)
  })
})
