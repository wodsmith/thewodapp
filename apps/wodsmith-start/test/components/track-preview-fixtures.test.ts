import { expect, it } from "vitest"
import {
  getPersonalTrainingDayFn,
  getPersonalTrainingHistoryFn,
  getTrainingLibraryWorkoutFn,
  savePersonalTrainingResultFn,
  savePersonalTrainingSessionFn,
} from "../preview/training/track-personal-fixtures"
import { providerDays } from "../preview/training/track-fixtures"
import { workoutScoring } from "@/lib/crossfit/display"

// @lat: [[training-personal#Verification#Preview personal result persistence]]
it("saves a composed personal result into the same preview day and history store", async () => {
  const data = { teamId: "fixture-result-team", trainingDate: "2026-09-04" }
  const session = await savePersonalTrainingSessionFn({
    data: {
      ...data,
      expectedRevision: 0,
      items: [
        {
          id: "own",
          kind: "personal",
          block: {
            id: "own",
            title: "Personal run",
            kind: "time",
            prescription: "Run 1 mile",
            scalingGuidance: "",
            coachGuidance: "",
          },
        },
      ],
    },
  })
  const other = await savePersonalTrainingSessionFn({
    data: { ...data, teamId: "other-team", expectedRevision: 0, items: [] },
  })
  expect(other.id).not.toBe(session.id)
  const resultInput = {
    personalSessionId: session.id,
    itemId: "own",
    expectedRevision: session.revision,
    score: "7:30",
    unit: "lb" as const,
    completed: true,
    notes: "Steady",
  }
  const result = await savePersonalTrainingResultFn({ data: resultInput })
  expect(result.scoreValue).toBe(450000)
  expect((await getPersonalTrainingDayFn({ data })).results).toEqual([result])
  expect(await getPersonalTrainingHistoryFn({ data })).toEqual([result])
  expect(
    await getPersonalTrainingHistoryFn({ data: { teamId: "other-team" } }),
  ).toEqual([])
  await expect(
    savePersonalTrainingResultFn({
      data: { ...resultInput, expectedRevision: 0 },
    }),
  ).rejects.toThrow("session changed")
  await savePersonalTrainingSessionFn({
    data: { ...data, expectedRevision: session.revision, items: [] },
  })
  expect(await getPersonalTrainingHistoryFn({ data })).toEqual([result])
})
it("resolves workout identity from any provider day and rejects unknown fixture IDs", async () => {
  const extra = {
    ...providerDays[1]!,
    id: "extra-date",
    date: "2026-09-03",
    workouts: [{ workoutId: "extra-workout", name: "Extra", scheme: "time" }],
  }
  providerDays.push(extra)
  try {
    const workout = await getTrainingLibraryWorkoutFn({
      data: { workoutId: "extra-workout" },
    })
    expect(workout.provenance).toMatchObject({
      importId: extra.id,
      sourceDate: extra.date,
    })
    await expect(
      getTrainingLibraryWorkoutFn({ data: { workoutId: "missing" } }),
    ).rejects.toThrow("No preview workout exists")
  } finally {
    providerDays.pop()
  }
})
it.each([
  [180, "3:00"],
  [190, "3:10"],
])("formats a %i-second cap as minutes and seconds", (timeCap, label) => {
  expect(workoutScoring({ scheme: "time-with-cap", timeCap })).toBe(
    `For time · ${label} cap`,
  )
})
// @lat: [[training-personal#Verification#Preview result normalization]]
it("uses production normalization for completion displays and rejects invalid personal scores", async () => {
  const session = await savePersonalTrainingSessionFn({
    data: {
      teamId: "normalization-team",
      trainingDate: "2026-09-04",
      expectedRevision: 0,
      items: (["check", "time", "reps", "load"] as const).map((kind) => ({
        id: kind,
        kind: "personal",
        block: {
          id: kind,
          kind,
          title: kind,
          prescription: "Fixture",
          scalingGuidance: "",
          coachGuidance: "",
        },
      })),
    },
  })
  const input = {
    personalSessionId: session.id,
    expectedRevision: session.revision,
    unit: "lb" as const,
    completed: true,
    notes: "",
  }
  expect(
    await savePersonalTrainingResultFn({
      data: { ...input, itemId: "check", score: "" },
    }),
  ).toMatchObject({
    scoreValue: null,
    displayScore: "Complete",
    audience: "private",
  })
  for (const [itemId, score] of [
    ["time", "nonsense"],
    ["reps", "12cats"],
    ["load", "-1"],
  ]) {
    await expect(
      savePersonalTrainingResultFn({
        data: { ...input, itemId: itemId!, score: score! },
      }),
    ).rejects.toThrow()
  }
  await expect(
    savePersonalTrainingResultFn({
      data: { ...input, itemId: "time", score: "7:30", completed: false },
    }),
  ).rejects.toThrow("completed result")
  expect(
    await getPersonalTrainingHistoryFn({
      data: { teamId: "normalization-team" },
    }),
  ).toHaveLength(1)
})
