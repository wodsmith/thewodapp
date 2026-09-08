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

// @lat: [[session-navigation-tests#Preview personal retries use validated payloads]]
it("normalizes reordered personal payloads but rejects changed same-ID work and keeps distinct entries", () => {
  const original = {
    id: "personal-work",
    kind: "personal" as const,
    block: {
      id: "personal-work",
      kind: "check" as const,
      title: "Cooldown",
      prescription: "Walk",
      scalingGuidance: "",
      coachGuidance: "",
    },
    remixedFrom: {
      sourceSessionId: "source",
      sourceBlockId: "work",
      sourcePublishedVersion: 1,
    },
  }
  const reordered = {
    remixedFrom: {
      sourcePublishedVersion: 1,
      sourceBlockId: "work",
      sourceSessionId: "source",
    },
    block: {
      coachGuidance: "",
      prescription: "Walk",
      title: "Cooldown",
      kind: "check" as const,
      scalingGuidance: "",
      id: "personal-work",
    },
    kind: "personal" as const,
    id: "personal-work",
  }
  expect(fixtureAdditionExists([original], reordered)).toBe(true)
  expect(fixtureAdditionExists([original], reordered, true)).toBe(true)
  expect(() =>
    fixtureAdditionExists([original], {
      ...reordered,
      block: { ...reordered.block, prescription: "Run" },
    }),
  ).toThrow("CONFLICT")
  expect(
    fixtureAdditionExists([original], { ...reordered, id: "separate" }),
  ).toBe(false)
  const source = {
    id: "source-item",
    kind: "source" as const,
    sourceSessionId: "source",
    sourceBlockId: "work",
    sourcePublishedVersion: 1,
    block: original.block,
    trackId: "a",
    trackName: "Track A",
    sourceTrainingDate: "2026-09-04",
  }
  expect(
    fixtureAdditionExists([source], { ...source, id: "source-other" }),
  ).toBe(true)
  expect(
    fixtureAdditionExists([source], { ...source, id: "source-other" }, true),
  ).toBe(false)
  expect(fixtureAdditionExists([source], source, true)).toBe(true)
})
