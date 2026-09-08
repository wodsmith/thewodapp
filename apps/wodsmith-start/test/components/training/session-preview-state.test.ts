import { beforeEach, expect, it, vi } from "vitest"
import type { PersonalTrainingItem } from "@/lib/training/personal-types"
import { fixtureAdditionExists } from "../../preview/training/append-fixture"
const workout = { name: "Work", description: "Do work", scheme: "time" }
const existing: PersonalTrainingItem = {
  id: "intent",
  kind: "library",
  workoutId: "work",
  workout,
  occurrence: { trackId: "a", sourceDate: "2026-09-04" },
}
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.resetModules()
})
// @lat: [[session-navigation-tests#Preview append identity contract]]
it("rejects ID reuse with different payload and preserves explicit repeat retries", () => {
  const input = {
    id: "intent",
    kind: "library" as const,
    workoutId: "work",
    sourceTrackId: "a",
    sourceDate: "2026-09-04",
  }
  expect(fixtureAdditionExists([existing], input, true)).toBe(true)
  expect(
    fixtureAdditionExists([existing], { ...input, id: "repeat" }, true),
  ).toBe(false)
  expect(
    fixtureAdditionExists([existing], { ...input, id: "other-entry" }),
  ).toBe(true)
  expect(() =>
    fixtureAdditionExists([existing], { ...input, sourceDate: "2026-09-05" }),
  ).toThrow("CONFLICT")
})
// @lat: [[session-navigation-tests#Preview state persists through reload]]
it("persists defaults and private block results with sessions across module reload", async () => {
  let api = await import("../../preview/training/track-personal-fixtures")
  const data = { teamId: "preview-personal", trainingDate: "2026-09-04" }
  const block = {
    id: "check",
    kind: "check" as const,
    title: "Cooldown",
    prescription: "Walk",
    coachGuidance: "",
    scalingGuidance: "",
  }
  const session = await api.savePersonalTrainingSessionFn({
    data: {
      ...data,
      expectedRevision: 0,
      items: [{ id: "check", kind: "personal", block }],
    },
  })
  await api.savePersonalTrainingResultFn({
    data: {
      personalSessionId: session.id,
      itemId: "check",
      expectedRevision: session.revision,
      score: "",
      notes: "Finished comfortably",
      unit: "lb",
      completed: true,
    },
  })
  await api.saveTrainingPreferenceFn({ data: { defaultTrackId: "recovery" } })
  vi.resetModules()
  api = await import("../../preview/training/track-personal-fixtures")
  const reloaded = await api.getPersonalTrainingDayFn({ data })
  expect(reloaded.defaultTrackId).toBe("recovery")
  expect(reloaded.results).toContainEqual(
    expect.objectContaining({
      blockId: "check",
      completed: true,
      notes: "Finished comfortably",
    }),
  )
})
// @lat: [[session-navigation-tests#Preview responses cannot mutate persisted state]]
it("returns detached snapshots for normal reads and duplicate appends", async () => {
  const api = await import("../../preview/training/track-personal-fixtures")
  const data = {
    teamId: "preview-personal",
    trainingDate: "2026-09-04",
    mode: "append" as const,
    expectedRevision: 0,
    items: [
      {
        id: "load",
        kind: "library" as const,
        workoutId: "preview-load",
        sourceTrackId: "ptrk_crossfit_dotcom",
        sourceDate: "2026-09-04",
      },
    ],
  }
  await api.savePersonalTrainingSessionFn({ data })
  const repeated = await api.savePersonalTrainingSessionFn({ data })
  repeated.items.length = 0
  const current = await api.getPersonalTrainingDayFn({ data })
  expect(current.items).toHaveLength(1)
  current.items.length = 0
  expect((await api.getPersonalTrainingDayFn({ data })).items).toHaveLength(1)
})
