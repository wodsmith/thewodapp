import { beforeEach, describe, expect, it, vi } from "vitest"
import { competitionHeatsTable } from "@/db/schemas/competitions"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { generateHeatsFn } from "@/server-fns/crew-heats-fns"

// @lat: [[crew#Bulk Heat Scheduling]]

// Table-aware select mock. The event lookup reads crewEventSettingsTable, the
// workout-belongs-to-event check reads trackWorkoutsTable, and the post-insert
// re-read reads competitionHeatsTable.
function createDbMock(config: {
  event?: unknown
  link?: unknown
  inserted?: unknown[]
}) {
  const defaults = { event: null, link: null, inserted: [], ...config }
  const insertValues = vi.fn().mockResolvedValue(undefined)

  const resultForTable = (table: unknown): unknown[] => {
    if (table === crewEventSettingsTable) {
      return defaults.event ? [defaults.event] : []
    }
    if (table === trackWorkoutsTable) return defaults.link ? [defaults.link] : []
    if (table === competitionHeatsTable) return defaults.inserted
    return []
  }

  return {
    insertValues,
    select: vi.fn(() => {
      let result: unknown[] = []
      const q: Record<string, unknown> = {}
      q.from = vi.fn((table: unknown) => {
        result = resultForTable(table)
        return q
      })
      q.innerJoin = vi.fn(() => q)
      q.where = vi.fn(() => q)
      q.limit = vi.fn(() => Promise.resolve(result))
      q.orderBy = vi.fn(() => Promise.resolve(result))
      q.then = (resolve: (value: unknown) => void) => {
        resolve(result)
        return Promise.resolve(result)
      }
      return q
    }),
    insert: vi.fn(() => ({ values: insertValues })),
  }
}

let mockDbInstance: ReturnType<typeof createDbMock>

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDbInstance),
}))

vi.mock("@/server/crew-auth.server", () => ({
  requireCrewEventManagerAccess: vi.fn().mockResolvedValue({ userId: "u1" }),
}))

vi.mock("@/lib/logging", () => ({
  logEntityCreated: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let handlerFn: ReturnType<typeof vi.fn>
    return {
      inputValidator: () => ({
        handler: (fn: ReturnType<typeof vi.fn>) => {
          handlerFn = fn
          return handlerFn
        },
      }),
    }
  },
}))

const EVENT = {
  id: "comp-1",
  organizingTeamId: "team-1",
  competitionTeamId: null,
}

describe("generateHeatsFn", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("persists explicit per-heat numbers and times as-is", async () => {
    mockDbInstance = createDbMock({
      event: EVENT,
      link: { id: "trwk-1" },
      inserted: [{ id: "cheat_1" }, { id: "cheat_2" }],
    })

    const t1 = new Date("2026-06-24T15:00:00Z")
    // Manual override: NOT exactly 10m after t1, proving we don't recompute.
    const t2 = new Date("2026-06-24T15:12:00Z")

    await generateHeatsFn({
      data: {
        eventId: "comp-1",
        trackWorkoutId: "trwk-1",
        durationMinutes: 8,
        heats: [
          { heatNumber: 1, scheduledTime: t1 },
          { heatNumber: 2, scheduledTime: t2 },
        ],
      },
    })

    expect(mockDbInstance.insertValues).toHaveBeenCalledOnce()
    const rows = mockDbInstance.insertValues.mock.calls[0]?.[0] as Array<{
      heatNumber: number
      scheduledTime: Date | null
      schedulePublishedAt: Date | null
      trackWorkoutId: string
      competitionId: string
    }>

    expect(rows).toHaveLength(2)
    expect(rows[0]?.heatNumber).toBe(1)
    expect(rows[0]?.scheduledTime).toBe(t1)
    expect(rows[1]?.heatNumber).toBe(2)
    // Override preserved exactly — not recomputed to t1 + 10m.
    expect(rows[1]?.scheduledTime).toBe(t2)
    // Heats with a scheduled time auto-publish.
    expect(rows[0]?.schedulePublishedAt).not.toBeNull()
    expect(rows.every((r) => r.competitionId === "comp-1")).toBe(true)
  })

  it("leaves schedulePublishedAt null for heats without a time", async () => {
    mockDbInstance = createDbMock({
      event: EVENT,
      link: { id: "trwk-1" },
      inserted: [{ id: "cheat_1" }],
    })

    await generateHeatsFn({
      data: {
        eventId: "comp-1",
        trackWorkoutId: "trwk-1",
        heats: [{ heatNumber: 1, scheduledTime: null }],
      },
    })

    const rows = mockDbInstance.insertValues.mock.calls[0]?.[0] as Array<{
      scheduledTime: Date | null
      schedulePublishedAt: Date | null
    }>
    expect(rows[0]?.scheduledTime).toBeNull()
    expect(rows[0]?.schedulePublishedAt).toBeNull()
  })

  it("throws when the crew event does not exist", async () => {
    mockDbInstance = createDbMock({ event: null })

    await expect(
      generateHeatsFn({
        data: {
          eventId: "missing",
          trackWorkoutId: "trwk-1",
          heats: [{ heatNumber: 1, scheduledTime: null }],
        },
      }),
    ).rejects.toThrow("Crew event not found")
  })

  it("rejects a workout that does not belong to the event", async () => {
    mockDbInstance = createDbMock({ event: EVENT, link: null })

    await expect(
      generateHeatsFn({
        data: {
          eventId: "comp-1",
          trackWorkoutId: "trwk-other",
          heats: [{ heatNumber: 1, scheduledTime: null }],
        },
      }),
    ).rejects.toThrow("Workout not found for this event")

    expect(mockDbInstance.insertValues).not.toHaveBeenCalled()
  })
})
