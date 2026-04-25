import { describe, expect, it } from "vitest"
import {
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_ROUND_STATUS,
  COMPETITION_INVITE_STATUS,
} from "@/db/schemas/competition-invites"
import {
  indexActiveInvitesByDivisionEmail,
  pickMostRecentSentRound,
  selectAllDraftBespoke,
  selectNextOnLeaderboard,
  selectReinviteNonResponderEmails,
  type SmartSelectInviteSummary,
  type SmartSelectRoundEntry,
} from "@/lib/competition-invites/smart-select"

function inviteFixture(
  partial: Partial<SmartSelectInviteSummary> = {},
): SmartSelectInviteSummary {
  return {
    id: "cinv_1",
    email: "alice@example.com",
    origin: COMPETITION_INVITE_ORIGIN.SOURCE,
    status: COMPETITION_INVITE_STATUS.PENDING,
    championshipDivisionId: "div_rxm",
    hasClaimToken: true,
    activeMarker: "active",
    ...partial,
  }
}

function roundFixture(
  partial: Partial<SmartSelectRoundEntry["round"]> = {},
): SmartSelectRoundEntry {
  return {
    round: {
      id: "crnd_1",
      roundNumber: 1,
      status: COMPETITION_INVITE_ROUND_STATUS.SENT,
      sentAt: new Date("2026-04-15T00:00:00Z"),
      ...partial,
    },
  }
}

describe("pickMostRecentSentRound", () => {
  it("returns the highest-numbered sent round", () => {
    const r1 = roundFixture({ id: "crnd_1", roundNumber: 1 })
    const r2 = roundFixture({ id: "crnd_2", roundNumber: 2 })
    const result = pickMostRecentSentRound([r1, r2])
    expect(result?.round.id).toBe("crnd_2")
  })

  it("ignores non-sent rounds", () => {
    const draft = roundFixture({
      id: "crnd_d",
      roundNumber: 5,
      status: COMPETITION_INVITE_ROUND_STATUS.DRAFT,
    })
    const sent = roundFixture({ id: "crnd_s", roundNumber: 2 })
    expect(pickMostRecentSentRound([draft, sent])?.round.id).toBe("crnd_s")
  })

  it("returns null when no sent rounds exist", () => {
    expect(pickMostRecentSentRound([])).toBeNull()
    expect(
      pickMostRecentSentRound([
        roundFixture({ status: COMPETITION_INVITE_ROUND_STATUS.DRAFT }),
      ]),
    ).toBeNull()
  })
})

describe("selectReinviteNonResponderEmails", () => {
  it("returns pending/expired/revoked recipients of the most recent sent round", () => {
    const round = roundFixture({ id: "crnd_1", roundNumber: 1 })
    const map = new Map([
      [
        "crnd_1",
        [
          { email: "Pending@x.com", status: COMPETITION_INVITE_STATUS.PENDING },
          { email: "expired@x.com", status: COMPETITION_INVITE_STATUS.EXPIRED },
          { email: "revoked@x.com", status: COMPETITION_INVITE_STATUS.REVOKED },
          {
            email: "paid@x.com",
            status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
          },
          {
            email: "declined@x.com",
            status: COMPETITION_INVITE_STATUS.DECLINED,
          },
        ],
      ],
    ])
    const emails = selectReinviteNonResponderEmails({
      rounds: [round],
      roundInvitesByRound: map,
    })
    expect(emails.sort()).toEqual(
      ["pending@x.com", "expired@x.com", "revoked@x.com"].sort(),
    )
  })

  it("normalizes case and dedupes", () => {
    const round = roundFixture({ id: "crnd_1" })
    const map = new Map([
      [
        "crnd_1",
        [
          { email: "Same@X.com", status: COMPETITION_INVITE_STATUS.PENDING },
          { email: "same@x.com", status: COMPETITION_INVITE_STATUS.PENDING },
        ],
      ],
    ])
    expect(
      selectReinviteNonResponderEmails({
        rounds: [round],
        roundInvitesByRound: map,
      }),
    ).toEqual(["same@x.com"])
  })

  it("returns empty when no sent round exists", () => {
    expect(
      selectReinviteNonResponderEmails({
        rounds: [],
        roundInvitesByRound: new Map(),
      }),
    ).toEqual([])
  })
})

describe("selectNextOnLeaderboard", () => {
  const rows = [
    {
      athleteEmail: "qual@x.com",
      championshipDivisionId: "div_rxm",
      belowCutoff: false,
    },
    {
      athleteEmail: "wait1@x.com",
      championshipDivisionId: "div_rxm",
      belowCutoff: true,
    },
    {
      athleteEmail: "wait2@x.com",
      championshipDivisionId: "div_rxm",
      belowCutoff: true,
    },
    {
      athleteEmail: "wait3@x.com",
      championshipDivisionId: "div_rxm",
      belowCutoff: true,
    },
    {
      athleteEmail: null,
      championshipDivisionId: "div_rxm",
      belowCutoff: true,
    },
  ]

  it("picks the next N waitlist rows in order", () => {
    const picked = selectNextOnLeaderboard({
      rows,
      invitesByDivisionEmail: new Map(),
      count: 2,
    })
    expect(picked.map((r) => r.athleteEmail)).toEqual([
      "wait1@x.com",
      "wait2@x.com",
    ])
  })

  it("skips rows that already have an active invite", () => {
    const picked = selectNextOnLeaderboard({
      rows,
      invitesByDivisionEmail: indexActiveInvitesByDivisionEmail([
        inviteFixture({ email: "wait1@x.com" }),
      ]),
      count: 3,
    })
    expect(picked.map((r) => r.athleteEmail)).toEqual([
      "wait2@x.com",
      "wait3@x.com",
    ])
  })

  it("skips rows without an email", () => {
    const picked = selectNextOnLeaderboard({
      rows,
      invitesByDivisionEmail: new Map(),
      count: 5,
    })
    expect(picked.every((r) => r.athleteEmail !== null)).toBe(true)
  })

  it("returns empty when count is zero or negative", () => {
    expect(
      selectNextOnLeaderboard({
        rows,
        invitesByDivisionEmail: new Map(),
        count: 0,
      }),
    ).toEqual([])
    expect(
      selectNextOnLeaderboard({
        rows,
        invitesByDivisionEmail: new Map(),
        count: -1,
      }),
    ).toEqual([])
  })
})

describe("selectAllDraftBespoke", () => {
  it("returns active bespoke rows without a claim token", () => {
    const draftA = inviteFixture({
      id: "cinv_a",
      email: "a@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      hasClaimToken: false,
    })
    const draftB = inviteFixture({
      id: "cinv_b",
      email: "b@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      hasClaimToken: false,
    })
    const sent = inviteFixture({
      id: "cinv_c",
      email: "c@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      hasClaimToken: true,
    })
    const sourceDraft = inviteFixture({
      id: "cinv_d",
      email: "d@x.com",
      origin: COMPETITION_INVITE_ORIGIN.SOURCE,
      hasClaimToken: false,
    })
    const result = selectAllDraftBespoke([draftA, draftB, sent, sourceDraft])
    expect(result.map((i) => i.id).sort()).toEqual(["cinv_a", "cinv_b"].sort())
  })

  it("excludes terminal-state bespoke rows", () => {
    const declined = inviteFixture({
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      hasClaimToken: false,
      activeMarker: null,
    })
    expect(selectAllDraftBespoke([declined])).toEqual([])
  })
})
