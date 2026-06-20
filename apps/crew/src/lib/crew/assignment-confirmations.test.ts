import { describe, expect, it } from "vitest"
import { CREW_ASSIGNMENT_CONFIRMATION_STATUS } from "../../db/schemas/crew-imports"
import {
  buildCrewAssignmentConfirmationUrls,
  generateCrewAssignmentConfirmationToken,
  getCrewAssignmentConfirmationOperationalState,
  getCrewAssignmentConfirmationTokenState,
  hashCrewAssignmentConfirmationToken,
  resolveCrewAssignmentConfirmationResponse,
  resolveCrewAssignmentConfirmationOrganizerStateUpdate,
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
      resolveCrewAssignmentConfirmationResponse(base, "decline", null, now),
    ).toMatchObject({
      ok: true,
      outcome: "updated",
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED,
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
        null,
        now,
      ),
    ).toMatchObject({
      ok: false,
      reason: "already_responded",
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
      declined: 1,
      changeRequested: 1,
      noShow: 1,
      replaced: 1,
      total: 8,
      responseNeeded: 3,
      organizerActionNeeded: 7,
    })
  })

  it("builds organizer mutation payloads without inventing persisted states", () => {
    const now = new Date("2026-06-19T12:00:00.000Z")

    expect(
      resolveCrewAssignmentConfirmationOrganizerStateUpdate(
        "sent",
        null,
        now,
      ),
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
