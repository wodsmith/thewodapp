import { describe, expect, it } from "vitest"
import { CREW_ASSIGNMENT_CONFIRMATION_STATUS } from "@/db/schemas/crew-imports"
import {
  buildCrewAssignmentMessageRecipients,
  buildCrewBroadcastMessageRecipients,
  classifyCrewMessageRecipient,
  type CrewMessageAssignmentCandidate,
  filterCrewMessageCandidates,
} from "@/lib/crew/message-recipients"

const NOW = new Date("2026-07-03T12:00:00.000Z")
const HOUR = 60 * 60 * 1000

function candidate(
  overrides: Partial<CrewMessageAssignmentCandidate> = {},
): CrewMessageAssignmentCandidate {
  return {
    assignmentId: "vshfa_1",
    confirmationId: "caconf_1",
    membershipId: "tmem_1",
    invitationId: null,
    volunteerName: "Ada Judge",
    volunteerEmail: "ada@example.com",
    shiftId: "vshf_1",
    shiftName: "Lane judging",
    roleType: "judge",
    roleLabel: "Judge",
    startsAt: new Date(NOW.getTime() + 72 * HOUR),
    state: "pending",
    status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
    sentAt: null,
    reminderCount: 0,
    ...overrides,
  }
}

describe("classifyCrewMessageRecipient — confirmation mode", () => {
  it("marks an unsent pending assignment with email as eligible", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate(),
      mode: "assignment_confirmation",
      now: NOW,
    })
    expect(result).toEqual({
      eligible: true,
      skipReason: null,
      reminderCount: 0,
    })
  })

  it("skips a candidate with no email", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({ volunteerEmail: null }),
      mode: "assignment_confirmation",
      now: NOW,
    })
    expect(result.eligible).toBe(false)
    expect(result.skipReason).toBe("missing_email")
  })

  it("skips an already-sent confirmation", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({ sentAt: new Date(NOW.getTime() - HOUR) }),
      mode: "assignment_confirmation",
      now: NOW,
    })
    expect(result.skipReason).toBe("already_sent")
  })

  it("skips a responded (non-pending) assignment", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
      }),
      mode: "assignment_confirmation",
      now: NOW,
    })
    expect(result.skipReason).toBe("responded")
  })

  it("skips a shift that has already started", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({ startsAt: new Date(NOW.getTime() - HOUR) }),
      mode: "assignment_confirmation",
      now: NOW,
    })
    expect(result.skipReason).toBe("past_shift")
  })
})

describe("classifyCrewMessageRecipient — reminder mode", () => {
  it("is not due when the initial confirmation was never sent", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({
        sentAt: null,
        startsAt: new Date(NOW.getTime() + 20 * HOUR),
      }),
      mode: "reminder",
      now: NOW,
    })
    expect(result.eligible).toBe(false)
    expect(result.skipReason).toBe("not_due")
  })

  it("is due at reminderCount 1 inside the 48-hour window", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({
        sentAt: new Date(NOW.getTime() - 24 * HOUR),
        reminderCount: 0,
        startsAt: new Date(NOW.getTime() + 40 * HOUR),
      }),
      mode: "reminder",
      now: NOW,
    })
    expect(result.eligible).toBe(true)
    expect(result.reminderCount).toBe(1)
  })

  it("is due at reminderCount 2 inside the 24-hour window", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({
        sentAt: new Date(NOW.getTime() - 24 * HOUR),
        reminderCount: 1,
        startsAt: new Date(NOW.getTime() + 12 * HOUR),
      }),
      mode: "reminder",
      now: NOW,
    })
    expect(result.eligible).toBe(true)
    expect(result.reminderCount).toBe(2)
  })

  it("is not due when the shift is too far out", () => {
    const result = classifyCrewMessageRecipient({
      candidate: candidate({
        sentAt: new Date(NOW.getTime() - HOUR),
        reminderCount: 0,
        startsAt: new Date(NOW.getTime() + 96 * HOUR),
      }),
      mode: "reminder",
      now: NOW,
    })
    expect(result.skipReason).toBe("not_due")
  })
})

describe("filterCrewMessageCandidates", () => {
  const pool = [
    candidate({ assignmentId: "a1", roleType: "judge", shiftId: "s1", state: "pending", volunteerName: "Ada" }),
    candidate({ assignmentId: "a2", roleType: "medical", shiftId: "s2", state: "sent", volunteerName: "Bo", volunteerEmail: "bo@example.com" }),
    candidate({ assignmentId: "a3", roleType: "judge", shiftId: "s2", state: "confirmed", volunteerName: "Cy" }),
  ]

  it("filters by state", () => {
    const result = filterCrewMessageCandidates(pool, { states: ["sent"] })
    expect(result.map((c) => c.assignmentId)).toEqual(["a2"])
  })

  it("filters by role", () => {
    const result = filterCrewMessageCandidates(pool, { roles: ["judge"] })
    expect(result.map((c) => c.assignmentId)).toEqual(["a1", "a3"])
  })

  it("filters by shift", () => {
    const result = filterCrewMessageCandidates(pool, { shiftIds: ["s2"] })
    expect(result.map((c) => c.assignmentId)).toEqual(["a2", "a3"])
  })

  it("filters by search across name and email", () => {
    expect(
      filterCrewMessageCandidates(pool, { search: "bo@example" }).map(
        (c) => c.assignmentId,
      ),
    ).toEqual(["a2"])
    expect(
      filterCrewMessageCandidates(pool, { search: "cy" }).map(
        (c) => c.assignmentId,
      ),
    ).toEqual(["a3"])
  })

  it("returns everything when no filters are set", () => {
    expect(filterCrewMessageCandidates(pool, {})).toHaveLength(3)
  })
})

describe("buildCrewAssignmentMessageRecipients", () => {
  it("hides already-sent rows by default and shows them when included", () => {
    const candidates = [
      candidate({ confirmationId: "c1" }),
      candidate({
        confirmationId: "c2",
        assignmentId: "a2",
        sentAt: new Date(NOW.getTime() - HOUR),
      }),
    ]

    const hidden = buildCrewAssignmentMessageRecipients({
      candidates,
      mode: "assignment_confirmation",
      includeAlreadySent: false,
      now: NOW,
    })
    expect(hidden.recipients.map((r) => r.key)).toEqual(["c1"])
    expect(hidden.skipped.alreadySent).toBe(0)

    const shown = buildCrewAssignmentMessageRecipients({
      candidates,
      mode: "assignment_confirmation",
      includeAlreadySent: true,
      now: NOW,
    })
    expect(shown.recipients.map((r) => r.key)).toEqual(["c1", "c2"])
    expect(shown.skipped.alreadySent).toBe(1)
    const alreadySent = shown.recipients.find((r) => r.key === "c2")
    expect(alreadySent?.eligible).toBe(false)
  })
})

describe("buildCrewBroadcastMessageRecipients", () => {
  it("dedupes volunteers by email and keeps the earliest shift", () => {
    const candidates = [
      candidate({
        assignmentId: "a1",
        confirmationId: "c1",
        volunteerEmail: "ada@example.com",
        shiftName: "Later shift",
        startsAt: new Date(NOW.getTime() + 48 * HOUR),
      }),
      candidate({
        assignmentId: "a2",
        confirmationId: "c2",
        volunteerEmail: "ADA@example.com",
        shiftName: "Earlier shift",
        startsAt: new Date(NOW.getTime() + 12 * HOUR),
      }),
    ]

    const result = buildCrewBroadcastMessageRecipients(candidates)
    expect(result.recipients).toHaveLength(1)
    expect(result.recipients[0].key).toBe("email:ada@example.com")
    expect(result.recipients[0].eligible).toBe(true)
    expect(result.recipients[0].shiftName).toBe("Earlier shift")
  })

  it("marks volunteers with no email ineligible", () => {
    const result = buildCrewBroadcastMessageRecipients([
      candidate({ volunteerEmail: null }),
    ])
    expect(result.recipients[0].eligible).toBe(false)
    expect(result.recipients[0].skipReason).toBe("missing_email")
    expect(result.skipped.missingEmail).toBe(1)
  })
})
