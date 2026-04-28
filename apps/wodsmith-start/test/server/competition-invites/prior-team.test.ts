import { beforeEach, describe, expect, it, vi } from "vitest"

// Sequential select-result queue. Each `db.select(...).from(...)...` chain
// yields the next array we push. The implementation makes 1–3 sequential
// queries depending on branch; we line up the results in order.
const selectQueue: unknown[][] = []

// Minimal chain stub: every method returns `this`, and the object is
// thenable so awaiting at any point resolves the next queued result.
function makeChain(): unknown {
  const chain: Record<string, unknown> = {}
  const noop = () => chain
  for (const m of ["from", "where", "limit", "innerJoin", "leftJoin"]) {
    chain[m] = vi.fn(noop)
  }
  chain.then = (resolve: (value: unknown) => void) => {
    const next = selectQueue.shift() ?? []
    resolve(next)
    return Promise.resolve(next)
  }
  return chain
}

const fakeDb = {
  select: vi.fn(() => makeChain()),
}

vi.mock("@/db", () => ({
  getDb: vi.fn(() => fakeDb),
}))

vi.mock("cloudflare:workers", () => ({
  env: { APP_URL: "https://test.wodsmith.com" },
}))

import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
} from "@/db/schemas/competition-invites"
import { getPriorTeamForInvite } from "@/server/competition-invites/prior-team"

function inviteFixture(
  overrides: Partial<CompetitionInvite> = {},
): CompetitionInvite {
  return {
    id: "cinv_test",
    championshipCompetitionId: "comp_c",
    roundId: "",
    origin: COMPETITION_INVITE_ORIGIN.SOURCE,
    sourceId: "cisrc_1",
    sourceCompetitionId: "comp_source",
    sourcePlacement: 1,
    sourcePlacementLabel: "1st",
    bespokeReason: null,
    championshipDivisionId: "div_rxm",
    email: "captain@example.com",
    userId: "usr_captain",
    inviteeFirstName: "Cap",
    inviteeLastName: null,
    claimToken: "tok_x",
    expiresAt: new Date("2026-05-01T00:00:00Z"),
    sendAttempt: 1,
    status: COMPETITION_INVITE_STATUS.PENDING,
    paidAt: null,
    declinedAt: null,
    revokedAt: null,
    revokedByUserId: null,
    claimedRegistrationId: null,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.SENT,
    emailLastError: null,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
    updateCounter: 0,
    ...overrides,
  }
}

beforeEach(() => {
  selectQueue.length = 0
  fakeDb.select.mockClear()
})

// @lat: [[competition-invites#Prior team prefill]]
describe("getPriorTeamForInvite", () => {
  it("returns null when invite has no sourceCompetitionId (bespoke)", async () => {
    const result = await getPriorTeamForInvite({
      invite: inviteFixture({ sourceCompetitionId: null, sourceId: null }),
    })
    expect(result).toBeNull()
    // No DB calls at all on the bespoke fast-path.
    expect(fakeDb.select).not.toHaveBeenCalled()
  })

  it("returns prior team + teammates when invitee was the captain", async () => {
    // Query 1: captain registration lookup → has athleteTeamId.
    selectQueue.push([{ athleteTeamId: "team_prior", teamName: "Crush" }])
    // Query 2: team-membership join → two other members (captain excluded
    // by the SQL `ne(userId, inviteeUserId)`).
    selectQueue.push([
      {
        email: "buddy@example.com",
        firstName: "Buddy",
        lastName: "One",
        affiliateName: "Gym A",
      },
      {
        email: "pal@example.com",
        firstName: "Pal",
        lastName: "Two",
        affiliateName: null,
      },
    ])

    const result = await getPriorTeamForInvite({
      invite: inviteFixture({ userId: "usr_captain" }),
    })

    expect(result).toEqual({
      teamName: "Crush",
      teammates: [
        {
          email: "buddy@example.com",
          firstName: "Buddy",
          lastName: "One",
          affiliateName: "Gym A",
        },
        {
          email: "pal@example.com",
          firstName: "Pal",
          lastName: "Two",
          affiliateName: "",
        },
      ],
    })
  })

  it("returns null when invitee's prior registration was individual (athleteTeamId IS NULL)", async () => {
    // Query 1: captain registration row exists but is solo.
    selectQueue.push([{ athleteTeamId: null, teamName: null }])
    // Query 2: membership lane lookup → user is in no other teams.
    selectQueue.push([])

    const result = await getPriorTeamForInvite({
      invite: inviteFixture({ userId: "usr_captain" }),
    })
    expect(result).toBeNull()
  })

  it("falls back to email lookup when invite.userId is missing", async () => {
    // Query 1: user-by-email lookup.
    selectQueue.push([{ id: "usr_resolved" }])
    // Query 2: captain registration lookup.
    selectQueue.push([{ athleteTeamId: "team_prior", teamName: "Late Adds" }])
    // Query 3: membership join.
    selectQueue.push([
      {
        email: "mate@example.com",
        firstName: "Mate",
        lastName: "Doe",
        affiliateName: "Gym B",
      },
    ])

    const result = await getPriorTeamForInvite({
      invite: inviteFixture({ userId: null }),
    })

    expect(result).toEqual({
      teamName: "Late Adds",
      teammates: [
        {
          email: "mate@example.com",
          firstName: "Mate",
          lastName: "Doe",
          affiliateName: "Gym B",
        },
      ],
    })
  })

  it("returns null when no user account exists for the invite email", async () => {
    // Query 1: user-by-email lookup → empty.
    selectQueue.push([])

    const result = await getPriorTeamForInvite({
      invite: inviteFixture({ userId: null }),
    })
    expect(result).toBeNull()
  })
})
