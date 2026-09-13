import { describe, expect, it } from "vitest"
import { normalizePersonalLibraryScore } from "./training-personal-scoring"
import {
  directLibraryResultSchema,
  personalTrainingSaveSchema,
  trainingLibraryWorkoutSchema,
} from "./training-personal-validation"

const timed = {
  name: "Timed work",
  description: "Perform",
  scheme: "time",
  tiebreakScheme: "time",
}

describe("personal score review regressions", () => {
  // @lat: [[session-review-tests#Strict personal time inputs]]
  it("rejects malformed complete primary and tiebreak time strings without accepting prefixes", () => {
    for (const value of [
      "1:00abc",
      "60seconds",
      "1:2x",
      "1.02.003oops",
      "1:00:00garbage",
      "1:00.1x",
      "1::00",
    ]) {
      expect(
        () => normalizePersonalLibraryScore(timed, { score: value }),
        value,
      ).toThrow()
      expect(
        () =>
          normalizePersonalLibraryScore(timed, {
            score: "1:00",
            tiebreakScore: value,
          }),
        value,
      ).toThrow()
    }
  })
  // @lat: [[session-review-tests#Supported personal time formats]]
  it("retains colon, decimal, period-delimited and raw-second precision", () => {
    for (const [value, expected] of [
      ["60", 60000],
      ["12.34", 12340],
      ["1:02.003", 62003],
      ["1.02.003", 62003],
      ["1:02:03.004", 3723004],
      ["1.02.03.004", 3723004],
    ] as const) {
      expect(
        normalizePersonalLibraryScore(timed, {
          score: value,
          tiebreakScore: value,
        }),
      ).toMatchObject({ scoreValue: expected, tiebreakValue: expected })
    }
  })
  // @lat: [[session-review-tests#Source dates require a track]]
  it("rejects source dates without their source track in each public input schema", () => {
    expect(
      trainingLibraryWorkoutSchema.safeParse({
        teamId: "team",
        workoutId: "workout",
        sourceDate: "2026-09-04",
      }).success,
    ).toBe(false)
    expect(
      directLibraryResultSchema.safeParse({
        teamId: "team",
        trainingDate: "2026-09-07",
        workoutId: "workout",
        itemId: "attempt",
        score: "60",
        asRx: true,
        sourceDate: "2026-09-04",
      }).success,
    ).toBe(false)
    expect(
      personalTrainingSaveSchema.safeParse({
        teamId: "team",
        trainingDate: "2026-09-07",
        expectedRevision: 0,
        items: [
          {
            id: "item",
            kind: "library",
            workoutId: "workout",
            sourceDate: "2026-09-04",
          },
        ],
      }).success,
    ).toBe(false)
  })
})
