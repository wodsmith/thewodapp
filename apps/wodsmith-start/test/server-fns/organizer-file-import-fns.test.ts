import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseAppliedEntities } from "@/db/schema"
import type {
  EventProposal,
  VolunteerProposal,
} from "@/lib/organizer-file-import/schemas"

// Boundary mocks via vi.hoisted so they're available inside the (hoisted)
// vi.mock factories. The real pure planners (validate.ts) stay in play — this
// exercises applyOrganizerImportFn / undoImportFn orchestration end to end.
const h = vi.hoisted(() => ({
  loadScopeByRun: vi.fn(),
  requireAccess: vi.fn(() => Promise.resolve()),
  loadExistingEvents: vi.fn((): Promise<unknown[]> => Promise.resolve([])),
  inviteVolunteer: vi.fn(() => Promise.resolve({ success: true })),
  createEvent: vi.fn(() =>
    Promise.resolve({ workoutId: "wkt_1", trackWorkoutId: "trwk_new" }),
  ),
  removeEvent: vi.fn(() => Promise.resolve({ success: true })),
  saveEvent: vi.fn(() => Promise.resolve({ success: true })),
  getSession: vi.fn(() => Promise.resolve({ user: { id: "usr_organizer" } })),
}))

// createServerFn passthrough: the exported fn IS its handler.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: (args: { data: unknown }) => unknown) => fn,
    }),
  }),
}))

const mockDb = new FakeDrizzleDb()
mockDb.registerTable("teamInvitationTable")
vi.mock("@/db", () => ({ getDb: vi.fn(() => mockDb) }))

vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn(),
}))

vi.mock("@/utils/auth", () => ({ getSessionFromCookie: h.getSession }))

vi.mock("@/server/organizer-file-import/access", () => ({
  loadFileImportScopeByRun: h.loadScopeByRun,
  requireFileImportTeamAccess: h.requireAccess,
  loadFileImportScope: vi.fn(),
}))

vi.mock("@/server/organizer-file-import/context", () => ({
  loadExistingEvents: h.loadExistingEvents,
}))

vi.mock("@/server-fns/volunteer-fns", () => ({
  inviteVolunteerFn: h.inviteVolunteer,
}))

vi.mock("@/server-fns/competition-workouts-fns", () => ({
  createWorkoutAndAddToCompetitionFn: h.createEvent,
  removeWorkoutFromCompetitionFn: h.removeEvent,
  saveCompetitionEventFn: h.saveEvent,
}))

import {
  applyOrganizerImportFn,
  undoImportFn,
} from "@/server-fns/organizer-file-import-fns"

type Handler<T> = (args: { data: unknown }) => Promise<T>
const applyFn = applyOrganizerImportFn as unknown as Handler<{
  appliedCount: number
  skippedCount: number
  failedCount: number
  results: Array<{ rowKey: string; status: string; entityId: string | null }>
}>
const undoFn = undoImportFn as unknown as Handler<{
  undoneCount: number
  skippedCount: number
}>

function scopeWith(appliedEntities: string | null, routeKind = "volunteers") {
  return {
    competitionId: "comp_1",
    organizingTeamId: "team_org",
    competitionTeamId: "team_comp",
    routeKind,
    eventId: null,
    createdByUserId: "usr_organizer",
    run: { id: "aimp_1", appliedEntities },
  }
}

function volunteerProposal(
  overrides: Partial<VolunteerProposal> = {},
): VolunteerProposal {
  return {
    proposalId: "p1",
    rowKey: "r1",
    action: "create",
    name: "Morgan Reyes",
    email: "morgan@x.com",
    phone: null,
    roleTypes: ["judge"],
    credentials: null,
    shirtSize: null,
    availability: null,
    matchKind: "new",
    matchedMembershipId: null,
    confidence: "high",
    rationale: "From the roster.",
    warnings: [],
    status: "pending",
    ...overrides,
  }
}

function eventProposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    proposalId: "e1",
    rowKey: "er1",
    action: "create",
    targetTrackWorkoutId: null,
    name: "Fran",
    description: "21-15-9",
    scheme: "time",
    scoreType: null,
    timeCap: null,
    changedFields: {},
    confidence: "high",
    rationale: "From the packet.",
    warnings: [],
    status: "pending",
    ...overrides,
  }
}

/** Read the appliedEntities JSON the fn persisted via update().set(). */
function recordedEntities() {
  // `set` lives on the chain object returned by update(), not on the db itself.
  const chain = (
    mockDb.update as unknown as (t?: unknown) => {
      set: { mock: { calls: unknown[][] } }
    }
  )(undefined)
  const calls = chain.set.mock.calls
  const lastSet = calls[calls.length - 1]?.[0] as
    | { appliedEntities?: string }
    | undefined
  return parseAppliedEntities(lastSet?.appliedEntities ?? null)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.reset()
  mockDb.registerTable("teamInvitationTable")
})

describe("applyOrganizerImportFn", () => {
  it("invites a new volunteer and records the created invitation", async () => {
    h.loadScopeByRun.mockResolvedValue(scopeWith(null))
    mockDb.setMockSingleValue({ id: "tinv_new" }) // id-capture findFirst

    const result = await applyFn({
      data: {
        importRunId: "aimp_1",
        volunteerProposals: [volunteerProposal()],
        eventProposals: [],
      },
    })

    expect(h.inviteVolunteer).toHaveBeenCalledTimes(1)
    expect(result.appliedCount).toBe(1)
    expect(result.results[0]).toMatchObject({
      rowKey: "r1",
      status: "applied",
      entityId: "tinv_new",
    })
    expect(recordedEntities()).toEqual([
      { kind: "volunteer_invite", entityId: "tinv_new", rowKey: "r1" },
    ])
  })

  it("skips a row already written by a prior apply (idempotent)", async () => {
    const prior = JSON.stringify([
      { kind: "volunteer_invite", entityId: "tinv_old", rowKey: "r1" },
    ])
    h.loadScopeByRun.mockResolvedValue(scopeWith(prior))

    const result = await applyFn({
      data: {
        importRunId: "aimp_1",
        volunteerProposals: [volunteerProposal({ rowKey: "r1" })],
        eventProposals: [],
      },
    })

    expect(h.inviteVolunteer).not.toHaveBeenCalled()
    expect(result.skippedCount).toBe(1)
    expect(result.results[0]).toMatchObject({ rowKey: "r1", status: "skipped" })
  })

  it("fails a create with no email and never invites", async () => {
    h.loadScopeByRun.mockResolvedValue(scopeWith(null))

    const result = await applyFn({
      data: {
        importRunId: "aimp_1",
        volunteerProposals: [volunteerProposal({ email: null })],
        eventProposals: [],
      },
    })

    expect(h.inviteVolunteer).not.toHaveBeenCalled()
    expect(result.failedCount).toBe(1)
  })

  it("creates an event and records it for undo", async () => {
    h.loadScopeByRun.mockResolvedValue(scopeWith(null, "events"))

    const result = await applyFn({
      data: {
        importRunId: "aimp_1",
        volunteerProposals: [],
        eventProposals: [eventProposal()],
      },
    })

    expect(h.createEvent).toHaveBeenCalledTimes(1)
    expect(result.appliedCount).toBe(1)
    expect(recordedEntities()).toEqual([
      { kind: "event_create", entityId: "trwk_new", rowKey: "er1" },
    ])
  })

  it("updates an event and records a before-snapshot for undo", async () => {
    h.loadScopeByRun.mockResolvedValue(scopeWith(null, "event_detail"))
    h.loadExistingEvents.mockResolvedValue([
      {
        trackWorkoutId: "trwk_1",
        workoutId: "wkt_1",
        name: "Old name",
        scheme: "time",
        scoreType: null,
        description: "old",
      },
    ])

    const result = await applyFn({
      data: {
        importRunId: "aimp_1",
        volunteerProposals: [],
        eventProposals: [
          eventProposal({
            action: "update",
            targetTrackWorkoutId: "trwk_1",
            name: "New name",
            scheme: "reps",
          }),
        ],
      },
    })

    expect(h.saveEvent).toHaveBeenCalledTimes(1)
    expect(result.appliedCount).toBe(1)
    const entity = recordedEntities()[0] as {
      kind: string
      entityId: string
      before?: { name?: string; workoutId?: string }
    }
    expect(entity).toMatchObject({ kind: "event_update", entityId: "trwk_1" })
    expect(entity.before).toMatchObject({ name: "Old name", workoutId: "wkt_1" })
  })
})

describe("undoImportFn", () => {
  it("deletes a still-pending created invitation", async () => {
    h.loadScopeByRun.mockResolvedValue(
      scopeWith(
        JSON.stringify([
          { kind: "volunteer_invite", entityId: "tinv_new", rowKey: "r1" },
        ]),
      ),
    )
    mockDb.setMockSingleValue({ id: "tinv_new", acceptedAt: null })

    const result = await undoFn({ data: { importRunId: "aimp_1" } })

    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(result.undoneCount).toBe(1)
    expect(result.skippedCount).toBe(0)
  })

  it("leaves an already-accepted invitation alone", async () => {
    h.loadScopeByRun.mockResolvedValue(
      scopeWith(
        JSON.stringify([
          { kind: "volunteer_invite", entityId: "tinv_acc", rowKey: "r1" },
        ]),
      ),
    )
    mockDb.setMockSingleValue({ id: "tinv_acc", acceptedAt: new Date() })

    const result = await undoFn({ data: { importRunId: "aimp_1" } })

    expect(mockDb.delete).not.toHaveBeenCalled()
    expect(result.undoneCount).toBe(0)
    expect(result.skippedCount).toBe(1)
  })

  it("removes a created event", async () => {
    h.loadScopeByRun.mockResolvedValue(
      scopeWith(
        JSON.stringify([
          { kind: "event_create", entityId: "trwk_new", rowKey: "er1" },
        ]),
      ),
    )

    const result = await undoFn({ data: { importRunId: "aimp_1" } })

    expect(h.removeEvent).toHaveBeenCalledWith({
      data: { trackWorkoutId: "trwk_new", teamId: "team_org" },
    })
    expect(result.undoneCount).toBe(1)
  })

  it("restores an updated event from its before-snapshot", async () => {
    h.loadScopeByRun.mockResolvedValue(
      scopeWith(
        JSON.stringify([
          {
            kind: "event_update",
            entityId: "trwk_1",
            rowKey: "er1",
            before: {
              workoutId: "wkt_1",
              name: "Old name",
              scheme: "time",
              scoreType: null,
              description: "old",
            },
          },
        ]),
      ),
    )

    const result = await undoFn({ data: { importRunId: "aimp_1" } })

    expect(h.saveEvent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trackWorkoutId: "trwk_1",
        workoutId: "wkt_1",
        name: "Old name",
        scheme: "time",
        teamId: "team_org",
      }),
    })
    expect(result.undoneCount).toBe(1)
  })
})
