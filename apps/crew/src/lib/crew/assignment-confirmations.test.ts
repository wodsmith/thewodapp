// @lat: [[crew#Confirmation Emails And Reminders]]
import { describe, expect, it } from "vitest"
import { CREW_ASSIGNMENT_CONFIRMATION_STATUS } from "../../db/schemas/crew-imports"
import {
  buildCrewAssignmentConfirmationEmailPlan,
  buildCrewAssignmentConfirmationUrls,
  buildCrewAssignmentEmailIdempotencyKey,
  generateCrewAssignmentConfirmationToken,
  getCrewAssignmentConfirmationOperationalState,
  getCrewAssignmentConfirmationTokenState,
  hashCrewAssignmentConfirmationToken,
  resolveCrewAssignmentConfirmationOrganizerStateUpdate,
  resolveCrewAssignmentConfirmationResponse,
  summarizeCrewAssignmentConfirmationOperationalStates,
  summarizeCrewAssignmentConfirmations,
} from "./assignment-confirmations"

describe("Crew assignment confirmation tokens", () => {
  it("generates URL-safe random tokens and stable hashes", async () => {
    const token = generateCrewAssignmentConfirmationToken()
    const hash = await hashCrewAssignmentConfirmationToken(token)

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token).toHaveLength(43)
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    await expect(hashCrewAssignmentConfirmationToken(token)).resolves.toBe(hash)
  })

  it("classifies missing, invalid, expired, and terminal token rows", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")

    expect(getCrewAssignmentConfirmationTokenState(null, now)).toBe("missing")
    expect(
      getCrewAssignmentConfirmationTokenState(
        {
          tokenHash: "sha256:abc",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          expiresAt: null,
        },
        now,
      ),
    ).toBe("bad")
    expect(
      getCrewAssignmentConfirmationTokenState(
        {
          tokenHash: "sha256:abc",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          expiresAt: "2026-06-18T12:00:00.000Z",
        },
        now,
      ),
    ).toBe("expired")
    expect(
      getCrewAssignmentConfirmationTokenState(
        {
          tokenHash: "sha256:abc",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
          expiresAt: "2026-06-18T12:00:00.000Z",
        },
        now,
      ),
    ).toBe("valid")
  })
})

describe("Crew assignment response state transitions", () => {
  it("moves pending rows to confirmed, declined, or change requested", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")
    const base = {
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      expiresAt: "2026-06-20T12:00:00.000Z",
    }

    expect(
      resolveCrewAssignmentConfirmationResponse(base, "confirm", null, now),
    ).toMatchObject({
      ok: true,
      outcome: "updated",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
      responseNote: null,
      respondedAt: now,
    })
    expect(
      resolveCrewAssignmentConfirmationResponse(
        base,
        "decline",
        "I cannot make it.",
        now,
      ),
    ).toMatchObject({
      ok: true,
      outcome: "updated",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
      responseNote: "I cannot make it.",
      respondedAt: now,
    })
    expect(
      resolveCrewAssignmentConfirmationResponse(
        base,
        "request_change",
        " I can do the afternoon. ",
        now,
      ),
    ).toMatchObject({
      ok: true,
      outcome: "updated",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED,
      responseNote: "I can do the afternoon.",
      respondedAt: now,
    })
  })

  it("requires notes for decline and change requests", () => {
    const base = {
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      expiresAt: "2026-06-20T12:00:00.000Z",
    }

    expect(
      resolveCrewAssignmentConfirmationResponse(
        base,
        "decline",
        "  ",
        new Date("2026-06-19T12:00:00.000Z"),
      ),
    ).toMatchObject({
      ok: false,
      reason: "missing_note",
      message: "Add a note before declining this assignment.",
    })
    expect(
      resolveCrewAssignmentConfirmationResponse(
        base,
        "request_change",
        "",
        new Date("2026-06-19T12:00:00.000Z"),
      ),
    ).toMatchObject({
      ok: false,
      reason: "missing_note",
      message: "Add a note before requesting a change.",
    })
  })

  it("makes repeated identical responses idempotent and rejects conflicts", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")
    const confirmed = {
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
      expiresAt: "2026-06-20T12:00:00.000Z",
    }

    expect(
      resolveCrewAssignmentConfirmationResponse(
        confirmed,
        "confirm",
        null,
        now,
      ),
    ).toMatchObject({
      ok: true,
      outcome: "idempotent",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
    })
    expect(
      resolveCrewAssignmentConfirmationResponse(
        confirmed,
        "decline",
        "Schedule conflict",
        now,
      ),
    ).toMatchObject({
      ok: false,
      reason: "already_responded",
    })

    expect(
      resolveCrewAssignmentConfirmationResponse(
        {
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED,
          expiresAt: "2026-06-20T12:00:00.000Z",
          responseNote: " Need afternoon ",
        },
        "request_change",
        "\nNeed afternoon\n",
        now,
      ),
    ).toMatchObject({
      ok: true,
      outcome: "idempotent",
      responseNote: "Need afternoon",
    })
  })

  it("rejects expired pending tokens", () => {
    expect(
      resolveCrewAssignmentConfirmationResponse(
        {
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          expiresAt: "2026-06-18T12:00:00.000Z",
        },
        "confirm",
        null,
        new Date("2026-06-19T12:00:00.000Z"),
      ),
    ).toMatchObject({
      ok: false,
      reason: "expired",
    })
  })

  it("rejects cancelled confirmations as cancelled", () => {
    expect(
      resolveCrewAssignmentConfirmationResponse(
        {
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
          expiresAt: "2026-06-20T12:00:00.000Z",
        },
        "confirm",
        null,
        new Date("2026-06-19T12:00:00.000Z"),
      ),
    ).toMatchObject({
      ok: false,
      reason: "cancelled",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
    })
  })
})

describe("Crew assignment confirmation summaries", () => {
  it("counts missing statuses as pending", () => {
    expect(
      summarizeCrewAssignmentConfirmations([
        CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
        CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
        CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED,
        CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
        null,
      ]),
    ).toEqual({
      pending: 1,
      confirmed: 1,
      checkedIn: 0,
      declined: 1,
      changeRequested: 1,
      noShow: 0,
      cancelled: 1,
    })
  })

  it("builds public confirmation and schedule URLs", () => {
    expect(
      buildCrewAssignmentConfirmationUrls({
        appUrl: "https://crew.wodsmith.com/",
        slug: "friday-night-lights",
        token: "abc_123",
      }),
    ).toEqual({
      confirmUrl:
        "https://crew.wodsmith.com/e/friday-night-lights/confirm/abc_123",
      scheduleUrl:
        "https://crew.wodsmith.com/e/friday-night-lights/schedule/abc_123",
    })
  })
})

describe("Crew assignment confirmation operational states", () => {
  it("normalizes missing, pending, sent, response, no-show, and replaced states", () => {
    expect(getCrewAssignmentConfirmationOperationalState(null)).toBe("missing")
    expect(
      getCrewAssignmentConfirmationOperationalState({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        sentAt: null,
      }),
    ).toBe("pending")
    expect(
      getCrewAssignmentConfirmationOperationalState({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        sentAt: "2026-06-19T12:00:00.000Z",
      }),
    ).toBe("sent")
    expect(
      getCrewAssignmentConfirmationOperationalState({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
      }),
    ).toBe("confirmed")
    expect(
      getCrewAssignmentConfirmationOperationalState({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHECKED_IN,
      }),
    ).toBe("checked_in")
    expect(
      getCrewAssignmentConfirmationOperationalState({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW,
      }),
    ).toBe("no_show")
    expect(
      getCrewAssignmentConfirmationOperationalState({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
      }),
    ).toBe("replaced")
  })

  it("summarizes operational states separately from persisted statuses", () => {
    expect(
      summarizeCrewAssignmentConfirmationOperationalStates([
        null,
        {
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          sentAt: null,
        },
        {
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          sentAt: "2026-06-19T12:00:00.000Z",
        },
        { status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED },
        { status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHECKED_IN },
        { status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED },
        { status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED },
        { status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.NO_SHOW },
        { status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED },
      ]),
    ).toEqual({
      missing: 1,
      pending: 1,
      sent: 1,
      confirmed: 1,
      checkedIn: 1,
      declined: 1,
      changeRequested: 1,
      noShow: 1,
      replaced: 1,
      total: 9,
      responseNeeded: 3,
      organizerActionNeeded: 7,
    })
  })

  it("builds organizer mutation payloads without inventing persisted states", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")

    expect(
      resolveCrewAssignmentConfirmationOrganizerStateUpdate("sent", null, now),
    ).toEqual({
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      sentAt: now,
      respondedAt: null,
      responseNote: null,
    })
    expect(
      resolveCrewAssignmentConfirmationOrganizerStateUpdate(
        "change_requested",
        " Need a later slot. ",
        now,
        { sentAt: "2026-06-19T10:00:00.000Z" },
      ),
    ).toEqual({
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED,
      sentAt: new Date("2026-06-19T10:00:00.000Z"),
      respondedAt: now,
      responseNote: "Need a later slot.",
    })
    expect(
      resolveCrewAssignmentConfirmationOrganizerStateUpdate(
        "replaced",
        "Covered by Sam.",
        now,
      ),
    ).toMatchObject({
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
      sentAt: null,
      respondedAt: null,
      responseNote: "Covered by Sam.",
    })
  })
})

describe("Crew assignment confirmation email planning", () => {
  const now = new Date("2026-06-20T12:00:00.000Z")

  it("selects unsent pending confirmations with deterministic idempotency keys", () => {
    const plan = buildCrewAssignmentConfirmationEmailPlan({
      mode: "confirmations",
      now,
      candidates: [
        {
          confirmationId: "caconf_ready",
          assignmentId: "vsha_ready",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: " ADA@example.com ",
          sentAt: null,
          shiftStartTime: "2026-06-22T12:00:00.000Z",
        },
        {
          confirmationId: "caconf_sent",
          assignmentId: "vsha_sent",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: "grace@example.com",
          sentAt: "2026-06-20T10:00:00.000Z",
          shiftStartTime: "2026-06-22T12:00:00.000Z",
        },
        {
          confirmationId: "caconf_missing_email",
          assignmentId: "vsha_missing_email",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: " ",
          sentAt: null,
          shiftStartTime: "2026-06-22T12:00:00.000Z",
        },
        {
          confirmationId: "caconf_confirmed",
          assignmentId: "vsha_confirmed",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED,
          email: "lin@example.com",
          sentAt: null,
          shiftStartTime: "2026-06-22T12:00:00.000Z",
        },
      ],
    })

    expect(plan.operations).toEqual([
      {
        kind: "confirmation",
        confirmationId: "caconf_ready",
        assignmentId: "vsha_ready",
        email: "ada@example.com",
        reminderCount: 0,
        idempotencyKey: "crew-confirmation-caconf_ready-0",
      },
    ])
    expect(plan.skipped).toMatchObject({
      alreadySent: 1,
      missingEmail: 1,
      responded: 1,
    })
  })

  it("selects 48-hour and 24-hour reminders without double sending retries", () => {
    const plan = buildCrewAssignmentConfirmationEmailPlan({
      mode: "reminders",
      now,
      candidates: [
        {
          confirmationId: "caconf_48h",
          assignmentId: "vsha_48h",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: "forty-eight@example.com",
          sentAt: "2026-06-20T08:00:00.000Z",
          reminderCount: 0,
          shiftStartTime: "2026-06-22T11:00:00.000Z",
        },
        {
          confirmationId: "caconf_24h",
          assignmentId: "vsha_24h",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: "twenty-four@example.com",
          sentAt: "2026-06-20T08:00:00.000Z",
          reminderCount: 1,
          shiftStartTime: "2026-06-21T10:00:00.000Z",
        },
        {
          confirmationId: "caconf_already_24h",
          assignmentId: "vsha_already_24h",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: "already@example.com",
          sentAt: "2026-06-20T08:00:00.000Z",
          reminderCount: 2,
          shiftStartTime: "2026-06-21T10:00:00.000Z",
        },
        {
          confirmationId: "caconf_unsent",
          assignmentId: "vsha_unsent",
          status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
          email: "unsent@example.com",
          sentAt: null,
          reminderCount: 0,
          shiftStartTime: "2026-06-21T10:00:00.000Z",
        },
      ],
    })

    expect(plan.operations).toEqual([
      {
        kind: "reminder-48-hour",
        confirmationId: "caconf_48h",
        assignmentId: "vsha_48h",
        email: "forty-eight@example.com",
        reminderCount: 1,
        idempotencyKey: "crew-confirmation-caconf_48h-1",
      },
      {
        kind: "reminder-24-hour",
        confirmationId: "caconf_24h",
        assignmentId: "vsha_24h",
        email: "twenty-four@example.com",
        reminderCount: 2,
        idempotencyKey: "crew-confirmation-caconf_24h-2",
      },
    ])
    expect(plan.skipped.notDue).toBe(2)
  })

  it("builds repo-consistent crew confirmation idempotency keys", () => {
    expect(buildCrewAssignmentEmailIdempotencyKey("caconf_123", 2)).toBe(
      "crew-confirmation-caconf_123-2",
    )
  })
})
