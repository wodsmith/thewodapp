import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  save: vi.fn(), cleanup: vi.fn(), waitUntil: vi.fn(), pending: [] as Promise<unknown>[],
}))
vi.mock("cloudflare:workers", () => ({ waitUntil: mocks.waitUntil }))
vi.mock("@/server/workout-import/persistence", () => ({ saveWorkoutImport: mocks.save }))
vi.mock("@/server/workout-import/cleanup", () => ({ cleanupSavedWorkoutImport: mocks.cleanup }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: async () => ({ userId: "athlete" }) }))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: (parse: (input: unknown) => unknown) => ({
    handler: (fn: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) => fn({ data: parse(ctx.data) }),
  }) }),
  createServerOnlyFn: (fn: unknown) => fn,
}))
import { saveWorkoutImportFn } from "@/server-fns/workout-import-fns"

const input = { importId: "import-1", revision: 1, idempotencyKey: "save-1", resolutions: [], workout: {
  name: "Burpees", description: "20 burpees for time", scheme: "time" as const, scoreType: null,
  timeCapSeconds: null, roundsToScore: 1, repsPerRound: null, tiebreakScheme: null,
  scalingGroupId: null, movementIds: [], scope: "private" as const,
} }
const result = { workoutId: "workout-1", trackWorkoutId: null, importId: "import-1", revision: 1 }
beforeEach(() => {
  mocks.pending.length = 0
  mocks.save.mockResolvedValue(result)
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.waitUntil.mockImplementation((promise: Promise<unknown>) => mocks.pending.push(promise))
})

// @lat: [[workout-import-integration#Workout Import Integration#Post-save cleanup tests]]
it("returns the committed receipt even when source cleanup fails", async () => {
  mocks.cleanup.mockRejectedValue(new Error("R2 unavailable"))
  expect(await saveWorkoutImportFn({ data: input })).toEqual(result)
  await Promise.all(mocks.pending)
  expect(mocks.cleanup).toHaveBeenCalledWith({ userId: "athlete", importId: "import-1" })
  expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.cleanup.mock.invocationCallOrder[0])
})

it("does not clean up an unsaved draft when persistence is denied", async () => {
  mocks.save.mockRejectedValue(new Error("AI Workout Import access required"))
  await expect(saveWorkoutImportFn({ data: input })).rejects.toThrow("access required")
  expect(mocks.cleanup).not.toHaveBeenCalled()
  expect(mocks.waitUntil).not.toHaveBeenCalled()
})
