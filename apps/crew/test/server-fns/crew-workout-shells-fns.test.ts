import { beforeEach, describe, expect, it, vi } from "vitest"
import { competitionHeatsTable } from "@/db/schemas/competitions"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import {
  createCrewWorkoutShellFn,
  deleteCrewWorkoutShellFn,
  getCrewWorkoutShellsFn,
} from "@/server-fns/crew-workout-shells-fns"

// @lat: [[crew#Workout Shells]]

// Table-aware select mock: from(table) decides which result set comes back,
// because getCrewWorkoutShellsFn runs its shell + heat reads in parallel so
// call order is not deterministic.
function createDbMock(config: {
  event?: unknown
  track?: unknown
  shells?: unknown[]
  heats?: unknown[]
}) {
  const defaults = {
    event: null,
    track: null,
    shells: [],
    heats: [],
    ...config,
  }

  const resultForTable = (table: unknown): unknown[] => {
    // The event lookup joins crewEventSettingsTable → competitionsTable; the
    // from() table is crewEventSettingsTable.
    if (table === crewEventSettingsTable) {
      return defaults.event ? [defaults.event] : []
    }
    if (table === trackWorkoutsTable) return defaults.shells
    if (table === competitionHeatsTable) return defaults.heats
    return []
  }

  return {
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
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue(undefined),
        })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      }),
    ),
    query: {
      programmingTracksTable: {
        findFirst: vi.fn().mockResolvedValue(defaults.track),
      },
    },
  }
}

let mockDbInstance: ReturnType<typeof createDbMock>

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDbInstance),
}))

// Auth gate is exercised separately; here it always passes so we can assert
// the data-shaping and the heats-block-delete rule.
vi.mock("@/server/crew-auth.server", () => ({
  requireCrewEventManagerAccess: vi.fn().mockResolvedValue({ userId: "u1" }),
}))

vi.mock("@/lib/logging", () => ({
  addRequestContextAttribute: vi.fn(),
  logEntityCreated: vi.fn(),
  logEntityDeleted: vi.fn(),
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
  name: "Spring Throwdown",
  organizingTeamId: "team-1",
  competitionTeamId: null,
}

describe("Crew Workout Shell Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @lat: [[crew#Workout Shells]]
  describe("getCrewWorkoutShellsFn", () => {
    it("returns an empty list when the event has no programming track", async () => {
      mockDbInstance = createDbMock({ event: EVENT, track: null })

      const result = await getCrewWorkoutShellsFn({
        data: { eventId: "comp-1" },
      })

      expect(result.workouts).toEqual([])
    })

    it("maps shells and counts heats per track workout", async () => {
      mockDbInstance = createDbMock({
        event: EVENT,
        track: { id: "track-1" },
        shells: [
          {
            trackWorkoutId: "trwk-1",
            workoutId: "wkt-1",
            name: "Event 1",
            description: "21-15-9",
            trackOrder: "1.00",
          },
        ],
        heats: [
          { trackWorkoutId: "trwk-1" },
          { trackWorkoutId: "trwk-1" },
          { trackWorkoutId: "trwk-2" },
        ],
      })

      const result = await getCrewWorkoutShellsFn({
        data: { eventId: "comp-1" },
      })

      expect(result.workouts).toEqual([
        {
          trackWorkoutId: "trwk-1",
          workoutId: "wkt-1",
          name: "Event 1",
          description: "21-15-9",
          trackOrder: 1,
          heatCount: 2,
        },
      ])
    })

    it("throws when the crew event does not exist", async () => {
      mockDbInstance = createDbMock({ event: null })

      await expect(
        getCrewWorkoutShellsFn({ data: { eventId: "missing" } }),
      ).rejects.toThrow("Crew event not found")
    })
  })

  // @lat: [[crew#Workout Shells]]
  describe("createCrewWorkoutShellFn", () => {
    it("creates a shell under the existing track and returns its ids", async () => {
      mockDbInstance = createDbMock({
        event: EVENT,
        track: { id: "track-1" },
        shells: [{ trackOrder: "1.00" }],
      })

      const result = await createCrewWorkoutShellFn({
        data: { eventId: "comp-1", name: "Event 2", description: "AMRAP" },
      })

      expect(result.name).toBe("Event 2")
      expect(result.description).toBe("AMRAP")
      expect(result.trackOrder).toBe(2)
      expect(result.heatCount).toBe(0)
      expect(result.workoutId).toMatch(/^wkt_/)
      expect(result.trackWorkoutId).toMatch(/^trwk_/)
      expect(mockDbInstance.transaction).toHaveBeenCalledOnce()
    })
  })

  // @lat: [[crew#Workout Shells]]
  describe("deleteCrewWorkoutShellFn", () => {
    it("blocks deletion when the workout still has heats", async () => {
      mockDbInstance = createDbMock({
        event: EVENT,
        shells: [{ trackWorkoutId: "trwk-1", workoutId: "wkt-1" }],
        heats: [{ id: "heat-1" }, { id: "heat-2" }],
      })

      await expect(
        deleteCrewWorkoutShellFn({
          data: { eventId: "comp-1", trackWorkoutId: "trwk-1" },
        }),
      ).rejects.toThrow("Remove the 2 heats on this workout before deleting it.")

      expect(mockDbInstance.transaction).not.toHaveBeenCalled()
    })

    it("deletes the shell when it has no heats", async () => {
      mockDbInstance = createDbMock({
        event: EVENT,
        shells: [{ trackWorkoutId: "trwk-1", workoutId: "wkt-1" }],
        heats: [],
      })

      const result = await deleteCrewWorkoutShellFn({
        data: { eventId: "comp-1", trackWorkoutId: "trwk-1" },
      })

      expect(result).toEqual({ success: true })
      expect(mockDbInstance.transaction).toHaveBeenCalledOnce()
    })
  })
})
