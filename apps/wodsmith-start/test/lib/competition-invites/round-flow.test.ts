/**
 * Multi-round flow integration test (per ADR-0011 plan 3.9).
 *
 * Exercises the round-builder smart-select helpers against the data
 * shapes the organizer route assembles after each round ships:
 *   R1: send to 5 source rows + 2 bespoke drafts → 3 accept, 2 pending,
 *       1 declined, 1 expired.
 *   R2: build using "Re-invite non-responders" + "Next 5 on leaderboard"
 *       + "All draft bespoke" → assert R2 selects exactly the right
 *       union of rows.
 *
 * Full DB-side state-machine assertions live in `rounds.test.ts`
 * validation cases plus the manual preview-env walkthrough on the deploy
 * gate. This file is the unit-style covering test for the planning logic.
 */

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
  type SmartSelectRosterRow,
  type SmartSelectRoundEntry,
} from "@/lib/competition-invites/smart-select"

const DIV = "div_rxm"

function row(
  email: string | null,
  belowCutoff: boolean,
): SmartSelectRosterRow {
  return {
    athleteEmail: email,
    championshipDivisionId: DIV,
    belowCutoff,
  }
}

function inv(
  partial: Partial<SmartSelectInviteSummary>,
): SmartSelectInviteSummary {
  // Spread `partial` last so an explicit `activeMarker: null` (declined /
  // expired / revoked) wins over the active default — `?? "active"` would
  // miss nullish overrides.
  return {
    id: `cinv_${partial.email ?? "x"}`,
    email: "x@x.com",
    origin: COMPETITION_INVITE_ORIGIN.SOURCE,
    status: COMPETITION_INVITE_STATUS.PENDING,
    championshipDivisionId: DIV,
    hasClaimToken: true,
    activeMarker: "active",
    ...partial,
  }
}

describe("multi-round flow", () => {
  // R1 roster: 8 source rows in (sortOrder, placement) order. The first 3
  // are above-cutoff (qualifiers), rows 4..8 are waitlist. R1 invited the
  // top 5; R2 will use "Next 5 on leaderboard" to pick the next batch.
  const rosterRows: SmartSelectRosterRow[] = [
    row("alice@x.com", false),
    row("bob@x.com", false),
    row("carol@x.com", false),
    row("dave@x.com", true),
    row("eve@x.com", true),
    row("frank@x.com", true),
    row("gina@x.com", true),
    row("hank@x.com", true),
  ]

  // R1 sent to: 5 source + 2 bespoke (jay + kim).
  // After R1: 3 accept_paid (alice+bob+carol), 1 expired (dave),
  // 1 pending (eve), 1 declined (jay-bespoke), 1 pending (kim-bespoke).
  const r1RoundId = "crnd_r1"
  const r1Recipients = [
    inv({
      id: "cinv_alice",
      email: "alice@x.com",
      status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
    }),
    inv({
      id: "cinv_bob",
      email: "bob@x.com",
      status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
    }),
    inv({
      id: "cinv_carol",
      email: "carol@x.com",
      status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
    }),
    inv({
      id: "cinv_dave",
      email: "dave@x.com",
      status: COMPETITION_INVITE_STATUS.EXPIRED,
      activeMarker: null,
    }),
    inv({
      id: "cinv_eve",
      email: "eve@x.com",
      status: COMPETITION_INVITE_STATUS.PENDING,
    }),
    inv({
      id: "cinv_jay",
      email: "jay@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      status: COMPETITION_INVITE_STATUS.DECLINED,
      activeMarker: null,
    }),
    inv({
      id: "cinv_kim",
      email: "kim@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      status: COMPETITION_INVITE_STATUS.PENDING,
    }),
  ]

  // The active-invites snapshot the organizer route loads via
  // `listActiveInvitesFn`. Terminal-state rows (`activeMarker = NULL`)
  // are still in the DB but do not count as active.
  const activeInvitesSnapshot: SmartSelectInviteSummary[] = [
    ...r1Recipients.filter((i) => i.activeMarker === "active"),
    // Two more bespoke drafts staged after R1 was sent (organizer typed
    // them in for R2). They have no token yet (`hasClaimToken: false`).
    inv({
      id: "cinv_lila",
      email: "lila@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      hasClaimToken: false,
    }),
    inv({
      id: "cinv_mason",
      email: "mason@x.com",
      origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
      hasClaimToken: false,
    }),
  ]

  const r1Round: SmartSelectRoundEntry = {
    round: {
      id: r1RoundId,
      roundNumber: 1,
      status: COMPETITION_INVITE_ROUND_STATUS.SENT,
      sentAt: new Date("2026-04-15T00:00:00Z"),
    },
  }

  it("re-invite non-responders picks pending+expired+revoked from R1", () => {
    const emails = selectReinviteNonResponderEmails({
      rounds: [r1Round],
      roundInvitesByRound: new Map([[r1RoundId, r1Recipients]]),
    })
    expect(emails.sort()).toEqual(
      ["dave@x.com", "eve@x.com", "kim@x.com"].sort(),
    )
  })

  it("excludes accepted_paid + declined recipients from re-invite", () => {
    const emails = selectReinviteNonResponderEmails({
      rounds: [r1Round],
      roundInvitesByRound: new Map([[r1RoundId, r1Recipients]]),
    })
    expect(emails).not.toContain("alice@x.com")
    expect(emails).not.toContain("bob@x.com")
    expect(emails).not.toContain("carol@x.com")
    expect(emails).not.toContain("jay@x.com")
  })

  it("next 5 on leaderboard picks waitlist rows not covered by active invites", () => {
    const idx = indexActiveInvitesByDivisionEmail(activeInvitesSnapshot)
    const next = selectNextOnLeaderboard({
      rows: rosterRows,
      invitesByDivisionEmail: idx,
      count: 5,
    })
    // dave is below cutoff but his R1 invite is terminal (`expired`
    // nulls `activeMarker`), so the index doesn't carry him and he's
    // eligible to re-pick. eve has an active pending invite, so she's
    // excluded.
    const picked = next.map((r) => r.athleteEmail)
    expect(picked).toContain("dave@x.com")
    expect(picked).not.toContain("eve@x.com")
    // Five waitlist rows total; eve is the only one excluded, so we get
    // four picks even when the count asks for five.
    expect(picked).toEqual([
      "dave@x.com",
      "frank@x.com",
      "gina@x.com",
      "hank@x.com",
    ])
  })

  it("all draft bespoke selects the post-R1 staged drafts only", () => {
    const drafts = selectAllDraftBespoke(activeInvitesSnapshot)
    const ids = drafts.map((d) => d.id).sort()
    expect(ids).toEqual(["cinv_lila", "cinv_mason"].sort())
    // Kim is still active-bespoke but already has a token from R1 — she
    // is NOT a draft.
    expect(ids).not.toContain("cinv_kim")
  })

  it("R2 union: re-invite + next-5 + draft-bespoke covers every expected athlete", () => {
    const reinvite = selectReinviteNonResponderEmails({
      rounds: [r1Round],
      roundInvitesByRound: new Map([[r1RoundId, r1Recipients]]),
    })
    const idx = indexActiveInvitesByDivisionEmail(activeInvitesSnapshot)
    const next = selectNextOnLeaderboard({
      rows: rosterRows,
      invitesByDivisionEmail: idx,
      count: 5,
    })
    const drafts = selectAllDraftBespoke(activeInvitesSnapshot)

    const r2Emails = new Set<string>()
    for (const e of reinvite) r2Emails.add(e)
    for (const r of next)
      if (r.athleteEmail) r2Emails.add(r.athleteEmail.toLowerCase())
    for (const d of drafts) r2Emails.add(d.email.toLowerCase())

    // R2 must include the non-responders, the next-5 waitlist, and the
    // staged bespoke drafts. It must NOT include accepted_paid (already
    // registered) or declined (terminal).
    expect(r2Emails.has("dave@x.com")).toBe(true)
    expect(r2Emails.has("eve@x.com")).toBe(true)
    expect(r2Emails.has("kim@x.com")).toBe(true)
    expect(r2Emails.has("frank@x.com")).toBe(true)
    expect(r2Emails.has("gina@x.com")).toBe(true)
    expect(r2Emails.has("lila@x.com")).toBe(true)
    expect(r2Emails.has("mason@x.com")).toBe(true)

    expect(r2Emails.has("alice@x.com")).toBe(false)
    expect(r2Emails.has("bob@x.com")).toBe(false)
    expect(r2Emails.has("carol@x.com")).toBe(false)
    expect(r2Emails.has("jay@x.com")).toBe(false)
  })

  it("most-recent-sent-round picker survives a draft R2 in the list", () => {
    // Once the organizer starts composing R2 it shows up in
    // `listRoundsFn` with status=draft. The picker must continue to
    // resolve to R1 so smart-select still has a round to read from.
    const r2Draft: SmartSelectRoundEntry = {
      round: {
        id: "crnd_r2",
        roundNumber: 2,
        status: COMPETITION_INVITE_ROUND_STATUS.DRAFT,
        sentAt: null,
      },
    }
    const picked = pickMostRecentSentRound([r1Round, r2Draft])
    expect(picked?.round.id).toBe(r1RoundId)
  })
})
